import { getSupabaseAdmin } from "@/lib/supabase";

// ============================================================
// Histórico append-only dos envios para integrações externas.
//
// Uma linha por tentativa — nunca sobrescrever, nunca apagar no sucesso.
// As colunas gads_* em submissions continuam existindo (são o estado
// atual, usado pelos badges); esta tabela é a memória do que aconteceu.
// ============================================================

export type Destination = "google_ads" | "meta_capi" | "ga4" | "crm" | "email";
export type Trigger = "automatic" | "manual_kanban" | "historico";
export type LogStatus = "sent" | "failed" | "skipped";

export interface ConversionEvent {
  id: string;
  submission_id: string | null;
  form_slug: string;
  created_at: string;
  destination: Destination;
  trigger: Trigger;
  status: LogStatus;
  actor_user_id: string | null;
  detail: Record<string, unknown>;
}

/**
 * Grava um disparo. Nunca lança: um problema no log não pode derrubar
 * o envio do lead nem a qualificação.
 */
export async function logConversionEvent(entry: {
  submissionId: string | null;
  formSlug: string;
  workspaceId?: string | null;
  destination: Destination;
  trigger: Trigger;
  status: LogStatus;
  actorUserId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return;
    await sb.from("conversion_events").insert({
      submission_id: entry.submissionId,
      form_slug: entry.formSlug,
      workspace_id: entry.workspaceId ?? null,
      destination: entry.destination,
      trigger: entry.trigger,
      status: entry.status,
      actor_user_id: entry.actorUserId ?? null,
      detail: entry.detail ?? {},
    });
  } catch (err) {
    console.error("[Hibrid Forms] Falha ao registrar no log de conversões:", err);
  }
}

/** Grava vários disparos de uma vez (pipeline de uma submissão). */
export async function logConversionEvents(
  entries: Parameters<typeof logConversionEvent>[0][]
): Promise<void> {
  if (!entries.length) return;
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return;
    await sb.from("conversion_events").insert(
      entries.map((e) => ({
        submission_id: e.submissionId,
        form_slug: e.formSlug,
        workspace_id: e.workspaceId ?? null,
        destination: e.destination,
        trigger: e.trigger,
        status: e.status,
        actor_user_id: e.actorUserId ?? null,
        detail: e.detail ?? {},
      }))
    );
  } catch (err) {
    console.error("[Hibrid Forms] Falha ao registrar no log de conversões:", err);
  }
}

// ---------------------------------------------------------------- rótulos

export const DESTINATION_LABEL: Record<string, string> = {
  google_ads: "Google Ads",
  meta_capi: "Meta CAPI",
  ga4: "GA4",
  crm: "CRM",
  email: "E-mail",
};

export const TRIGGER_LABEL: Record<string, string> = {
  automatic: "Automático",
  manual_kanban: "Qualificação manual",
  historico: "Registro anterior ao log",
};

export const STATUS_LABEL: Record<string, string> = {
  sent: "Enviado",
  failed: "Falhou",
  skipped: "Ignorado",
};
