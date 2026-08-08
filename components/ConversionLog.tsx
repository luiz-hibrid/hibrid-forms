"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DESTINATION_LABEL,
  STATUS_LABEL,
  TRIGGER_LABEL,
  type ConversionEvent,
} from "@/lib/conversion-log";

// ============================================================
// Histórico de disparos. Duas superfícies, mesma fonte:
//   variant="timeline" → linha do tempo dentro do detalhe do lead
//   variant="table"    → log operacional do formulário, com filtros
// ============================================================

const STATUS_STYLE: Record<string, { dot: string; chip: string }> = {
  sent: { dot: "var(--accent)", chip: "bg-[rgba(194,251,141,0.25)] text-[#3d7a00]" },
  failed: { dot: "var(--red)", chip: "bg-[rgba(255,69,69,0.1)] text-[var(--red)]" },
  skipped: { dot: "#d3d7cb", chip: "bg-[var(--bg)] text-[var(--text3)]" },
};

interface LogData {
  events: ConversionEvent[];
  actors: Record<string, string>;
  leads: Record<string, string>;
}

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Detalhes relevantes do disparo, em texto curto. */
function detailLine(e: ConversionEvent): string | null {
  const d = e.detail ?? {};
  const err = d.error as string | undefined;
  if (err) return err;
  const parts: string[] = [];
  if (d.conversion_action_id) parts.push(`ação ${d.conversion_action_id}`);
  if (typeof d.valor === "number") parts.push(`valor ${d.valor}`);
  if (d.tentativas) parts.push(`${d.tentativas} tentativa(s)`);
  if (Array.isArray(d.destinatarios)) parts.push((d.destinatarios as string[]).join(", "));
  if (d.motivo) parts.push(String(d.motivo));
  return parts.length ? parts.join(" · ") : null;
}

