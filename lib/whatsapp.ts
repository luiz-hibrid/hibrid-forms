// ============================================================
// Notificação de novo lead por WhatsApp (uazapi).
//
// Um único remetente para toda a agência (a instância da Hibrid); o que muda
// por cliente é o DESTINO — número particular ou grupo.
//
// Variáveis de ambiente:
//   UAZAPI_SERVER_URL — ex.: "https://xxx.uazapi.com" (sem barra final)
//   UAZAPI_TOKEN      — token da instância que dispara os alertas
// ============================================================

export function isWhatsappConfigured(): boolean {
  return Boolean(process.env.UAZAPI_SERVER_URL && process.env.UAZAPI_TOKEN);
}

function uazConfig() {
  const serverUrl = String(process.env.UAZAPI_SERVER_URL || "").replace(/\/+$/, "");
  const token = String(process.env.UAZAPI_TOKEN || "");
  if (!serverUrl || !token) throw new Error("uazapi não configurada");
  return { serverUrl, token };
}

// ------------------------------------------------------------
// Destinos
// ------------------------------------------------------------

/**
 * Um destino é um número com DDI ("5511999998888") ou um JID de grupo
 * ("120363xxxxxxxxx@g.us"). Grupos precisam do JID inteiro — cuidado ao
 * reaproveitar normalizadores de número, que costumam cortar o "@g.us"
 * e transformar o grupo num destino inválido.
 */
export function normalizeDestination(raw: string): string | null {
  const v = String(raw || "").trim();
  if (!v) return null;

  // Grupo: preserva o JID intacto, só valida o formato.
  if (v.includes("@")) {
    const jid = v.toLowerCase();
    return /^\d{10,25}@g\.us$/.test(jid) ? jid : null;
  }

  // Número: só dígitos, com DDI (BR ganha 55 quando vem só com DDD).
  let d = v.replace(/\D/g, "");
  if (!d) return null;
  if ((d.length === 10 || d.length === 11) && !d.startsWith("55")) d = "55" + d;
  return /^\d{10,15}$/.test(d) ? d : null;
}

/** Quebra a lista separada por vírgula em destinos válidos e únicos. */
export function parseDestinations(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out = String(raw)
    .split(",")
    .map((p) => normalizeDestination(p))
    .filter((p): p is string => Boolean(p));
  return Array.from(new Set(out));
}

export function isGroupDestination(dest: string): boolean {
  return dest.endsWith("@g.us");
}

// ------------------------------------------------------------
// Envio
// ------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Traduz erros da uazapi para algo acionável. O código 463 do WhatsApp é uma
 * restrição temporária da conta (volume/qualidade de envio) — reenviar agora
 * não resolve.
 */
function uazError(status: number, body: unknown): string {
  const b = body as { error?: unknown; message?: unknown };
  const raw = String(b?.error ?? b?.message ?? JSON.stringify(body ?? {}));
  if (/\b463\b/.test(raw) || /temporary restriction/i.test(raw)) {
    return "WhatsApp aplicou restrição temporária ao número remetente (volume/qualidade de envio)";
  }
  return `uazapi ${status}: ${raw.slice(0, 200)}`;
}

/** Envia um texto para um destino. Com retry/backoff, igual ao envio ao CRM. */
export async function sendWhatsappText(
  to: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const dest = normalizeDestination(to);
  if (!dest) return { ok: false, error: "destino_invalido" };

  let serverUrl: string;
  let token: string;
  try {
    ({ serverUrl, token } = uazConfig());
  } catch {
    return { ok: false, error: "nao_configurado" };
  }

  const backoff = [0, 600, 1800]; // 3 tentativas
  let lastError = "";

  for (let attempt = 1; attempt <= backoff.length; attempt++) {
    if (backoff[attempt - 1]) await sleep(backoff[attempt - 1]);
    try {
      const res = await fetchWithTimeout(
        `${serverUrl}/send/text`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", token },
          body: JSON.stringify({ number: dest, text }),
        },
        12000
      );
      if (res.ok) return { ok: true };

      const body = await res.json().catch(() => ({}));
      lastError = uazError(res.status, body);
      // 4xx é erro de configuração/conteúdo — insistir não adianta.
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, error: lastError };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "exception";
    }
  }

  return { ok: false, error: lastError || "falha_desconhecida" };
}

// ------------------------------------------------------------
// Mensagem de novo lead
// ------------------------------------------------------------

