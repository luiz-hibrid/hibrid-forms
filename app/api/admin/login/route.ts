import { NextResponse } from "next/server";
import { makeSessionToken, verifyPassword, SESSION_COOKIE } from "@/lib/auth";
import { findUserByEmail } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { email, password } = await request
    .json()
    .catch(() => ({ email: "", password: "" }));

  const user = await findUserByEmail(email || "");
  if (!user || !verifyPassword(password || "", user.password_hash)) {
    return NextResponse.json({ ok: false, error: "credenciais_invalidas" }, { status: 401 });
  }

  const token = makeSessionToken({
    userId: user.id,
    role: user.role,
    workspaceId: user.workspace_id,
  });

  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  });
  return res;
}
