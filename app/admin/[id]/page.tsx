import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { getFormBySlug } from "@/lib/forms-db";
import type { FormConfig } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { TierBadge } from "@/components/TierBadge";

export const dynamic = "force-dynamic";

function labelFor(
  form: FormConfig | null,
  fieldId: string,
  value: unknown
): { question: string; answer: string; weight?: number } {
  const field = form?.steps.find((s) => s.id === fieldId);
  if (!field) return { question: fieldId, answer: String(value ?? "—") };
  const values = Array.isArray(value) ? value : [value];
  const opts = field.options ?? [];
  const parts = values.map((v) => {
    const opt = opts.find((o) => o.value === v);
    return opt ? opt.label : String(v ?? "—");
  });
  const weight = opts
    .filter((o) => values.includes(o.value))
    .reduce((s, o) => s + (o.weight ?? 0), 0);
  return {
    question: field.title,
    answer: parts.join(", ") || "—",
    weight: weight || undefined,
  };
}

export default async function LeadDetail({
  params,
}: {
  params: { id: string };
}) {
  if (!isAuthenticated()) redirect("/admin/login");
  if (!isSupabaseConfigured()) redirect("/admin");

  const supabase = getSupabaseAdmin()!;
  const { data } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data) notFound();

  const form = await getFormBySlug(data.form_slug);
  const answers: Record<string, unknown> = data.answers ?? {};
  const tracking: Record<string, unknown> = data.tracking ?? {};
  const trackingEntries = Object.entries(tracking);

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <Logo height={22} />
          <span className="lbl">Lead</span>
        </div>
        <Link href="/admin" className="text-sm text-[var(--text2)] hover:text-[var(--text)]">
          ← Voltar aos leads
        </Link>
      </header>

      <div className="mx-auto max-w-[760px] px-5 py-8 sm:px-8">
        {/* Cabeçalho do lead */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.6rem] font-black tracking-tight text-[var(--text)]">
                {data.nome || "Lead sem nome"}
              </h1>
              <div className="mt-2 space-y-0.5 text-sm text-[var(--text2)]">
                {data.email && <div>{data.email}</div>}
                {data.telefone && <div className="mono">{data.telefone}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[2.4rem] font-black leading-none tracking-tight text-[var(--text)]">
                {data.score}
              </div>
              <div className="lbl mt-1">Score</div>
              <div className="mt-2">
                <TierBadge tier={data.tier} />
              </div>
            </div>
          </div>
        </div>

        {/* Status de entrega no CRM */}
        {data.crm_status && data.crm_status !== "pending" && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="lbl">CRM</span>
            {data.crm_status === "delivered" ? (
              <span className="mono text-[0.72rem] text-[#3d7a00]">
                ✓ entregue{data.crm_attempts ? ` (${data.crm_attempts}ª tentativa)` : ""}
              </span>
            ) : (
              <span className="mono text-[0.72rem] text-[var(--red)]">
                falha ao enviar{data.crm_error ? ` — ${data.crm_error}` : ""}
              </span>
            )}
          </div>
        )}

        {/* Respostas */}
        <h2 className="lbl mt-8 mb-3 block">Respostas</h2>
        <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--card)]">
          {Object.keys(answers).length === 0 && (
            <div className="p-5 text-sm text-[var(--text2)]">Sem respostas.</div>
          )}
          {Object.entries(answers).map(([fieldId, value]) => {
            const { question, answer, weight } = labelFor(
              form,
              fieldId,
              value
            );
            return (
              <div key={fieldId} className="flex items-start justify-between gap-4 p-4">
                <div>
                  <div className="text-[0.8rem] text-[var(--text3)]">{question}</div>
                  <div className="mt-0.5 font-medium text-[var(--text)]">{answer}</div>
                </div>
                {typeof weight === "number" && (
                  <span className="mono shrink-0 rounded bg-[rgba(194,251,141,0.18)] px-2 py-1 text-[0.65rem] font-bold text-[#3d7a00]">
                    +{weight}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Rastreamento */}
        {trackingEntries.length > 0 && (
          <>
            <h2 className="lbl mt-8 mb-3 block">Origem / rastreamento</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {trackingEntries.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="mono text-[var(--text3)]">{k}</dt>
                    <dd className="truncate text-[var(--text2)]">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
