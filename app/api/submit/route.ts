import { NextResponse } from "next/server";

// ============================================================
// Recebe o lead do formulário.
// FASE ATUAL: valida e registra no log do servidor.
// PRÓXIMAS FASES: salvar no Supabase e disparar webhook do CRM.
// ============================================================
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Log estruturado (visível nos logs de função da Vercel)
    console.log("[Hibrid Forms] Nova submissão:", JSON.stringify(body));

    // TODO (Fase 2): salvar em Supabase (tabela submissions)
    // TODO (Fase 3): enviar para o webhook do CRM (process.env.CRM_WEBHOOK_URL)
    //   com fila + retry, e disparar eventos server-side (Meta CAPI / GA4 MP).

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Hibrid Forms] Erro ao processar submissão:", err);
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400 }
    );
  }
}
