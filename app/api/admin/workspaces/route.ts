import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createWorkspace } from "@/lib/users";

export const runtime = "nodejs";

// Master cria um novo workspace (cliente).
export async function POST(request: Request) {
  const s = getSession();
  if (!s || s.role !== "master")
    return NextResponse.json({ ok: false }, { status: 403 });

  const { name } = await request.json().catch(() => ({ name: "" }));
  const ws = await createWorkspace(name || "");
  if (!ws) return NextResponse.json({ ok: false, error: "falha" }, { status: 500 });
  return NextResponse.json({ ok: true, id: ws.id, slug: ws.slug });
}
