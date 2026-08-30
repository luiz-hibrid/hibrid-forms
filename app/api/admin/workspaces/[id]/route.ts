import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { setWorkspaceNotifyWhatsapp } from "@/lib/users";
import { parseDestinations } from "@/lib/whatsapp";

export const runtime = "nodejs";

// Ajustes do workspace (cliente). Master-only.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const s = getSession();
  if (!s || s.role !== "master")
    return NextResponse.json({ ok: false }, { status: 403 });

  const body = await request.json().catch(() => ({}));

  if (typeof body?.notifyWhatsapp === "string") {
    // Só grava destinos válidos — o que vier torto é descartado aqui,
    // não no momento do disparo (quando o lead já chegou).
    const clean = parseDestinations(body.notifyWhatsapp).join(", ");
    const ok = await setWorkspaceNotifyWhatsapp(params.id, clean);
    if (!ok) return NextResponse.json({ ok: false, error: "falha" }, { status: 500 });
    return NextResponse.json({ ok: true, notifyWhatsapp: clean });
  }

  return NextResponse.json({ ok: false, error: "nada_para_atualizar" }, { status: 400 });
}
