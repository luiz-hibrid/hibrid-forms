import { getSupabaseAdmin } from "@/lib/supabase";
import type { FormConfig } from "@/lib/types";

export interface FormRow {
  id: string;
  slug: string;
  name: string;
  published: boolean;
  config: Omit<FormConfig, "slug" | "name">;
  created_at?: string;
}

export interface FormListItem {
  id: string;
  slug: string;
  name: string;
  published: boolean;
  steps: number;
  responses: number;
  created_at: string;
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
        .eq("form_slug", r.slug);
      return count ?? 0;
    })
  );

  return forms.map((r, i) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    published: r.published,
    steps: Array.isArray(r.config?.steps) ? r.config.steps.length : 0,
    responses: counts[i],
    created_at: r.created_at,
  }));
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
