import crypto from "crypto";
import type { PixelConfig } from "@/lib/types";

function sha256(v: string): string {
  return crypto.createHash("sha256").update(v).digest("hex");
}

function normPhone(p: string): string {
  let d = (p || "").replace(/\D/g, "");
  if (!d) return "";
  // adiciona DDI Brasil se veio sem
  if (d.length <= 11) d = "55" + d;
  return d;
}

interface EventInput {
  eventId: string;
  email?: string | null;
  phone?: string | null;
  fbp?: string;
  fbc?: string;
  ip?: string;
  ua?: string;
  sourceUrl?: string;
  value?: number;
}

/** Meta Conversions API (server-side) com dedup por event_id. */
export async function sendMetaCapi(pixel: PixelConfig, e: EventInput) {
  if (!pixel.metaPixelId || !pixel.metaCapiToken) return;

  const user_data: Record<string, unknown> = {};
  if (e.email) user_data.em = [sha256(e.email.trim().toLowerCase())];
  if (e.phone) {
    const ph = normPhone(e.phone);
    if (ph) user_data.ph = [sha256(ph)];
  }
  if (e.fbp) user_data.fbp = e.fbp;
  if (e.fbc) user_data.fbc = e.fbc;
  if (e.ip) user_data.client_ip_address = e.ip;
  if (e.ua) user_data.client_user_agent = e.ua;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: e.eventId,
        action_source: "website",
        event_source_url: e.sourceUrl,
        user_data,
        custom_data: { value: e.value ?? 0, currency: "BRL" },
      },
    ],
  };
  if (pixel.metaTestCode) body.test_event_code = pixel.metaTestCode;

  const url = `https://graph.facebook.com/v19.0/${pixel.metaPixelId}/events?access_token=${encodeURIComponent(
    pixel.metaCapiToken
  )}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("[Hibrid Forms] Meta CAPI erro:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[Hibrid Forms] Meta CAPI falhou:", err);
  }
}

/** GA4 Measurement Protocol (server-side). */
export async function sendGa4(
  pixel: PixelConfig,
  opts: { gaCookie?: string; value?: number; tier?: string; eventId: string }
) {
  if (!pixel.ga4Id || !pixel.ga4ApiSecret) return;

  // client_id a partir do cookie _ga (GA1.1.XXXX.YYYY) ou aleatório
  let clientId = "";
  if (opts.gaCookie) {
    const parts = opts.gaCookie.split(".");
    if (parts.length >= 4) clientId = `${parts[2]}.${parts[3]}`;
  }
  if (!clientId) clientId = `${Date.now()}.${Math.floor(Math.random() * 1e9)}`;

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
    pixel.ga4Id
  )}&api_secret=${encodeURIComponent(pixel.ga4ApiSecret)}`;
  const body = {
    client_id: clientId,
    events: [
      {
        name: "generate_lead",
        params: {
          value: opts.value ?? 0,
          currency: "BRL",
          tier: opts.tier,
          event_id: opts.eventId,
        },
      },
    ],
  };
  try {
    await fetch(url, { method: "POST", body: JSON.stringify(body) });
  } catch (err) {
    console.error("[Hibrid Forms] GA4 MP falhou:", err);
  }
}
