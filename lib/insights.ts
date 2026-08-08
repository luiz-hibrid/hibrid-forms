import Anthropic from "@anthropic-ai/sdk";
import type { Field, FormConfig } from "@/lib/types";

// ============================================================
// Conselheiro de otimização: lê o funil, a estrutura do formulário
// e o perfil de quem converte, e devolve um diagnóstico priorizado.
//
// É uma chamada única ao Claude (sem ferramentas, sem loop de agente).
// A resposta vem em JSON validado por schema para a UI renderizar.
//
// Requer ANTHROPIC_API_KEY no ambiente.
// ============================================================

const MODEL = "claude-opus-5";

export function isInsightsConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// ---------------------------------------------------------------- tipos

export interface InsightSample {
  views: number;
  starts: number;
  completes: number;
  qualified: number;
  periodDays: number;
  viewsPerDay: number;
  /** o funil por pergunta veio de eventos reais (trackDropoff ligado)? */
  hasDropoffTracking: boolean;
}

export interface Insight {
  confianca: "baixa" | "media" | "alta";
  confiancaMotivo: string;
  diagnostico: string;
  achados: {
    gravidade: "alta" | "media" | "baixa";
    titulo: string;
    evidencia: string;
    hipotese: string;
    stepId?: string;
  }[];
  acoes: {
    prioridade: number;
    titulo: string;
    oQueFazer: string;
    porQue: string;
    impactoEsperado: string;
    esforco: "baixo" | "medio" | "alto";
    stepId?: string;
  }[];
  ressalvas: string[];
}

// Schema de saída — o modelo é obrigado a responder exatamente nesta forma.
// Sem minLength/maxLength (não suportados) e additionalProperties: false em
// todos os objetos, como exige a API de structured outputs.
const SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    confianca: { type: "string", enum: ["baixa", "media", "alta"] },
    confiancaMotivo: {
      type: "string",
      description: "Uma frase explicando a confiança, citando o tamanho da amostra.",
    },
    diagnostico: {
      type: "string",
      description:
        "2 a 4 frases: qual é o principal gargalo do formulário e por que ele provavelmente acontece.",
    },
    achados: {
      type: "array",
      description: "Problemas identificados, do mais grave para o menos grave. No máximo 5.",
      items: {
        type: "object",
        properties: {
          gravidade: { type: "string", enum: ["alta", "media", "baixa"] },
          titulo: { type: "string" },
          evidencia: {
            type: "string",
            description: "O número concreto dos dados que sustenta o achado.",
          },
          hipotese: { type: "string", description: "Por que isso provavelmente acontece." },
          stepId: {
            type: "string",
            description: "id da pergunta relacionada, quando houver uma.",
          },
        },
        required: ["gravidade", "titulo", "evidencia", "hipotese"],
        additionalProperties: false,
      },
    },
    acoes: {
      type: "array",
      description: "Mudanças recomendadas, na ordem em que devem ser feitas. No máximo 5.",
      items: {
        type: "object",
        properties: {
          prioridade: { type: "integer" },
          titulo: { type: "string" },
          oQueFazer: {
            type: "string",
            description:
              "A mudança concreta, incluindo o texto sugerido quando for reescrita de pergunta.",
          },
          porQue: { type: "string" },
          impactoEsperado: {
            type: "string",
            description:
              "Direção e ordem de grandeza esperadas. Não invente porcentagem exata.",
          },
          esforco: { type: "string", enum: ["baixo", "medio", "alto"] },
          stepId: { type: "string" },
        },
        required: ["prioridade", "titulo", "oQueFazer", "porQue", "impactoEsperado", "esforco"],
        additionalProperties: false,
      },
    },
    ressalvas: {
      type: "array",
      description: "O que estes dados NÃO permitem concluir. No máximo 3 itens.",
      items: { type: "string" },
    },
  },
  required: ["confianca", "confiancaMotivo", "diagnostico", "achados", "acoes", "ressalvas"],
  additionalProperties: false,
};

