import { getSupabaseAdmin } from "@/lib/supabase";
import type { FormConfig, Field } from "@/lib/types";
import { DEFAULT_THEME } from "@/lib/theme";

export interface FormRow {
  id: string;
  slug: string;
  name: string;
  published: boolean;
  config: Omit<FormConfig, "slug" | "name">;
  created_at?: string;
}

export interface FormPreview {
  bg: string;
  questionColor: string;
  subtitleColor: string;
  buttonBg: string;
  buttonText: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  logoUrl?: string;
}

export interface FormListItem {
  id: string;
  slug: string;
  name: string;
  published: boolean;
  steps: number;
  responses: number;
  created_at: string;
  preview: FormPreview;
  /** rótulo da versão ("v2") — só nas versões geradas pela aba Otimizar */
  variantLabel?: string;
}

/** Monta o FormConfig completo (usado pelo runtime público). */
export async function getFormBySlug(slug: string): Promise<FormConfig | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb
    .from("forms")
    .select("slug,name,config,published")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!data) return null;
  return { slug: data.slug, name: data.name, ...(data.config ?? {}) } as FormConfig;
}

/** Workspace dono do formulário (usado ao gravar a submissão). */
export async function getWorkspaceIdBySlug(slug: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb
    .from("forms")
    .select("workspace_id")
    .eq("slug", slug)
    .maybeSingle();
  return (data?.workspace_id as string) ?? null;
}

/** Linha bruta (usado pelo editor do admin). Escopa por workspace se informado. */
export async function getFormRow(
  id: string,
  workspaceId?: string | null
): Promise<FormRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from("forms").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  // master (workspaceId undefined/null) vê tudo; cliente só o próprio
  if (workspaceId && (data as FormRow & { workspace_id?: string }).workspace_id !== workspaceId)
    return null;
  return data as FormRow;
}

export async function listForms(
  workspaceId?: string | null
): Promise<FormListItem[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  let query = sb
    .from("forms")
    .select("id,slug,name,published,config,created_at,workspace_id")
    .order("created_at", { ascending: false });
  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  const { data } = await query;

  const forms = data ?? [];

  // contagem de respostas por formulário (count exato via head)
  const counts = await Promise.all(
    forms.map(async (r) => {
      const { count } = await sb
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("form_slug", r.slug)
        .eq("status", "complete");
      return count ?? 0;
    })
  );

  return forms.map((r, i) => {
    const cfg = (r.config ?? {}) as Partial<FormConfig>;
    const theme = { ...DEFAULT_THEME, ...(cfg.theme ?? {}) };
    const steps = (cfg.steps ?? []) as Field[];
    const welcome = steps.find((s) => s.type === "welcome") ?? steps[0];
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      published: r.published,
      steps: steps.length,
      responses: counts[i],
      created_at: r.created_at,
      // só marca as derivadas: o original é "v1" e não precisa de selo
      variantLabel: cfg.derivedFromId ? cfg.variantLabel : undefined,
      preview: {
        bg: theme.bg,
        questionColor: theme.questionColor,
        subtitleColor: theme.subtitleColor,
        buttonBg: theme.buttonBg,
        buttonText: theme.buttonText,
        title: welcome?.title || r.name,
        subtitle: welcome?.subtitle || "",
        buttonLabel: welcome?.buttonLabel || "Começar",
        logoUrl: cfg.logoUrl,
      },
    };
  });
}

// ============================================================
// Versões que compartilham a mesma base de leads
//
// Um "grupo" é o formulário original mais as versões geradas a partir das
// análises dele. Todos carregam `config.leadGroupId` = id do original.
// Formulário sem grupo devolve um array de um elemento — nada muda no painel.
// ============================================================

export interface GroupMember {
  id: string;
  slug: string;
  name: string;
  /** "v1", "v2"… na ordem de criação */
  variantLabel: string;
  published: boolean;
  created_at: string;
  steps: Field[];
}

/** Id do grupo de um formulário (o dele próprio quando ainda não tem grupo). */
export function leadGroupIdOf(form: Pick<FormRow, "id" | "config">): string {
  return (form.config as Partial<FormConfig> | null)?.leadGroupId ?? form.id;
}

function toMember(
  row: { id: string; slug: string; name: string; published: boolean; created_at: string; config: unknown },
  fallbackLabel: string
): GroupMember {
  const cfg = (row.config ?? {}) as Partial<FormConfig>;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    variantLabel: cfg.variantLabel || fallbackLabel,
    published: row.published,
    created_at: row.created_at,
    steps: (cfg.steps ?? []) as Field[],
  };
}

/** Versões que dividem a base de leads deste formulário, da mais antiga para a mais nova. */
export async function getLeadGroup(form: FormRow): Promise<GroupMember[]> {
  const sb = getSupabaseAdmin();
  const self = toMember(
    {
      id: form.id,
      slug: form.slug,
      name: form.name,
      published: form.published,
      created_at: form.created_at ?? "",
      config: form.config,
    },
    "v1"
  );
  if (!sb) return [self];

  const groupId = leadGroupIdOf(form);
  const { data } = await sb
    .from("forms")
    .select("id,slug,name,published,created_at,config")
    .eq("config->>leadGroupId", groupId)
    .order("created_at", { ascending: true });

  const rows = data ?? [];
  if (!rows.length) return [self];

  const members = rows.map((r, i) => toMember(r, `v${i + 1}`));
  // defensivo: se o próprio formulário não voltou na consulta (config sem grupo
  // por algum motivo), ele ainda precisa aparecer na lista.
  if (!members.some((m) => m.id === form.id)) members.push(self);
  return members;
}

/**
 * União das etapas de todas as versões, sem repetir id — são as colunas da tabela
 * de respostas quando o grupo tem mais de uma versão. As etapas da versão aberta
 * vêm primeiro, na ordem dela; perguntas que só existem em outra versão entram no fim.
 */
export function mergeGroupSteps(members: GroupMember[], ownSlug: string): Field[] {
  const own = members.find((m) => m.slug === ownSlug);
  const out: Field[] = [];
  const seen = new Set<string>();
  const push = (steps: Field[]) => {
    steps.forEach((s) => {
      if (s.type === "welcome" || seen.has(s.id)) return;
      seen.add(s.id);
      out.push(s);
    });
  };
  if (own) push(own.steps);
  members.forEach((m) => {
    if (m.slug !== ownSlug) push(m.steps);
  });
  return out;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
