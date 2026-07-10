import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { getFormRow } from "@/lib/forms-db";
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
  const { data: subs } = await sb
    .from("submissions")
    .select(
      "id,nome,email,telefone,answers,score,tier,qualified,status,stage,labels,tracking,geo_uf,geo_city,geo_country,gads_status,gads_error,gads_sent_at,duration_ms,created_at,updated_at"
    )
    .eq("form_slug", form.slug)
    .order("created_at", { ascending: false })
    .limit(1000);

  const [{ count: views }, { count: starts }] = await Promise.all([
    sb.from("form_events").select("id", { count: "exact", head: true }).eq("form_slug", form.slug).eq("type", "view"),
    sb.from("form_events").select("id", { count: "exact", head: true }).eq("form_slug", form.slug).eq("type", "start"),
  ]);

  // Tempo médio de preenchimento (só dos concluídos que têm duração)
  const durations = (subs ?? [])
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
        kanbanColumns={kanban}
        submissions={(subs ?? []) as any[]}
        stats={{ views: views ?? 0, starts: starts ?? 0, avgMs }}
        reached={trackDropoff ? reached : null}
      />
    </main>
  );
}
