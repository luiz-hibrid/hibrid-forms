import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// Salva as colunas do Kanban no config do formulário.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAuthenticated()) return NextResponse.json({ ok: false }, { status: 401 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false }, { status: 400 });

  const { columns } = await request.json().catch(() => ({ columns: null }));
  if (!Array.isArray(columns))
    return NextResponse.json({ ok: false }, { status: 400 });

  const { data, error } = await sb
    .from("forms")
    .select("config")
    .eq("id", params.id)
    .maybeSingle();
  if (error || !data)
    return NextResponse.json({ ok: false }, { status: 404 });

  const config = { ...(data.config ?? {}), kanban: columns };
  const { error: upErr } = await sb
    .from("forms")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("id", params.id);
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