const SYSTEM = `Você é especialista em otimização de conversão de formulários de captação de leads, trabalhando para uma agência de tráfego pago brasileira.

Você recebe os dados reais de um formulário multi-etapas: a estrutura das perguntas, o funil de abandono, o perfil de quem converteu e a origem do tráfego. Sua tarefa é dizer onde está o gargalo e o que mudar.

Como trabalhar:
- Fundamente cada achado num número que está nos dados. Se um número não está lá, não afirme.
- Amostras pequenas são comuns aqui. Diga isso abertamente na confiança e nas ressalvas em vez de fingir precisão estatística. Um abandono de 28% numa pergunta com 36 visitantes é um sinal a investigar, não um fato comprovado.
- Nunca invente porcentagem de melhora esperada. Fale em direção e ordem de grandeza.
- Priorize pelo tamanho do vazamento, não pela facilidade da mudança.
- Quando sugerir reescrever uma pergunta, escreva o texto novo por extenso.
- Escreva em português do Brasil, direto e concreto. Sem marketês, sem elogios ao formulário, sem repetir os dados de volta.
- Seja conciso: cada frase precisa carregar informação nova.`;

// ---------------------------------------------------------------- payload

/** Monta um retrato compacto do formulário para o modelo analisar. */
export function buildAnalysisPayload(args: {
  formName: string;
  config: FormConfig;
  steps: Field[];
  reached: Record<string, number> | null;
  sample: InsightSample;
  answerDistribution: Record<string, Record<string, number>>;
  tierCounts: Record<string, number>;
  deviceCounts: Record<string, number>;
  campaignCounts: Record<string, number>;
  avgMs: number | null;
}) {
  const {
    formName,
    steps,
    reached,
    sample,
    answerDistribution,
    tierCounts,
    deviceCounts,
    campaignCounts,
    avgMs,
  } = args;

  // Funil por pergunta, com o abandono já calculado.
  let prev = sample.starts || sample.completes;
  const funnel = steps.map((s) => {
    const alcancaram = reached?.[s.id] ?? null;
    const abandono = alcancaram !== null ? Math.max(prev - alcancaram, 0) : null;
    if (alcancaram !== null) prev = alcancaram;
    return {
      id: s.id,
      pergunta: s.title,
      tipo: s.type,
      obrigatoria: s.required ?? false,
      opcoes: s.options?.map((o) => o.label) ?? undefined,
      alcancaram,
      abandonaram: abandono,
      respostas: answerDistribution[s.id] ?? undefined,
    };
  });

  return {
    formulario: formName,
    amostra: {
      visualizacoes: sample.views,
      iniciaram: sample.starts,
      concluiram: sample.completes,
      qualificados: sample.qualified,
      dias_de_dados: sample.periodDays,
      visualizacoes_por_dia: sample.viewsPerDay,
      funil_por_pergunta_e_de_eventos_reais: sample.hasDropoffTracking,
    },
    tempo_medio_de_preenchimento_segundos: avgMs ? Math.round(avgMs / 1000) : null,
    funil: funnel,
    classificacao_dos_leads: tierCounts,
    dispositivos: deviceCounts,
    campanhas: campaignCounts,
  };
}

// ---------------------------------------------------------------- chamada

export async function generateInsight(payload: unknown): Promise<
  { ok: true; insight: Insight; model: string } | { ok: false; error: string }
> {
  if (!isInsightsConfigured()) {
    return { ok: false, error: "ANTHROPIC_API_KEY não configurada no servidor." };
  }

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
          content: `Analise este formulário e devolva o diagnóstico.\n\n${JSON.stringify(
            payload,
            null,
            2
          )}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "A análise foi recusada pelos filtros de segurança do modelo." };
    }

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return { ok: false, error: "O modelo não retornou conteúdo de texto." };
    }

    const insight = JSON.parse(text.text) as Insight;
    return { ok: true, insight, model: response.model };
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
