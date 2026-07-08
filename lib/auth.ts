import crypto from "crypto";
import { cookies } from "next/headers";

// ============================================================
// Autenticação simples do painel interno (senha única + cookie assinado).
// Suficiente para uso interno no MVP. Pode evoluir para Supabase Auth depois.
// ============================================================

export const SESSION_COOKIE = "hibrid_admin";

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || "troque-este-segredo-no-env";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function makeSessionToken(): string {
  return `ok.${sign("ok")}`;
}

export function isValidToken(token?: string | null): boolean {
  if (!token) return false;
  const [value, sig] = token.split(".");
  if (value !== "ok" || !sig) return false;
  // comparação em tempo constante
  const expected = sign("ok");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Checa a senha informada contra ADMIN_PASSWORD. */
export function checkPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Lê o cookie de sessão (server components / route handlers). */
export function isAuthenticated(): boolean {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return isValidToken(token);
}