function useLog(params: { submissionId?: string; formId?: string; destination?: string; status?: string }) {
  const { submissionId, formId, destination, status } = params;
  const [data, setData] = useState<LogData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams();
    if (submissionId) qs.set("submission", submissionId);
    if (formId) qs.set("form", formId);
    if (destination) qs.set("destination", destination);
    if (status) qs.set("status", status);

    setLoading(true);
    fetch(`/api/admin/conversion-log?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setData(d.ok ? { events: d.events ?? [], actors: d.actors ?? {}, leads: d.leads ?? {} } : null);
      })
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [submissionId, formId, destination, status]);

  return { data, loading };
}

// ---------------------------------------------------------------- timeline

export function ConversionTimeline({ submissionId }: { submissionId: string }) {
  const { data, loading } = useLog({ submissionId });

  if (loading) {
    return <p className="text-[0.75rem] text-[var(--text3)]">Carregando histórico…</p>;
  }
  if (!data || data.events.length === 0) {
    return (
      <p className="text-[0.75rem] leading-relaxed text-[var(--text3)]">
        Nenhum disparo registrado para este lead.
      </p>
    );
  }

  return (
    <ol className="flex flex-col">
      {data.events.map((e, i) => {
        const st = STATUS_STYLE[e.status] ?? STATUS_STYLE.skipped;
        const actor = e.actor_user_id ? data.actors[e.actor_user_id] : null;
        const detail = detailLine(e);
        const last = i === data.events.length - 1;
        return (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* trilho */}
            <div className="flex flex-col items-center">
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-[var(--card)]"
                style={{ background: st.dot }}
              />
              {!last && <span className="w-px flex-1 bg-[var(--border)]" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[0.82rem] font-bold text-[var(--text)]">
                  {DESTINATION_LABEL[e.destination] ?? e.destination}
                </span>
                <span
                  className={`mono rounded-full px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide ${st.chip}`}
                >
                  {STATUS_LABEL[e.status] ?? e.status}
                </span>
                <span className="mono text-[0.6rem] text-[var(--text3)]">{fmt(e.created_at)}</span>
              </div>
              <p className="mt-0.5 text-[0.72rem] text-[var(--text2)]">
                {TRIGGER_LABEL[e.trigger] ?? e.trigger}
                {actor ? ` — ${actor}` : ""}
              </p>
              {detail && (
                <p className="mono mt-1 break-words text-[0.65rem] leading-relaxed text-[var(--text3)]">
                  {detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- tabela

export function ConversionLogTable({
  formId,
  initialStatus,
}: {
  formId: string;
  initialStatus?: string;
}) {
  const [destination, setDestination] = useState("");
  const [status, setStatus] = useState(initialStatus ?? "");
  const { data, loading } = useLog({ formId, destination, status });

  const counts = useMemo(() => {
    const c = { sent: 0, failed: 0, skipped: 0 };
    (data?.events ?? []).forEach((e) => {
      if (e.status in c) c[e.status as keyof typeof c] += 1;
    });
    return c;
  }, [data]);

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="dash-in rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <span className="lbl">Histórico de envios</span>
            <p className="mt-1 text-[0.75rem] text-[var(--text2)]">
              Cada tentativa de envio para as integrações — inclusive as que falharam.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[0.78rem] text-[var(--text2)]"
            >
              <option value="">Todos os destinos</option>
              {Object.entries(DESTINATION_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[0.78rem] text-[var(--text2)]"
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </header>

        {!status && !destination && (data?.events.length ?? 0) > 0 && (
          <div className="mono flex flex-wrap gap-4 border-b border-[var(--border)] px-5 py-3 text-[0.65rem] uppercase tracking-wider text-[var(--text3)]">
            <span>
              <b className="text-[var(--text)]">{counts.sent}</b> enviados
            </span>
            <span>
              <b className={counts.failed ? "text-[var(--red)]" : "text-[var(--text)]"}>
                {counts.failed}
              </b>{" "}
              falharam
            </span>
            <span>
              <b className="text-[var(--text)]">{counts.skipped}</b> ignorados
            </span>
          </div>
        )}

        {loading && (
          <p className="px-5 py-12 text-center text-[0.8rem] text-[var(--text3)]">Carregando…</p>
        )}

        {!loading && (data?.events.length ?? 0) === 0 && (
          <p className="px-5 py-12 text-center text-[0.8rem] leading-relaxed text-[var(--text3)]">
            Nenhum disparo registrado ainda com estes filtros.
          </p>
        )}

        {!loading && (data?.events.length ?? 0) > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.82rem]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                  <Th>Quando</Th>
                  <Th>Lead</Th>
                  <Th>Destino</Th>
                  <Th>Gatilho</Th>
                  <Th>Status</Th>
                  <Th>Detalhe</Th>
                </tr>
              </thead>
              <tbody>
                {data!.events.map((e) => {
                  const st = STATUS_STYLE[e.status] ?? STATUS_STYLE.skipped;
                  const actor = e.actor_user_id ? data!.actors[e.actor_user_id] : null;
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]"
                    >
                      <td className="mono whitespace-nowrap px-4 py-3 text-[0.7rem] text-[var(--text3)]">
                        {fmt(e.created_at)}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-[var(--text)]">
                        {e.submission_id ? data!.leads[e.submission_id] ?? "—" : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--text2)]">
                        {DESTINATION_LABEL[e.destination] ?? e.destination}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--text2)]">
                        {TRIGGER_LABEL[e.trigger] ?? e.trigger}
                        {actor && (
                          <span className="block text-[0.68rem] text-[var(--text3)]">{actor}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`mono rounded-full px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide ${st.chip}`}
                        >
                          {STATUS_LABEL[e.status] ?? e.status}
                        </span>
                      </td>
                      <td className="mono max-w-[280px] truncate px-4 py-3 text-[0.68rem] text-[var(--text3)]">
                        {detailLine(e) ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="mono px-4 py-2.5 text-[0.6rem] font-bold uppercase tracking-wider text-[var(--text3)]">
      {children}
    </th>
  );
}
