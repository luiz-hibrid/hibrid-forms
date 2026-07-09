import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { getFormBySlug } from "@/lib/forms-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Formata a data em "yyyy-MM-dd HH:mm:ss" (UTC) para o template do Google Ads.
function gAdsTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(
    d.getUTCHours()
  )}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Gera o CSV de conversões offline do Google Ads (por gclid), para os leads
 * QUALIFICADOS do formulário. O usuário faz o upload em:
 * Google Ads → Ferramentas → Conversões → Uploads.
 */
export async function GET(request: Request) {
  if (!isAuthenticated()) return NextResponse.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false }, { status: 400 });

  const url = new URL(request.url);
  const slug = url.searchParams.get("form");
  if (!slug) return NextResponse.json({ ok: false, error: "sem_form" }, { status: 400 });

  const form = await getFormBySlug(slug);
  const convName =
    form?.pixel?.googleConversionName?.trim() ||
    url.searchParams.get("name") ||
    "Lead Qualificado";

  const sb = getSupabaseAdmin()!;
  const { data } = await sb
    .from("submissions")
    .select("score, tracking, qualified, tier, created_at")
    .eq("form_slug", slug)
    .eq("qualified", true)
    .order("created_at", { ascending: false })
    .limit(10000);

  const rows = (data ?? []).filter(
    (r) => r.tracking && typeof r.tracking === "object" && (r.tracking as any).gclid
  );

  const lines: string[] = [];
  lines.push("Parameters:TimeZone=+0000");
  lines.push(
    "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency"
  );
  for (const r of rows) {
    const gclid = (r.tracking as any).gclid as string;
    lines.push(
      [
        gclid,
        convName,
        gAdsTime(r.created_at),
        typeof r.score === "number" ? r.score : 0,
        "BRL",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="google-ads-conversoes-${slug}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
