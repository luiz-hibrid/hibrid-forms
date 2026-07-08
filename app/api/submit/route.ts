import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// ============================================================
// Recebe o lead do formulário e grava no Supabase.
// PRÓXIMAS FASES: webhook do CRM + eventos server-side (CAPI / GA4 MP).
// ============================================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const answers: Record<string, unknown> = body?.answers ?? {};

    const row = {
      form_slug: body?.form?.slug ?? "desconhecido",
      form_name: body?.form?.name ?? null,
      status: body?.status ?? "complete",
      nome: (answers["nome"] as string) ?? null,
      email: (answers["email"] as string) ?? null,
      telefone: (answers["telefone"] as string) ?? null,
      answers,
      score: typeof body?.score === "number" ? body.score : 0,
      tier: body?.tier ?? null,
      qualified: !!body?.qualified,
      tracking: body?.tracking ?? {},
    };

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase.from("submissions").insert(row);
      if (error) {
        console.error("[Hibrid Forms] Erro ao gravar no Supabase:", error.message);
        // Não falha a experiência do lead: registra e segue.
      }
    } else {
      console.warn(
        "[Hibrid Forms] Supabase não configurado — lead apenas logado:",
        JSON.stringify(row)
      );
    }

    // TODO (Fase 3): enviar para o webhook do CRM (process.env.CRM_WEBHOOK_URL)
    // TODO (Fase 4): disparar eventos server-side (Meta CAPI / GA4 MP)

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Hibrid Forms] Erro ao processar submissão:", err);
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400 }
    );
  }
}
