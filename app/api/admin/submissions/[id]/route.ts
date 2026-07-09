import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// Atualiza o estágio (coluna Kanban) de um lead.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAuthenticated()) return NextResponse.json({ ok: false }, { status: 401 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.stage === "string") patch.stage = body.stage;
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ ok: false }, { status: 400 });

  const { error } = await sb.from("submissions").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Exclui um lead.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAuthenticated()) return NextResponse.json({ ok: false }, { status: 401 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false }, { status: 400 });
  const { error } = await sb.from("submissions").delete().eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
