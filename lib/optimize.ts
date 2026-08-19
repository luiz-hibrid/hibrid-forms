import Anthropic from "@anthropic-ai/sdk";
import type { EndScreen, Field, FieldType, Option } from "@/lib/types";
import { END_STEP } from "@/lib/types";
import type { Insight } from "@/lib/insights";

// ============================================================
// Gerador de versão otimizada do questionário.
//
// Recebe o formulário atual + as ações que o usuário marcou na análise
// e devolve a nova lista de etapas. Só as perguntas mudam — tiers, telas
// finais, tema, pixel e demais configurações são copiados pela rota.
//
// Mesma chave da análise: ANTHROPIC_API_KEY.
// ============================================================

const MODEL = "claude-opus-5";

const FIELD_TYPES: FieldType[] = [
  "welcome",
  "text",
  "name",
  "email",
  "tel",
  "link",
  "single",
  "multi",
];

export interface OptimizeResult {
  steps: Field[];
  /** o que mudou, em uma linha por mudança — mostrado ao usuário */
  mudancas: string[];
  model: string;
}

// ---------------------------------------------------------------- schema

const OPTION_SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string" },
    value: { type: "string", description: "identificador estável em kebab-case" },
    weight: { type: "integer", description: "peso de lead scoring; 0 quando não pontua" },
    next: {
      type: "string",
      description:
        'destino ao escolher a opção: id de outra etapa, "__end__", ou "end:<id de tela final>". Omitir para seguir na ordem.',
    },
  },
  required: ["label", "value"],
  additionalProperties: false,
};

const SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      description: "As etapas do novo formulário, na ordem em que aparecem.",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description:
              "O id da etapa original quando a pergunta mantém o mesmo sentido; kebab-case novo só para pergunta inédita.",
          },
          type: { type: "string", enum: FIELD_TYPES },
          title: { type: "string", description: "o enunciado da pergunta" },
          subtitle: { type: "string" },
          placeholder: { type: "string" },
          required: { type: "boolean" },
          buttonLabel: { type: "string", description: "só para a etapa welcome" },
          options: {
            type: "array",
            description: "obrigatório em single e multi; ausente nos demais tipos",
            items: OPTION_SCHEMA,
          },
        },
        required: ["id", "type", "title"],
        additionalProperties: false,
      },
    },
    mudancas: {
      type: "array",
      description:
        "Uma linha por mudança feita, citando a pergunta afetada. Direto, sem enfeite.",
      items: { type: "string" },
    },
  },
  required: ["steps", "mudancas"],
  additionalProperties: false,
};

// ---------------------------------------------------------------- prompt

const SYSTEM = `Você reescreve formulários de captação de leads para uma agência de tráfego pago brasileira, aplicando recomendações de otimização de conversão que já foram aprovadas.

Você recebe as etapas do formulário atual e a lista de ações a aplicar. Devolve as etapas do novo formulário.

Regras que não podem ser quebradas:
- Aplique SOMENTE as ações recebidas. Não faça nenhuma outra mudança, por melhor que pareça.
- Reaproveite o id da etapa original sempre que a pergunta mantiver o mesmo sentido — mesmo que você reescreva o texto ou mude a posição dela. Id novo só para pergunta que não existia. Os ids ligam as respostas antigas às novas na mesma coluna do painel; trocar um id sem necessidade quebra o histórico do cliente.
- Preserve weight e next das opções que continuam existindo. São o lead scoring e o fluxo condicional do formulário — mexer neles muda a qualificação dos leads.
- Mantenha a etapa welcome, se houver, sempre como primeira.
- Toda etapa single ou multi precisa de options. Os outros tipos não têm options.
- Em next, use apenas: um id de etapa que existe na sua resposta, "__end__", ou "end:<id>" com um id de tela final da lista fornecida.
- Escreva em português do Brasil, no mesmo tom do formulário original.

Em "mudancas", liste o que você fez, uma linha por mudança, citando a pergunta afetada. Sem preâmbulo e sem repetir a ação de volta com outras palavras.`;

// ---------------------------------------------------------------- saneamento

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function slugValue(input: string, fallback: string): string {
  const s = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || fallback;
}

/**
 * Valida o que o modelo devolveu antes de virar formulário de verdade: ids únicos,
 * tipos conhecidos, options coerentes com o tipo e `next` apontando só para destino
 * que existe. O que não passa é descartado em vez de virar formulário quebrado.
 */
