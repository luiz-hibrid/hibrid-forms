import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getFormRow } from "@/lib/forms-db";
import type { Field, FormConfig } from "@/lib/types";
import {
  buildAnalysisPayload,
  generateInsight,
  isInsightsConfigured,
  type InsightSample,
} from "@/lib/insights";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET  → última análise salva deste formulário (não chama a IA).
// POST → gera uma análise nova (custa uma chamada de API) e salva.
// Só master: a análise é entrega da agência e cada disparo tem custo.

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const s = getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false }, { status: 400 });

  const scope = s.role === "client" ? s.workspaceId : null;
  const form = await getFormRow(params.id, scope);
  if (!form) return NextResponse.json({ ok: false }, { status: 404 });

  const { data } = await sb
    .from("form_insights")
    .select("id,created_at,model,sample,payload")
    .eq("form_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    configured: isInsightsConfigured(),
    canGenerate: s.role === "master",
    insight: data ?? null,
  });
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const s = getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  if (s.role !== "master")
    return NextResponse.json({ ok: false, error: "Apenas o master pode gerar análises." }, { status: 403 });

  if (!isInsightsConfigured())
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY não configurada na Vercel." },
      { status: 400 }
    );

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false }, { status: 400 });

  const form = await getFormRow(params.id, null);
  if (!form) return NextResponse.json({ ok: false }, { status: 404 });

  const config = (form.config ?? {}) as unknown as FormConfig;
  const steps = ((config as unknown as { steps?: Field[] }).steps ?? []).filter(
    (f) => f.type !== "welcome"
  );
  const trackDropoff = !!(config as unknown as { trackDropoff?: boolean }).trackDropoff;

  // ---- dados do formulário
  const { data: subs } = await sb
    .from("submissions")
    .select("answers,score,tier,qualified,status,tracking,device,duration_ms,created_at")
    .eq("form_slug", form.slug)
    .limit(2000);

  const rows = subs ?? [];
  const completes = rows.filter((r) => r.status === "complete");

  const [{ count: views }, { count: starts }] = await Promise.all([
    sb.from("form_events").select("id", { count: "exact", head: true }).eq("form_slug", form.slug).eq("type", "view"),
    sb.from("form_events").select("id", { count: "exact", head: true }).eq("form_slug", form.slug).eq("type", "start"),
  ]);

  // ---- funil por pergunta (sessões distintas que alcançaram cada etapa)
  let reached: Record<string, number> | null = null;
  if (trackDropoff) {
    const { data: stepEvents } = await sb
      .from("form_events")
      .select("step,session")
      .eq("form_slug", form.slug)
      .eq("type", "step")
      .limit(20000);
    const perStep: Record<string, Set<string>> = {};
    (stepEvents ?? []).forEach((e: { step: string | null; session: string | null }) => {
      if (!e.step) return;
      (perStep[e.step] ??= new Set()).add(e.session ?? Math.random().toString());
    });
    reached = Object.fromEntries(Object.entries(perStep).map(([k, v]) => [k, v.size]));
  }

  // ---- período coberto pelos dados
  const times = rows
    .map((r) => new Date(r.created_at as string).getTime())
    .filter((t) => Number.isFinite(t));
  const periodDays = times.length
    ? Math.max(Math.round((Math.max(...times) - Math.min(...times)) / 86400000), 1)
    : 1;

  const sample: InsightSample = {
    views: views ?? 0,
    starts: starts ?? 0,
    completes: completes.length,
    qualified: completes.filter((r) => r.qualified).length,
    periodDays,
    viewsPerDay: Number(((views ?? 0) / periodDays).toFixed(1)),
    hasDropoffTracking: trackDropoff,
  };

  // ---- distribuições
  const answerDistribution: Record<string, Record<string, number>> = {};
  steps.forEach((step) => {
    if (!step.options?.length) return;
    const dist: Record<string, number> = {};
    completes.forEach((r) => {
      const raw = (r.answers as Record<string, unknown> | null)?.[step.id];
      const vals = Array.isArray(raw) ? raw : raw != null && raw !== "" ? [raw] : [];
      vals.forEach((v) => {
        const label = step.options!.find((o) => o.value === v)?.label ?? String(v);
        dist[label] = (dist[label] ?? 0) + 1;
      });
    });
    if (Object.keys(dist).length) answerDistribution[step.id] = dist;
  });

  const tally = (get: (r: (typeof rows)[number]) => string | null | undefined) => {
    const out: Record<string, number> = {};
    completes.forEach((r) => {
      const v = get(r);
      if (v) out[v] = (out[v] ?? 0) + 1;
    });
    return out;
  };

  const durations = completes
    .map((r) => r.duration_ms as number | null)
    .filter((d): d is number => typeof d === "number" && d > 0);
  const avgMs = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  const payload = buildAnalysisPayload({
    formName: form.name,
    config,
    steps,
    reached,
    sample,
    answerDistribution,
    tierCounts: tally((r) => r.tier as string | null),
    deviceCounts: tally((r) => r.device as string | null),
    campaignCounts: tally((r) => (r.tracking as { utm_campaign?: string } | null)?.utm_campaign),
    avgMs,
  });

  const result = await generateInsight(payload);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });

  const { data: saved, error } = await sb
    .from("form_insights")
    .insert({
      form_id: params.id,
      workspace_id: (form as { workspace_id?: string | null }).workspace_id ?? null,
      model: result.model,
      sample,
      payload: result.insight,
    })
    .select("id,created_at,model,sample,payload")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, insight: saved });
}
