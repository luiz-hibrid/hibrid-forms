import { NextResponse } from "next/server";
import { getSession, activeWorkspaceId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Atividade recente (leads e envios) + dados do usuário logado, para o topo do admin.
// Escopo igual ao resto do admin: cliente só vê o próprio workspace; master vê o ativo (ou todos).
export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: true, user: { email: "", role: s.role }, items: [] });

  const { data: u } = await sb.from("users").select("email").eq("id", s.userId).maybeSingle();

  const scope = s.role === "client" ? s.workspaceId : activeWorkspaceId();
  let q = sb
    .from("submissions")
    .select("id,nome,email,form_name,form_slug,status,tier,qualified,gads_status,created_at")
    .order("created_at", { ascending: false })
    .limit(25);
  if (scope) q = q.eq("workspace_id", scope);
  const { data } = await q;

  return NextResponse.json({
    ok: true,
    user: { email: u?.email ?? "", role: s.role },
    items: data ?? [],
  });
}
