import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { setUserPassword, setUserActive } from "@/lib/users";

export const runtime = "nodejs";

// Master reseta senha / ativa-desativa um usuário.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const s = getSession();
  if (!s || s.role !== "master")
    return NextResponse.json({ ok: false }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  if (typeof body.password === "string" && body.password) {
    const r = await setUserPassword(params.id, body.password);
    if (!r.ok) return NextResponse.json(r, { status: 400 });
  }
  if (typeof body.active === "boolean") {
    const r = await setUserActive(params.id, body.active);
    if (!r.ok) return NextResponse.json(r, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
