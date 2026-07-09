import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: Request) {
  if (!isAuthenticated()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "sem_supabase" }, { status: 400 });
  }

  const url = new URL(request.url);
  const tier = url.searchParams.get("tier");
  const form = url.searchParams.get("form");

  const supabase = getSupabaseAdmin()!;
  let query = supabase
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (tier) query = query.eq("tier", tier);
  if (form) query = query.eq("form_slug", form);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const headers = [
    "created_at",
    "form_slug",
    "status",
    "nome",
    "email",
    "telefone",
    "score",
    "tier",
    "qualified",
    "answers",
    "tracking",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.created_at,
        r.form_slug,
        r.status,
        r.nome,
        r.email,
        r.telefone,
        r.score,
        r.tier,
        r.qualified,
        JSON.stringify(r.answers ?? {}),
        JSON.stringify(r.tracking ?? {}),
      ]
        .map(csvCell)
        .join(",")
    );
  }
  const csv = "﻿" + lines.join("\n"); // BOM p/ Excel PT-BR

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-hibrid-${
        new Date().toISOString().slice(0, 10)
      }.csv"`,
    },
  });
}
