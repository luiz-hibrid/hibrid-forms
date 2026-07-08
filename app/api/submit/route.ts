import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendToCrm, isCrmConfigured } from "@/lib/crm";

export const runtime = "nodejs";
export const maxDuration = 30;

// ============================================================
// Recebe o lead, grava no Supabase e envia ao webhook do CRM.
// PRÓXIMA FASE: eventos server-side (Meta CAPI / GA4 MP).
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
    let insertedId: string | null = null;

    if (supabase) {
      const { data, error } = await supabase
        .from("submissions")
        .insert(row)
        .select("id")
        .single();
      if (error) {
        console.error("[Hibrid Forms] Erro ao gravar no Supabase:", error.message);
      } else {
        insertedId = data?.id ?? null;
      }
    } else {
      console.warn("[Hibrid Forms] Supabase não configurado — lead apenas logado.");
    }

    // Envio ao CRM (payload estruturado e padronizado)
    if (isCrmConfigured()) {
      const crmPayload = {
        form: row.form_slug,
        form_name: row.form_name,
        nome: row.nome,
        email: row.email,
        telefone: row.telefone,
        score: row.score,
        tier: row.tier,
        qualified: row.qualified,
        answers: row.answers,
        tracking: row.tracking,
        submission_id: insertedId,
        submitted_at: body?.submitted_at ?? new Date().toISOString(),
      };
      const result = await sendToCrm(crmPayload);

      if (supabase && insertedId) {
        await supabase
          .from("submissions")
          .update({
            crm_status: result.ok ? "delivered" : "failed",
            crm_attempts: result.attempts,
            crm_error: result.error ?? null,
            crm_delivered_at: result.ok ? new Date().toISOString() : null,
          })
          .eq("id", insertedId);
      }
      if (!result.ok) {
        console.error("[Hibrid Forms] Falha ao enviar ao CRM:", result.error);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Hibrid Forms] Erro ao processar submissão:", err);
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400 }
    );
  }
}
