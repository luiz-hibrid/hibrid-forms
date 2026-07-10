import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { testCredentials, verifyConversionAction } from "@/lib/google-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnóstico do Google Ads (sem criar conversão).
//   /api/admin/google-test                          → valida credenciais + lista contas
//   /api/admin/google-test?customerId=..&conversionActionId=..  → valida conta + ação
export async function GET(request: Request) {
  if (!isAuthenticated()) {
    return NextResponse.json({ ok: false, error: "nao_autenticado" }, { status: 401 });
  }
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");
  const conversionActionId = url.searchParams.get("conversionActionId");

  if (customerId && conversionActionId) {
    const r = await verifyConversionAction(customerId, conversionActionId);
    return NextResponse.json(r);
  }
  const r = await testCredentials();
  return NextResponse.json(r);
}
