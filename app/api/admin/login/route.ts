import { NextResponse } from "next/server";
import { checkPassword, makeSessionToken, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({ password: "" }));

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: "admin_nao_configurado" },
      { status: 500 }
    );
  }

  if (!checkPassword(password || "")) {
    return NextResponse.json({ ok: false, error: "senha_invalida" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, makeSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  });
  return res;
}
