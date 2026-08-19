import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { getFormRow, getLeadGroup, mergeGroupSteps } from "@/lib/forms-db";
import type { Field } from "@/lib/types";
import { FormResultsTopBar } from "@/components/FormResultsTopBar";
import { ResultsView } from "@/components/ResultsView";

export const dynamic = "force-dynamic";

const DEFAULT_KANBAN = [
  { id: "nao_iniciado", name: "Não iniciado" },
  { id: "em_andamento", name: "Em andamento" },
  { id: "feito", name: "Feito" },
];

export default async function ResultsPage({
  params,
}: {
  params: { id: string };
}) {
  const s = getSession();
  if (!s) redirect("/admin/login");
  if (!isSupabaseConfigured()) redirect("/admin/forms");

  const scope = s.role === "client" ? s.workspaceId : null;
  const form = await getFormRow(params.id, scope);
  if (!form) notFound();

  const steps = ((form.config as any)?.steps ?? []) as Field[];
  const kanban = ((form.config as any)?.kanban ?? DEFAULT_KANBAN) as {
    id: string;
    name: string;
  }[];

  const trackDropoff = !!(form.config as any)?.trackDropoff;

  const sb = getSupabaseAdmin()!;

  // Versões que dividem a base de leads (só o próprio, quando não há grupo).
  const group = await getLeadGroup(form);
  const groupSlugs = group.map((g) => g.slug);

  const { data: subs } = await sb
    .from("submissions")
    .select(
      "id,form_slug,nome,email,telefone,answers,score,tier,qualified,status,stage,labels,tracking,geo_uf,geo_city,geo_country,gads_status,gads_error,gads_sent_at,duration_ms,device,created_at,updated_at"
    )
    .in("form_slug", groupSlugs)
    .order("created_at", { ascending: false })
    .limit(1000);

  // Visualizações e inícios são por versão — o Resumo compara, não soma.
  const eventCounts = await Promise.all(
    groupSlugs.map(async (slug) => {
      const [{ count: v }, { count: st }] = await Promise.all([
        sb.from("form_events").select("id", { count: "exact", head: true }).eq("form_slug", slug).eq("type", "view"),
        sb.from("form_events").select("id", { count: "exact", head: true }).eq("form_slug", slug).eq("type", "start"),
      ]);
      return { slug, views: v ?? 0, starts: st ?? 0 };
    })
  );
  const own = eventCounts.find((e) => e.slug === form.slug);
  const views = own?.views ?? 0;
  const starts = own?.starts ?? 0;

  const variantStats = group.map((m) => {
    const ev = eventCounts.find((e) => e.slug === m.slug);
    const mine = (subs ?? []).filter((r: any) => r.form_slug === m.slug && r.status === "complete");
    return {
      slug: m.slug,
      id: m.id,
      name: m.name,
      label: m.variantLabel,
      published: m.published,
      views: ev?.views ?? 0,
      starts: ev?.starts ?? 0,
      responses: mine.length,
      qualified: mine.filter((r: any) => r.qualified).length,
    };
  });

  // Tempo médio de preenchimento desta versão (só dos concluídos que têm duração)
  const durations = (subs ?? [])
    .filter((s: any) => s.form_slug === form.slug)
    .map((s: any) => s.duration_ms)
    .filter((d: any) => typeof d === "number" && d > 0);
  const avgMs = durations.length
    ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
    : null;

  // Funil de abandono: sessões distintas que alcançaram cada pergunta
  const reached: Record<string, number> = {};
  if (trackDropoff) {
    const { data: stepEvents } = await sb
      .from("form_events")
      .select("step,session")
      .eq("form_slug", form.slug)
      .eq("type", "step")
      .limit(20000);
    const perStep: Record<string, Set<string>> = {};
    (stepEvents ?? []).forEach((e: any) => {
      if (!e.step) return;
      (perStep[e.step] ??= new Set()).add(e.session ?? Math.random().toString());
    });
    Object.entries(perStep).forEach(([k, v]) => (reached[k] = v.size));
  }

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <FormResultsTopBar formId={form.id} formName={form.name} canManage={s.role === "master"} />
      <ResultsView
        formId={form.id}
        formName={form.name}
        formSlug={form.slug}
        steps={steps.filter((s) => s.type !== "welcome")}
        tableSteps={mergeGroupSteps(group, form.slug)}
        kanbanColumns={kanban}
        submissions={(subs ?? []) as any[]}
        stats={{ views, starts, avgMs }}
        reached={trackDropoff ? reached : null}
        variants={variantStats}
        groupSlugs={groupSlugs}
      />
    </main>
  );
}
