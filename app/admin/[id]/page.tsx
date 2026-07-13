import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
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
  const s = getSession();
  if (!s) redirect("/admin/login");
  if (!isSupabaseConfigured()) redirect("/admin");

  const supabase = getSupabaseAdmin()!;
  const { data } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data) notFound();
  // cliente só acessa leads do próprio workspace
  if (s.role === "client" && data.workspace_id !== s.workspaceId) notFound();

  const { data: formMeta } = await supabase
    .from("forms")
    .select("id")
    .eq("slug", data.form_slug)
    .maybeSingle();
  const backHref = formMeta?.id
    ? `/admin/forms/${formMeta.id}/respostas`
    : "/admin/forms";

  const form = await getFormBySlug(data.form_slug);
  const answers: Record<string, unknown> = data.answers ?? {};
  const tracking: Record<string, unknown> = data.tracking ?? {};
  const trackingEntries = Object.entries(tracking);

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <Link href="/admin/forms" aria-label="Início" className="transition hover:opacity-80">
            <Logo height={29} />
          </Link>
          <span className="lbl">Lead</span>
        </div>
        <Link href={backHref} className="text-sm text-[var(--text2)] hover:text-[var(--text)]">
          ← Voltar às respostas
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
              {data.telefone &&
                (() => {
                  const d = String(data.telefone).replace(/\D/g, "");
                  const num = d.length <= 11 ? `55${d}` : d;
                  const first = (data.nome || "").trim().split(" ")[0] || "";
                  const msg = encodeURIComponent(
                    `Olá${first ? ` ${first}` : ""}! Recebi seu contato pelo formulário da Hibrid.`
                  );
                  return (
                    <a
                      href={`https://wa.me/${num}?text=${msg}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.8 14.03c-.24.68-1.42 1.31-1.95 1.35-.5.05-.97.24-3.27-.68-2.77-1.09-4.53-3.92-4.67-4.11-.14-.19-1.13-1.5-1.13-2.86 0-1.36.71-2.03.96-2.31.25-.27.55-.34.73-.34.18 0 .37 0 .53.01.17.01.4-.06.62.48.24.56.81 1.96.88 2.1.07.14.12.31.02.5-.09.19-.14.31-.28.47-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.27.71 1.17 1.53 1.9 1.05.93 1.93 1.22 2.21 1.36.28.14.44.12.6-.07.17-.19.69-.81.87-1.09.18-.28.36-.23.61-.14.25.09 1.6.75 1.87.89.28.14.46.21.53.32.07.12.07.68-.17 1.36z" />
                      </svg>
                      Falar no WhatsApp
                    </a>
                  );
                })()}
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
