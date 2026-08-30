import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  listWhatsappGroups,
  isWhatsappConfigured,
  parseDestinations,
  sendWhatsappText,
} from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// Alertas de WhatsApp — apoio ao seletor de destino no admin.
//
// GET  → lista os grupos da instância remetente
// POST → envia uma mensagem de teste para os destinos informados
//
// Master-only: a listagem expõe os nomes dos grupos de WhatsApp da agência,
// e o envio usa o número remetente — nenhum dos dois é coisa de cliente.
// ============================================================

function denyIfNotMaster() {
  const s = getSession();
  if (!s) return NextResponse.json({ ok: false, error: "nao_autenticado" }, { status: 401 });
  if (s.role !== "master")
    return NextResponse.json({ ok: false, error: "sem_permissao" }, { status: 403 });
  return null;
}

export async function GET() {
  const denied = denyIfNotMaster();
  if (denied) return denied;

  if (!isWhatsappConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      groups: [],
      error: "UAZAPI_SERVER_URL e UAZAPI_TOKEN não configurados no servidor",
    });
  }

  const r = await listWhatsappGroups();
  return NextResponse.json({ ...r, configured: true });
}

export async function POST(request: Request) {
  const denied = denyIfNotMaster();
  if (denied) return denied;

  if (!isWhatsappConfigured()) {
    return NextResponse.json(
      { ok: false, error: "uazapi não configurada no servidor" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const destinos = parseDestinations(body?.to);
  if (!destinos.length) {
    return NextResponse.json(
      { ok: false, error: "nenhum destino válido — use o número com DDI ou um grupo" },
      { status: 400 }
    );
  }

  const text =
    "🔔 *Teste — Hibrid Forms*\n\n" +
    "Se você recebeu esta mensagem, os alertas de novo lead estão configurados corretamente para este destino.";

  const results = await Promise.all(destinos.map((d) => sendWhatsappText(d, text)));
  const sent = results.filter((r) => r.ok).length;
  const firstError = results.find((r) => !r.ok)?.error;

  return NextResponse.json({
    ok: sent > 0,
    sent,
    failed: results.length - sent,
    error: sent === results.length ? undefined : firstError,
  });
}