export interface LeadWhatsapp {
  to: string[];
  formName: string;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  score?: number;
  tier?: string | null;
  qualified?: boolean;
  tracking?: Record<string, unknown>;
  leadUrl?: string;
}

/** Formata o telefone brasileiro para leitura humana no alerta. */
function prettyPhone(raw?: string | null): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  const n = d.startsWith("55") ? d.slice(2) : d;
  if (n.length === 11) return `+55 (${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `+55 (${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return raw ?? null;
}

/**
 * Alerta curto — vai para grupo, então não pode ser um dump das respostas.
 * Markdown do WhatsApp: *negrito*, _itálico_.
 */
export function buildLeadMessage(d: LeadWhatsapp): string {
  const lines: string[] = [];
  lines.push(`🔔 *Novo lead* — ${d.formName}`);
  lines.push("");

  if (d.nome) lines.push(`*Nome:* ${d.nome}`);
  const tel = prettyPhone(d.telefone);
  if (tel) lines.push(`*Telefone:* ${tel}`);
  if (d.email) lines.push(`*E-mail:* ${d.email}`);

  const scoreLine = [`*Score:* ${d.score ?? 0}`];
  if (d.tier) scoreLine.push(`· ${d.tier}`);
  if (d.qualified) scoreLine.push("✅");
  lines.push(scoreLine.join(" "));

  const t = (d.tracking || {}) as Record<string, unknown>;
  const origem = [t.utm_source, t.utm_medium].filter(Boolean).join(" / ");
  const campanha = t.utm_campaign ? `· ${t.utm_campaign}` : "";
  if (origem || campanha) {
    lines.push("");
    lines.push(`_${[origem, campanha].filter(Boolean).join(" ")}_`);
  }

  if (d.leadUrl) {
    lines.push("");
    lines.push(`Ver no painel: ${d.leadUrl}`);
  }

  return lines.join("\n");
}

/** Dispara o alerta para todos os destinos configurados. */
export async function sendLeadWhatsapp(
  d: LeadWhatsapp
): Promise<{ ok: boolean; sent: number; failed: number; error?: string }> {
  if (!isWhatsappConfigured()) return { ok: false, sent: 0, failed: 0, error: "nao_configurado" };
  if (!d.to.length) return { ok: false, sent: 0, failed: 0, error: "sem_destinatario" };

  const text = buildLeadMessage(d);
  const results = await Promise.all(d.to.map((dest) => sendWhatsappText(dest, text)));

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;
  const firstError = results.find((r) => !r.ok)?.error;

  return { ok: sent > 0, sent, failed, error: failed ? firstError : undefined };
}

// ------------------------------------------------------------
// Grupos (para o seletor de destino no admin)
// ------------------------------------------------------------

export interface WhatsappGroup {
  id: string;
  name: string;
  participants?: number;
}

/** Lista os grupos da instância remetente. Usado só pelo admin (master). */
export async function listWhatsappGroups(): Promise<{
  ok: boolean;
  groups: WhatsappGroup[];
  error?: string;
}> {
  let serverUrl: string;
  let token: string;
  try {
    ({ serverUrl, token } = uazConfig());
  } catch {
    return { ok: false, groups: [], error: "nao_configurado" };
  }

  try {
    const res = await fetchWithTimeout(
      `${serverUrl}/group/list`,
      { method: "GET", headers: { token } },
      15000
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, groups: [], error: uazError(res.status, body) };

    // A resposta varia entre versões: array puro ou { groups: [...] }.
    const raw: unknown[] = Array.isArray(body)
      ? body
      : Array.isArray((body as { groups?: unknown[] })?.groups)
      ? ((body as { groups: unknown[] }).groups as unknown[])
      : [];

    const groups: WhatsappGroup[] = raw
      .map((g) => {
        const o = g as Record<string, unknown>;
        const id = String(o.JID ?? o.jid ?? o.id ?? o.wa_chatid ?? "");
        const name = String(o.Name ?? o.name ?? o.subject ?? "").trim();
        const parts = o.Participants ?? o.participants;
        return {
          id,
          name: name || id,
          participants: Array.isArray(parts) ? parts.length : undefined,
        };
      })
      .filter((g) => g.id.endsWith("@g.us"))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return { ok: true, groups };
  } catch (err) {
    console.error("[Hibrid Forms] Falha ao listar grupos do WhatsApp:", err);
    return { ok: false, groups: [], error: "exception" };
  }
}
