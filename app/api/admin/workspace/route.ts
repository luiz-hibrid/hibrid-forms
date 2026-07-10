import { NextResponse } from "next/server";
import { getSession, ACTIVE_WS_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

// Master troca o workspace ativo (ou limpa para ver "todos").
export async function POST(request: Request) {
  const s = getSession();
  if (!s || s.role !== "master")
    return NextResponse.json({ ok: false }, { status: 403 });

  const { workspaceId } = await request.json().catch(() => ({ workspaceId: "" }));
  const res = NextResponse.json({ ok: true });
  if (workspaceId) {
    res.cookies.set(ACTIVE_WS_COOKIE, String(workspaceId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
  } else {
    res.cookies.set(ACTIVE_WS_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return res;
}
