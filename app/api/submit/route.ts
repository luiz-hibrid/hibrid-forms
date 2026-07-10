import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendToCrm, isCrmConfigured } from "@/lib/crm";
import { getFormBySlug } from "@/lib/forms-db";
import { sendMetaCapi, sendGa4 } from "@/lib/pixel-server";
import { uploadQualifiedConversion, isGoogleAdsConfigured } from "@/lib/google-ads";

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

    // Geolocalização automática da Vercel (baseada no IP)
    const h = request.headers;
    const geoCity = h.get("x-vercel-ip-city");
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
      geo_country: h.get("x-vercel-ip-country") || null,
      geo_uf: h.get("x-vercel-ip-country-region") || null,
      geo_city: geoCity ? decodeURIComponent(geoCity) : null,
      geo_lat: h.get("x-vercel-ip-latitude") || null,
      geo_lng: h.get("x-vercel-ip-longitude") || null,
      duration_ms:
        typeof body?.duration_ms === "number" ? Math.round(body.duration_ms) : null,
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

    // Carrega o formulário uma vez (webhook + pixel por formulário)
    const fullForm = await getFormBySlug(row.form_slug);
    const formWebhook = (fullForm as unknown as { webhookUrl?: string })?.webhookUrl;

    // Envio ao CRM (payload estruturado e padronizado)
    if (isCrmConfigured(formWebhook)) {
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
      const result = await sendToCrm(crmPayload, formWebhook);

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

    // Eventos server-side (Meta CAPI + GA4 MP) — usa a config de pixel do form
    const pe = body?.pixel_event ?? {};
    if (pe.event_id) {
      const pixel = fullForm?.pixel;
      if (pixel && (pixel.metaCapiToken || pixel.ga4ApiSecret)) {
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
          request.headers.get("x-real-ip") ||
          undefined;
        const ua = request.headers.get("user-agent") || undefined;
        await Promise.allSettled([
          sendMetaCapi(pixel, {
            eventId: pe.event_id,
            email: row.email,
            phone: row.telefone,
            fbp: pe.fbp,
            fbc: pe.fbc,
            ip,
            ua,
            sourceUrl: pe.event_source_url,
            value: row.score,
          }),
          sendGa4(pixel, {
            gaCookie: pe.ga,
            value: row.score,
            tier: row.tier ?? undefined,
            eventId: pe.event_id,
          }),
        ]);
      }
    }

    // Google Ads — conversão offline server-side (lead qualificado + gclid)
    const gclid = (row.tracking as { gclid?: string } | null)?.gclid;
    if (row.qualified) {
      let gadsStatus: string | null = null;
      let gadsError: string | null = null;
      const hasActionCfg =
        fullForm?.pixel?.googleCustomerId && fullForm?.pixel?.googleConversionActionId;

      if (!gclid) {
        gadsStatus = "skipped";
        gadsError = "lead sem gclid";
      } else if (!isGoogleAdsConfigured() || !hasActionCfg) {
        gadsStatus = "skipped";
        gadsError = !hasActionCfg
          ? "formulário sem Customer/Conversion ID"
          : "credenciais do Google Ads ausentes no servidor";
      } else {
        const result = await uploadQualifiedConversion({
          gclid,
          email: row.email,
          phone: row.telefone,
          value: row.score,
          currency: "BRL",
          orderId: pe.event_id ?? insertedId,
          conversionActionId: fullForm?.pixel?.googleConversionActionId,
          customerId: fullForm?.pixel?.googleCustomerId,
          whenIso: body?.submitted_at,
        });
        gadsStatus = result.ok ? "sent" : "failed";
        gadsError = result.ok ? null : result.error ?? "erro";
        if (!result.ok) console.error("[Hibrid Forms] Google Ads conversão:", result.error);
      }

      if (supabase && insertedId) {
        await supabase
          .from("submissions")
          .update({
            gads_status: gadsStatus,
            gads_error: gadsError,
            gads_sent_at: gadsStatus === "sent" ? new Date().toISOString() : null,
          })
          .eq("id", insertedId);
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
