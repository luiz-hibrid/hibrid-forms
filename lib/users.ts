import { getSupabaseAdmin } from "@/lib/supabase";
import { hashPassword } from "@/lib/auth";
import { slugify } from "@/lib/forms-db";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: "master" | "client";
  workspace_id: string | null;
  active: boolean;
  created_at: string;
}

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb
    .from("users")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .eq("active", true)
    .maybeSingle();
  return (data as UserRow) ?? null;
}

export async function listWorkspaces(): Promise<WorkspaceRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: true });
  return (data as WorkspaceRow[]) ?? [];
}

export async function getWorkspace(id: string): Promise<WorkspaceRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from("workspaces").select("*").eq("id", id).maybeSingle();
  return (data as WorkspaceRow) ?? null;
}

export async function createWorkspace(name: string): Promise<WorkspaceRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const clean = name.trim() || "Novo cliente";
  let base = slugify(clean) || "cliente";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data: ex } = await sb.from("workspaces").select("id").eq("slug", slug).maybeSingle();
    if (!ex) break;
    slug = `${base}-${i}`;
  }
  const { data } = await sb
    .from("workspaces")
    .insert({ name: clean, slug })
    .select("*")
    .single();
  return (data as WorkspaceRow) ?? null;
}

export async function listUsersOfWorkspace(workspaceId: string): Promise<UserRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from("users")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  return (data as UserRow[]) ?? [];
}

export async function createClientUser(
  workspaceId: string,
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "sem_supabase" };
  const e = email.trim().toLowerCase();
  if (!e || !password) return { ok: false, error: "dados_incompletos" };
  const { data: ex } = await sb.from("users").select("id").eq("email", e).maybeSingle();
  if (ex) return { ok: false, error: "email_ja_existe" };
  const { error } = await sb.from("users").insert({
    email: e,
    password_hash: hashPassword(password),
    role: "client",
    workspace_id: workspaceId,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setUserPassword(
  userId: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "sem_supabase" };
  if (!password) return { ok: false, error: "senha_vazia" };
  const { error } = await sb
    .from("users")
    .update({ password_hash: hashPassword(password) })
    .eq("id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setUserActive(
  userId: string,
  active: boolean
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "sem_supabase" };
  const { error } = await sb.from("users").update({ active }).eq("id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
