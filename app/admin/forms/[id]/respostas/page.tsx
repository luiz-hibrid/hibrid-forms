import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { getFormRow } from "@/lib/forms-db";
import type { Field } from "@/lib/types";
import { AdminHeader } from "@/components/AdminHeader";
import { TierBadge } from "@/components/TierBadge";

export const dynamic = "force-dynamic";

interface Submission {
  id: string;
  answers: Record<string, unknown>;
  score: number;
  tier: string | null;
  created_at: string;
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function answerLabel(field: Field, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  const values = Array.isArray(value) ? value : [value];
  if (field.options?.length) {
    return values
      .map((v) => field.options!.find((o) => o.value === v)?.label ?? String(v))
      .join(", ");
  }
  return values.join(", ");
}

export default async function FormResponsesPage({
  params,
}: {
  params: { id: string };
}) {
  if (!isAuthenticated()) redirect("/admin/login");
  if (!isSupabaseConfigured()) redirect("/admin/forms");

  const form = await getFormRow(params.id);
  if (!form) notFound();

  const steps = ((form.config as any)?.steps ?? []) as Field[];
  const questionCols = steps.filter((s) => s.type !== "welcome");

  const sb = getSupabaseAdmin()!;
  const { data } = await sb
    .from("submissions")
    .select("id,answers,score,tier,created_at")
    .eq("form_slug", form.slug)
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = (data ?? []) as Submission[];

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <AdminHeader />
      <div className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8">
        {/* Cabeçalho do formulário */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/admin/forms"
              className="mono text-[0.72rem] text-[var(--text3)] hover:text-[var(--text)]"
            >
              ← Formulários
            </Link>
            <h1 className="mt-1 text-[1.5rem] font-black tracking-tight text-[var(--text)]">
              {form.name}
            </h1>
            <div className="mono mt-1 text-[11px] text-[var(--text3)]">
              {rows.length} respostas · /f/{form.slug}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/forms/${form.id}`}
              className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text2)] transition hover:border-[#bbb] hover:text-[var(--text)]"
            >
              Editar formulário
            </Link>
            <a
              href={`/api/admin/export?form=${form.slug}`}
              className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text2)] transition hover:border-[#bbb] hover:text-[var(--text)]"
            >
              Exportar CSV
            </a>
          </div>
        </div>

        {/* Tabela de respostas */}
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <Th>Data</Th>
                  {questionCols.map((q) => (
                    <Th key={q.id}>{q.title}</Th>
                  ))}
                  <Th className="text-right">Score</Th>
                  <Th>Faixa</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={questionCols.length + 4}
                      className="px-4 py-10 text-center text-[var(--text2)]"
                    >
                      Nenhuma resposta ainda.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--border)] last:border-0 transition hover:bg-[var(--bg)]"
                  >
                    <td className="whitespace-nowrap px-4 py-3 mono text-[0.72rem] text-[var(--text3)]">
                      {fmtDate(r.created_at)}
                    </td>
                    {questionCols.map((q) => (
                      <td
                        key={q.id}
                        className="max-w-[220px] truncate px-4 py-3 text-[var(--text2)]"
                        title={answerLabel(q, r.answers?.[q.id])}
                      >
                        {answerLabel(q, r.answers?.[q.id])}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-black tabular-nums text-[var(--text)]">
                      {r.score}
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge tier={r.tier} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/admin/${r.id}`}
                        className="mono text-[0.72rem] text-[var(--text2)] underline-offset-2 hover:text-[var(--text)] hover:underline"
                      >
                        ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`mono whitespace-nowrap px-4 py-3 text-[0.6rem] font-normal uppercase tracking-wider text-[var(--text3)] ${className}`}
    >
      {children}
    </th>
  );
}
