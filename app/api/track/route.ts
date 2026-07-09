import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// Registra eventos do formulário (view / start) para o Resumo.
export async function POST(request: Request) {
  try {
    const { form, type } = await request.json();
    if (!form || !["view", "start"].includes(type)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    if (sb) await sb.from("form_events").insert({ form_slug: form, type });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