export function sanitizeSteps(
  raw: unknown,
  ctx: { originalSteps: Field[]; endScreenIds: string[] }
): Field[] {
  if (!Array.isArray(raw)) return [];

  const original = new Map(ctx.originalSteps.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const steps: Field[] = [];

  raw.forEach((item, i) => {
    if (!isRecord(item)) return;

    const title = typeof item.title === "string" ? item.title.trim() : "";
    // etapa sem enunciado não renderiza — descarta antes de reservar o id
    if (!title && item.type !== "welcome") return;

    let id = typeof item.id === "string" ? slugValue(item.id, "") : "";
    if (!id) id = slugValue(title, `pergunta-${i + 1}`);
    // etapa original de mesmo id: doa o tipo e a mídia quando o modelo não os informa
    const prev = original.get(id);
    while (seen.has(id)) id = `${id}-2`;
    seen.add(id);

    // tipo desconhecido cai para o da pergunta original de mesmo id — só vira
    // texto quando nem isso existe (perde menos que transformar tel em text).
    const type = FIELD_TYPES.includes(item.type as FieldType)
      ? (item.type as FieldType)
      : prev?.type ?? "text";

    const step: Field = { id, type, title };

    if (typeof item.subtitle === "string" && item.subtitle.trim())
      step.subtitle = item.subtitle.trim();
    if (typeof item.placeholder === "string" && item.placeholder.trim())
      step.placeholder = item.placeholder.trim();
    if (typeof item.required === "boolean") step.required = item.required;
    if (type === "welcome" && typeof item.buttonLabel === "string" && item.buttonLabel.trim())
      step.buttonLabel = item.buttonLabel.trim();

    if (type === "single" || type === "multi") {
      const opts = Array.isArray(item.options) ? item.options : [];
      const values = new Set<string>();
      const options: Option[] = [];
      opts.forEach((o, j) => {
        if (!isRecord(o)) return;
        const label = typeof o.label === "string" ? o.label.trim() : "";
        if (!label) return;
        let value =
          typeof o.value === "string" && o.value.trim()
            ? slugValue(o.value, "")
            : slugValue(label, `opcao-${j + 1}`);
        if (!value) value = `opcao-${j + 1}`;
        while (values.has(value)) value = `${value}-2`;
        values.add(value);
        const opt: Option = { label, value };
        if (typeof o.weight === "number" && Number.isFinite(o.weight))
          opt.weight = Math.round(o.weight);
        if (typeof o.next === "string" && o.next.trim()) opt.next = o.next.trim();
        options.push(opt);
      });
      // single/multi sem opções não renderiza — vira campo de texto.
      if (options.length) step.options = options;
      else step.type = "text";
    }

    // mídia não é gerada pelo modelo: preserva a da etapa original de mesmo id
    if (prev?.media) step.media = prev.media;

    steps.push(step);
  });

  // segunda passada: `next` só pode apontar para destino que existe de fato
  const ids = new Set(steps.map((s) => s.id));
  const ends = new Set(ctx.endScreenIds);
  steps.forEach((s) => {
    s.options?.forEach((o) => {
      if (!o.next) return;
      const ok =
        o.next === END_STEP ||
        ids.has(o.next) ||
        (o.next.startsWith("end:") && ends.has(o.next.slice(4)));
      if (!ok) delete o.next;
    });
  });

  // welcome sempre primeiro
  const wi = steps.findIndex((s) => s.type === "welcome");
  if (wi > 0) steps.unshift(steps.splice(wi, 1)[0]);

  return steps;
}

// ---------------------------------------------------------------- chamada

export async function generateOptimizedSteps(args: {
  formName: string;
  steps: Field[];
  endScreens: EndScreen[];
  diagnostico: string;
  acoes: Insight["acoes"];
}): Promise<{ ok: true; result: OptimizeResult } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "ANTHROPIC_API_KEY não configurada no servidor." };
  }
  if (!args.acoes.length) {
    return { ok: false, error: "Nenhuma ação selecionada." };
  }

  const payload = {
    formulario: args.formName,
    diagnostico: args.diagnostico,
    telas_finais_disponiveis: args.endScreens.map((e) => ({ id: e.id, nome: e.name })),
    etapas_atuais: args.steps,
    acoes_a_aplicar: args.acoes.map((a) => ({
      titulo: a.titulo,
      o_que_fazer: a.oQueFazer,
      por_que: a.porQue,
      etapa_relacionada: a.stepId,
    })),
  };

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Aplique as ações e devolva as etapas do novo formulário.\n\n${JSON.stringify(
            payload,
            null,
            2
          )}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "A geração foi recusada pelos filtros de segurança do modelo." };
    }

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return { ok: false, error: "O modelo não retornou conteúdo de texto." };
    }

    const parsed = JSON.parse(text.text) as { steps?: unknown; mudancas?: unknown };
    const steps = sanitizeSteps(parsed.steps, {
      originalSteps: args.steps,
      endScreenIds: args.endScreens.map((e) => e.id).filter(Boolean),
    });

    const perguntas = steps.filter((s) => s.type !== "welcome");
    if (!perguntas.length) {
      return {
        ok: false,
        error: "O modelo devolveu um formulário sem perguntas válidas. Tente gerar de novo.",
      };
    }

    const mudancas = Array.isArray(parsed.mudancas)
      ? parsed.mudancas.filter((m): m is string => typeof m === "string" && !!m.trim())
      : [];

    return { ok: true, result: { steps, mudancas, model: response.model } };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "Limite de requisições atingido. Tente de novo em instantes." };
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "Chave da API da Anthropic inválida." };
    }
    if (err instanceof Anthropic.APIError) {
      return { ok: false, error: `Erro da API (${err.status}): ${err.message}` };
    }
    return { ok: false, error: String(err) };
  }
}
