import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClientUser } from "@/lib/users";

export const runtime = "nodejs";

// Master cria um usuário-cliente dentro de um workspace.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const s = getSession();
  if (!s || s.role !== "master")
    return NextResponse.json({ ok: false }, { status: 403 });

  const { email, password } = await request
    .json()
    .catch(() => ({ email: "", password: "" }));
  const r = await createClientUser(params.id, email || "", password || "");
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json({ ok: true });
}
