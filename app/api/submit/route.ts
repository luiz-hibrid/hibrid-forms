import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendToCrm, isCrmConfigured } from "@/lib/crm";
import { getFormBySlug, getWorkspaceIdBySlug } from "@/lib/forms-db";
import { sendMetaCapi, sendGa4 } from "@/lib/pixel-server";
import { uploadQualifiedConversion, isGoogleAdsConfigured } from "@/lib/google-ads";
import { sendLeadEmail, isEmailConfigured } from "@/lib/email";
import { deviceFromUa } from "@/lib/device";
import { logConversionEvents, type LogStatus } from "@/lib/conversion-log";

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
      device: deviceFromUa(h.get("user-agent")),
      duration_ms:
        typeof body?.duration_ms === "number" ? Math.round(body.duration_ms) : null,
    };

    const supabase = getSupabaseAdmin();
    let insertedId: string | null = null;

    // workspace dono do formulário (isolamento multi-tenant)
    const workspaceId = await getWorkspaceIdBySlug(row.form_slug);
    const session = body?.session ?? null;

    if (supabase) {
      // se houve salvamento progressivo, promove a linha da sessão (parcial → completo)
      let existingId: string | null = null;
      if (session) {
        const { data: ex } = await supabase
          .from("submissions")
          .select("id")
          .eq("session", session)
          .maybeSingle();
        existingId = ex?.id ?? null;
      }

      if (existingId) {
        const { error } = await supabase
          .from("submissions")
          .update({ ...row, workspace_id: workspaceId, session, updated_at: new Date().toISOString() })
          .eq("id", existingId);
        if (error) console.error("[Hibrid Forms] Erro ao atualizar no Supabase:", error.message);
        else insertedId = existingId;
      } else {
        const { data, error } = await supabase
          .from("submissions")
          .insert({ ...row, workspace_id: workspaceId, session })
          .select("id")
          .single();
        if (error) console.error("[Hibrid Forms] Erro ao gravar no Supabase:", error.message);
        else insertedId = data?.id ?? null;
      }
    } else {
      console.warn("[Hibrid Forms] Supabase não configurado — lead apenas logado.");
    }

    // Carrega o formulário uma vez (webhook + pixel por formulário)
    const fullForm = await getFormBySlug(row.form_slug);
    const formWebhook = (fullForm as unknown as { webhookUrl?: string })?.webhookUrl;

    // Histórico de disparos desta submissão — gravado de uma vez no fim.
    const logEntries: Parameters<typeof logConversionEvents>[0] = [];
    const track = (
      destination: "google_ads" | "meta_capi" | "ga4" | "crm" | "email",
      status: LogStatus,
      detail: Record<string, unknown> = {}
    ) =>
      logEntries.push({
        submissionId: insertedId,
        formSlug: row.form_slug,
        workspaceId,
        destination,
        trigger: "automatic",
        status,
        detail,
      });

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
      track("crm", result.ok ? "sent" : "failed", {
        tentativas: result.attempts,
        error: result.error ?? undefined,
      });
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
        const [metaRes, ga4Res] = await Promise.all([
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
          }).catch((err) => ({ ok: false as const, error: String(err) })),
          sendGa4(pixel, {
            gaCookie: pe.ga,
            value: row.score,
            tier: row.tier ?? undefined,
            eventId: pe.event_id,
          }).catch((err) => ({ ok: false as const, error: String(err) })),
        ]);

        const logPixel = (dest: "meta_capi" | "ga4", r: typeof metaRes) => {
          if (r.ok) return track(dest, "sent", { event_id: pe.event_id });
          if ("skipped" in r && r.skipped)
            return track(dest, "skipped", { motivo: r.reason });
          track(dest, "failed", {
            error: "error" in r ? r.error : "erro",
            event_id: pe.event_id,
          });
        };
        logPixel("meta_capi", metaRes);
        logPixel("ga4", ga4Res);
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

      if (gadsStatus) {
        track("google_ads", gadsStatus as LogStatus, {
          error: gadsError ?? undefined,
          gclid: gclid ? `${gclid.slice(0, 12)}…` : undefined,
          conversion_action_id: fullForm?.pixel?.googleConversionActionId,
          customer_id: fullForm?.pixel?.googleCustomerId,
          valor: row.score,
        });
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

    // Notificação por e-mail (Resend) — novo lead
    const notifyRaw =
      (fullForm as unknown as { notifyEmails?: string })?.notifyEmails ||
      process.env.LEAD_NOTIFY_EMAILS ||
      "";
    const notifyList = notifyRaw
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    if (notifyList.length && isEmailConfigured()) {
      const host = request.headers.get("host");
      const proto = request.headers.get("x-forwarded-proto") || "https";
      const leadUrl = host && insertedId ? `${proto}://${host}/admin/${insertedId}` : undefined;
      const mail = await sendLeadEmail({
        to: notifyList,
        formName: row.form_name || row.form_slug,
        nome: row.nome,
        email: row.email,
        telefone: row.telefone,
        score: row.score,
        tier: row.tier,
        qualified: row.qualified,
        answers: row.answers,
        tracking: row.tracking as Record<string, unknown>,
        leadUrl,
      });
      track("email", mail.ok ? "sent" : "failed", {
        destinatarios: notifyList,
        error: mail.error,
      });
    }

    // grava o histórico de tudo que foi disparado nesta submissão
    await logConversionEvents(logEntries);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Hibrid Forms] Erro ao processar submissão:", err);
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400 }
    );
  }
}
