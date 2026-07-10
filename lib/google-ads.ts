import crypto from "crypto";

// ============================================================
// Google Ads API — envio server-side de conversões offline
// (Enhanced Conversions for Leads): gclid + e-mail/telefone em hash.
//
// Roda na Vercel (função serverless). Precisa das variáveis de ambiente:
//   GOOGLE_ADS_DEVELOPER_TOKEN      developer token da conta de API
//   GOOGLE_ADS_CLIENT_ID           OAuth client id
//   GOOGLE_ADS_CLIENT_SECRET       OAuth client secret
//   GOOGLE_ADS_REFRESH_TOKEN       refresh token da conta autorizada
//   GOOGLE_ADS_CUSTOMER_ID         id da conta do Google Ads (só dígitos)
//   GOOGLE_ADS_LOGIN_CUSTOMER_ID   (opcional) id da MCC, se aplicável
//   GOOGLE_ADS_CONVERSION_ACTION_ID (opcional) fallback do id da conversão
// ============================================================

const API_VERSION = "v17";

// Credenciais de AUTENTICAÇÃO (nível MCC/agência) — configuradas uma vez.
// O Customer ID da conta do cliente vem por formulário (ou no env como fallback).
export function isGoogleAdsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN
  );
}

function sha256(v: string): string {
  return crypto.createHash("sha256").update(v).digest("hex");
}
function normEmail(e: string): string {
  return e.trim().toLowerCase();
}
function normPhoneE164(p: string): string {
  let d = (p || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 11) d = "55" + d; // assume Brasil se veio sem DDI
  return "+" + d;
}
// Formato exigido: "yyyy-MM-dd HH:mm:ss+HH:MM"
function conversionDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(
    d.getUTCHours()
  )}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+00:00`;
}

// Troca o refresh token por um access token OAuth.
async function getAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
        grant_type: "refresh_token",
      }),
    });
    const data = await res.json();
    return data.access_token ?? null;
  } catch (err) {
    console.error("[GoogleAds] erro ao obter access token:", err);
    return null;
  }
}

/**
 * Testa as credenciais (OAuth + developer token) sem efeitos colaterais:
 * pega um access token e lista as contas acessíveis pela conta autenticada.
 */
export async function testCredentials(): Promise<{
  ok: boolean;
  status?: number;
  customers?: string[];
  error?: string;
}> {
  if (!isGoogleAdsConfigured()) {
    return { ok: false, error: "Faltam credenciais (developer token / OAuth / refresh token)." };
  }
  const token = await getAccessToken();
  if (!token) {
    return { ok: false, error: "Não obteve access token — confira client id/secret/refresh token." };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  };
  if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    headers["login-customer-id"] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/\D/g, "");
  }
  try {
    const res = await fetch(
      `https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`,
      { headers }
    );
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, error: text.slice(0, 800) };
    }
    const data = JSON.parse(text);
    return { ok: true, customers: data.resourceNames ?? [] };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export interface QualifiedConversion {
  gclid: string;
  email?: string | null;
  phone?: string | null;
  value?: number;
  currency?: string;
  /** id da transação para deduplicar (usar o mesmo event_id do pixel) */
  orderId?: string | null;
  /** id numérico da ação de conversão; cai no env se não vier */
  conversionActionId?: string | null;
  /** Customer ID da conta do cliente (só dígitos); cai no env se não vier */
  customerId?: string | null;
  /** data/hora da conversão (ISO) */
  whenIso?: string;
}

/**
 * Envia uma conversão offline (click conversion) para o Google Ads com
 * Enhanced Conversions (gclid + user identifiers em hash).
 */
export async function uploadQualifiedConversion(
  c: QualifiedConversion
): Promise<{ ok: boolean; error?: string }> {
  if (!isGoogleAdsConfigured()) return { ok: false, error: "nao_configurado" };

  const customerId = (
    c.customerId ||
    process.env.GOOGLE_ADS_CUSTOMER_ID ||
    ""
  ).replace(/\D/g, "");
  if (!customerId) return { ok: false, error: "sem_customer_id" };
  const actionId =
    c.conversionActionId?.replace(/\D/g, "") ||
    process.env.GOOGLE_ADS_CONVERSION_ACTION_ID?.replace(/\D/g, "");
  if (!actionId) return { ok: false, error: "sem_conversion_action" };
  if (!c.gclid) return { ok: false, error: "sem_gclid" };

  const token = await getAccessToken();
  if (!token) return { ok: false, error: "sem_token" };

  const userIdentifiers: Record<string, string>[] = [];
  if (c.email) userIdentifiers.push({ hashedEmail: sha256(normEmail(c.email)) });
  if (c.phone) {
    const ph = normPhoneE164(c.phone);
    if (ph) userIdentifiers.push({ hashedPhoneNumber: sha256(ph) });
  }

  const body = {
    conversions: [
      {
        gclid: c.gclid,
        conversionAction: `customers/${customerId}/conversionActions/${actionId}`,
        conversionDateTime: conversionDateTime(c.whenIso ?? new Date().toISOString()),
        conversionValue: c.value ?? 0,
        currencyCode: c.currency ?? "BRL",
        orderId: c.orderId ?? undefined,
        userIdentifiers,
      },
    ],
    partialFailure: true,
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    "Content-Type": "application/json",
  };
  if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    headers["login-customer-id"] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(
      /\D/g,
      ""
    );
  }

  try {
    const res = await fetch(
      `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}:uploadClickConversions`,
      { method: "POST", headers, body: JSON.stringify(body) }
    );
    if (!res.ok) {
      const text = await res.text();
      console.error("[GoogleAds] upload falhou:", res.status, text);
      return { ok: false, error: `http_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[GoogleAds] erro no upload:", err);
    return { ok: false, error: "exception" };
  }
}
