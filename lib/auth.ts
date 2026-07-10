import crypto from "crypto";
import { cookies } from "next/headers";

// ============================================================
// Autenticação multi-tenant (tabela `users` própria).
// Sessão = cookie assinado (HMAC) com { uid, role, wid, exp }.
// Senhas com hash scrypt (formato: scrypt$saltHex$hashHex).
// ============================================================

export const SESSION_COOKIE = "hibrid_admin";
export const ACTIVE_WS_COOKIE = "hibrid_ws"; // workspace ativo (só master)

export type Role = "master" | "client";

export interface Session {
  userId: string;
  role: Role;
  /** workspace do usuário-cliente (null para master) */
  workspaceId: string | null;
}

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || "troque-este-segredo-no-env";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// ---------------------------------------------------------------- senhas
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${h.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const h = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hashHex, "hex");
    return h.length === expected.length && crypto.timingSafeEqual(h, expected);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- sessão
export function makeSessionToken(s: Session, ttlSeconds = 60 * 60 * 12): string {
  const payload = {
    uid: s.userId,
    role: s.role,
    wid: s.workspaceId,
    exp: Date.now() + ttlSeconds * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function parseSession(token?: string | null): Session | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(sig, sign(body))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!p.uid || !p.role) return null;
    if (typeof p.exp === "number" && Date.now() > p.exp) return null;
    return { userId: p.uid, role: p.role, workspaceId: p.wid ?? null };
  } catch {
    return null;
  }
}

/** Sessão atual (server components / route handlers). */
export function getSession(): Session | null {
  return parseSession(cookies().get(SESSION_COOKIE)?.value);
}

/** Compat: continua funcionando nas rotas existentes. */
export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export function isMaster(): boolean {
  return getSession()?.role === "master";
}

/**
 * Workspace efetivo da requisição:
 * - cliente: sempre o próprio workspace;
 * - master: o workspace ativo (cookie) ou null = "todos".
 */
export function activeWorkspaceId(): string | null {
  const s = getSession();
  if (!s) return null;
  if (s.role === "client") return s.workspaceId;
  const active = cookies().get(ACTIVE_WS_COOKIE)?.value;
  return active || null;
}
