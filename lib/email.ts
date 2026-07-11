// ============================================================
// Notificação de novo lead por e-mail (Resend).
// Variáveis de ambiente:
//   RESEND_API_KEY  — chave da API do Resend
//   RESEND_FROM     — remetente verificado, ex.: "Hibrid Forms <leads@seudominio.com>"
// ============================================================

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

export interface LeadEmail {
  to: string[];
  formName: string;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  score?: number;
  tier?: string | null;
  qualified?: boolean;
  answers?: Record<string, unknown>;
  tracking?: Record<string, unknown>;
  leadUrl?: string;
}

function esc(v: unknown): string {
  return String(v ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(d: LeadEmail): string {
  const rows: string[] = [];
  const add = (k: string, v: unknown) =>
    rows.push(
      `<tr><td style="padding:6px 12px;color:#666;font-size:13px;white-space:nowrap">${esc(
        k
      )}</td><td style="padding:6px 12px;font-size:14px;color:#111"><b>${esc(v)}</b></td></tr>`
    );

  if (d.nome) add("Nome", d.nome);
  if (d.email) add("E-mail", d.email);
  if (d.telefone) add("Telefone", d.telefone);
  add("Score", d.score ?? 0);
  if (d.tier) add("Faixa", d.tier);
  add("Qualificado", d.qualified ? "Sim ✅" : "Não");

  const utm = d.tracking || {};
  const utmKeys = ["utm_source", "utm_campaign", "utm_medium", "gclid"];
  utmKeys.forEach((k) => {
    if (utm[k]) add(k, utm[k]);
  });

  const answersRows = Object.entries(d.answers || {})
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;color:#666;font-size:13px;white-space:nowrap">${esc(
          k
        )}</td><td style="padding:6px 12px;font-size:14px;color:#111">${esc(
          Array.isArray(v) ? v.join(", ") : v
        )}</td></tr>`
    )
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto">
    <div style="background:#4b5735;color:#fff;padding:18px 20px;border-radius:12px 12px 0 0">
      <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.8">Novo lead</div>
      <div style="font-size:18px;font-weight:800">${esc(d.formName)}</div>
    </div>
    <div style="border:1px solid #e4e4e4;border-top:none;border-radius:0 0 12px 12px;padding:8px 8px 16px">
      <table style="width:100%;border-collapse:collapse">${rows.join("")}</table>
      ${
        answersRows
          ? `<div style="margin:14px 12px 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999">Respostas</div>
             <table style="width:100%;border-collapse:collapse">${answersRows}</table>`
          : ""
      }
      ${
        d.leadUrl
          ? `<div style="padding:16px 12px 4px"><a href="${esc(
              d.leadUrl
            )}" style="background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:14px;font-weight:700">Ver lead no painel</a></div>`
          : ""
      }
    </div>
  </div>`;
}

export async function sendLeadEmail(d: LeadEmail): Promise<{ ok: boolean; error?: string }> {
  if (!isEmailConfigured()) return { ok: false, error: "nao_configurado" };
  if (!d.to.length) return { ok: false, error: "sem_destinatario" };

  const subject = `Novo lead${d.nome ? ` — ${d.nome}` : ""}${
    d.qualified ? " (qualificado)" : ""
  } · ${d.formName}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: d.to,
        subject,
        html: buildHtml(d),
        reply_to: d.email || undefined,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[Hibrid Forms] Resend falhou:", res.status, t);
      return { ok: false, error: `http_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[Hibrid Forms] Erro ao enviar e-mail:", err);
    return { ok: false, error: "exception" };
  }
}
