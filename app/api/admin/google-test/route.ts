import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { testCredentials } from "@/lib/google-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnóstico: valida as credenciais do Google Ads (sem criar conversão).
// Acesse /api/admin/google-test logado no painel.
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ ok: false, error: "nao_autenticado" }, { status: 401 });
  }
  const result = await testCredentials();
  return NextResponse.json(result);
}
