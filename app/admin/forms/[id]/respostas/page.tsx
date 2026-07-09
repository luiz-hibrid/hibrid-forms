import { redirect, notFound } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
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
  if (!isAuthenticated()) redirect("/admin/login");
  if (!isSupabaseConfigured()) redirect("/admin/forms");

  const form = await getFormRow(params.id);
  if (!form) notFound();

  const steps = ((form.config as any)?.steps ?? []) as Field[];
  const kanban = ((form.config as any)?.kanban ?? DEFAULT_KANBAN) as {
    id: string;
    name: string;
  }[];

  const sb = getSupabaseAdmin()!;
  const { data: subs } = await sb
    .from("submissions")
    .select(
      "id,nome,email,telefone,answers,score,tier,status,stage,labels,tracking,geo_uf,geo_city,geo_country,created_at,updated_at"
    )
    .eq("form_slug", form.slug)
    .order("created_at", { ascending: false })
    .limit(1000);

  const [{ count: views }, { count: starts }] = await Promise.all([
    sb.from("form_events").select("id", { count: "exact", head: true }).eq("form_slug", form.slug).eq("type", "view"),
    sb.from("form_events").select("id", { count: "exact", head: true }).eq("form_slug", form.slug).eq("type", "start"),
  ]);

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <FormResultsTopBar formId={form.id} formName={form.name} />
      <ResultsView
        formId={form.id}
        formName={form.name}
        formSlug={form.slug}
        steps={steps.filter((s) => s.type !== "welcome")}
        kanbanColumns={kanban}
        submissions={(subs ?? []) as any[]}
        stats={{ views: views ?? 0, starts: starts ?? 0 }}
      />
    </main>
  );
}
