import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getFormRow, getLeadGroup, leadGroupIdOf, slugify } from "@/lib/forms-db";
import type { EndScreen, Field, FormConfig } from "@/lib/types";
import type { Insight } from "@/lib/insights";
import { generateOptimizedSteps } from "@/lib/optimize";

export const runtime = "nodejs";
export const maxDuration = 300;

// Cria uma nova versão do formulário aplicando as ações escolhidas na análise.
// Nasce como rascunho, no mesmo workspace, compartilhando a base de leads do original.
// Só master: cada disparo custa uma chamada de API e cria um formulário.

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const s = getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  if (s.role !== "master")
    return NextResponse.json(
      { ok: false, error: "Apenas o master pode gerar formulários." },
      { status: 403 }
    );

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, error: "sem_supabase" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as {
    insightId?: string;
    actionIndexes?: number[];
  } | null;
  if (!body?.insightId)
    return NextResponse.json({ ok: false, error: "informe a análise" }, { status: 400 });

  const form = await getFormRow(params.id, null);
  if (!form) return NextResponse.json({ ok: false, error: "nao_encontrado" }, { status: 404 });

  // ---- análise de origem (precisa ser deste formulário)
  const { data: insightRow } = await sb
    .from("form_insights")
    .select("id,payload")
    .eq("id", body.insightId)
    .eq("form_id", params.id)
    .maybeSingle();
  if (!insightRow)
    return NextResponse.json({ ok: false, error: "analise_nao_encontrada" }, { status: 404 });

  const insight = insightRow.payload as Insight;
  const ordered = (insight.acoes ?? []).slice().sort((a, b) => a.prioridade - b.prioridade);
  const picked = Array.isArray(body.actionIndexes)
    ? ordered.filter((_, i) => body.actionIndexes!.includes(i))
    : ordered;
  if (!picked.length)
    return NextResponse.json({ ok: false, error: "Selecione ao menos uma ação." }, { status: 400 });

  // ---- geração
  const config = (form.config ?? {}) as Partial<FormConfig>;
  const currentSteps = (config.steps ?? []) as Field[];
  const endScreens = (config.endScreens ?? []) as EndScreen[];

  const gen = await generateOptimizedSteps({
    formName: form.name,
    steps: currentSteps,
    endScreens,
    diagnostico: insight.diagnostico,
    acoes: picked,
  });
  if (!gen.ok) return NextResponse.json({ ok: false, error: gen.error }, { status: 502 });

  // ---- grupo de leads: rótulo e nome da nova versão
  const group = await getLeadGroup(form);
  const groupId = leadGroupIdOf(form);
  const label = `v${group.length + 1}`;

  // tira um sufixo "— v2" que já exista, para não empilhar "— v2 — v3"
  const baseName = form.name.replace(/\s*—\s*v\d+$/i, "").trim() || form.name;
  const name = `${baseName} — ${label}`;

  const slugBase = `${slugify(baseName) || "formulario"}-${label}`;
  let slug = slugBase;
  for (let i = 2; i < 50; i++) {
    const { data: clash } = await sb.from("forms").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = `${slugBase}-${i}`;
  }

  const newConfig: Partial<FormConfig> = {
    ...config,
    steps: gen.result.steps,
    leadGroupId: groupId,
    variantLabel: label,
    derivedFromId: form.id,
    derivedFromInsightId: insightRow.id as string,
    appliedActions: picked.map((a) => a.titulo),
  };

  const { data: created, error } = await sb
    .from("forms")
    .insert({
      slug,
      name,
      config: newConfig,
      published: false,
      workspace_id: (form as { workspace_id?: string | null }).workspace_id ?? null,
    })
    .select("id,slug")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // ---- carimba o grupo no original, para a consulta do grupo ser uniforme
  if (!config.leadGroupId) {
    await sb
      .from("forms")
      .update({
        config: { ...config, leadGroupId: groupId, variantLabel: config.variantLabel || "v1" },
        updated_at: new Date().toISOString(),
      })
      .eq("id", form.id);
  }

  return NextResponse.json({
    ok: true,
    id: created.id,
    slug: created.slug,
    name,
    mudancas: gen.result.mudancas,
  });
}
