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

/** Linha bruta (usado pelo editor do admin). */
export async function getFormRow(id: string): Promise<FormRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from("forms").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return data as FormRow;
}

export async function listForms(): Promise<FormListItem[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from("forms")
    .select("id,slug,name,published,config,created_at")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    published: r.published,
    steps: Array.isArray(r.config?.steps) ? r.config.steps.length : 0,
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
