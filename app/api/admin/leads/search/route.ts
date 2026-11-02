import { NextResponse } from "next/server";
import { getSession, activeWorkspaceId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Busca geral de leads (nome, e-mail, telefone) no escopo do usuário.
// Cliente só enxerga o próprio workspace; master, o workspace ativo (ou todos).
export async function GET(request: Request) {
  const s = getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: true, items: [] });

  // remove caracteres que quebram o filtro .or() do PostgREST
  const q = (new URL(request.url).searchParams.get("q") ?? "").replace(/[,()%*\\]/g, " ").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ ok: true, items: [] });

  const scope = s.role === "client" ? s.workspaceId : activeWorkspaceId();
  let query = sb
    .from("submissions")
    .select("id,nome,email,telefone,form_name,form_slug,status,tier,created_at")
    .or(`nome.ilike.%${q}%,email.ilike.%${q}%,telefone.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(12);
  if (scope) query = query.eq("workspace_id", scope);
  const { data } = await query;
  return NextResponse.json({ ok: true, items: data ?? [] });
}
