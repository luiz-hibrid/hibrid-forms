"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Field } from "@/lib/types";
import { TierBadge } from "@/components/TierBadge";
import { FieldTypeIcon, FIELD_META } from "@/components/FieldTypeIcon";
import { BrazilGeoMap } from "@/components/BrazilGeoMap";

interface Submission {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  answers: Record<string, unknown>;
  score: number;
  tier: string | null;
  status: string;
  stage: string;
  labels: string[];
  tracking: Record<string, string> | null;
  geo_uf: string | null;
  geo_city: string | null;
  geo_country: string | null;
  created_at: string;
  updated_at: string;
}

function shortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `há ${d} d`;
    return fmtDate(iso);
  } catch {
    return iso;
  }
}
interface Column {
  id: string;
  name: string;
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
function hasAnswer(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}
function answerText(field: Field, value: unknown): string {
  if (!hasAnswer(value)) return "—";
  const vals = Array.isArray(value) ? value : [value];
  if (field.options?.length) {
    return vals
      .map((v) => field.options!.find((o) => o.value === v)?.label ?? String(v))
      .join(", ");
  }
  return vals.join(", ");
}

export function ResultsView({
  formId,
  formName,
  formSlug,
  steps,
  kanbanColumns,
  submissions,
  stats,
}: {
  formId: string;
  formName: string;
  formSlug: string;
  steps: Field[];
  kanbanColumns: Column[];
  submissions: Submission[];
  stats: { views: number; starts: number };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<
    "summary" | "responses" | "map" | "kanban"
  >("summary");

  const responses = submissions.length;
  const completion = stats.views > 0 ? Math.round((responses / stats.views) * 100) : 0;

  return (
    <div className="w-full px-5 py-6 sm:px-8">
      {/* Sub-nav */}
      <div className="mb-6 inline-flex items-center gap-1 rounded-full bg-[var(--card)] p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <SubTab active={tab === "summary"} onClick={() => setTab("summary")}>Resumo</SubTab>
        <SubTab active={tab === "responses"} onClick={() => setTab("responses")}>Respostas</SubTab>
        <SubTab active={tab === "map"} onClick={() => setTab("map")}>Mapa</SubTab>
        <SubTab active={tab === "kanban"} onClick={() => setTab("kanban")}>Kanban</SubTab>
      </div>

      {tab === "summary" && (
        <Summary
          steps={steps}
          submissions={submissions}
          views={stats.views}
          starts={stats.starts}
          responses={responses}
          completion={completion}
        />
      )}
      {tab === "responses" && (
        <div className="-mx-5 sm:-mx-8">
          <Responses steps={steps} submissions={submissions} formSlug={formSlug} onChange={() => router.refresh()} />
        </div>
      )}
      {tab === "map" && <BrazilGeoMap submissions={submissions} />}
      {tab === "kanban" && (
        <Kanban
          formId={formId}
          steps={steps}
          initialColumns={kanbanColumns}
          submissions={submissions}
          onRefresh={() => router.refresh()}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Resumo
function Summary({
  steps,
  submissions,
  views,
  starts,
  responses,
  completion,
}: {
  steps: Field[];
  submissions: Submission[];
  views: number;
  starts: number;
  responses: number;
  completion: number;
}) {
  const perQuestion = steps.map((s) => {
    const answers = submissions.filter((sub) => hasAnswer(sub.answers?.[s.id])).length;
    return { field: s, answers };
  });
  const maxAns = Math.max(responses, 1);

  return (
    <div>
      {/* KPI band */}
      <div
        className="grid grid-cols-2 gap-4 rounded-2xl p-6 text-white sm:grid-cols-5"
        style={{ background: "#4b5735" }}
      >
        <Kpi n={views} label="Visualizações" />
        <Kpi n={starts} label="Iniciaram" />
        <Kpi n={responses} label="Respostas" />
        <Kpi n={`${completion}%`} label="Taxa de conclusão" />
        <Kpi n="—" label="Tempo médio" />
      </div>

      <div className="mt-6 mb-3 flex items-center justify-between">
        <span className="lbl">Resumo das respostas</span>
      </div>
      <div className="grid gap-3">
        {perQuestion.map(({ field, answers }, i) => {
          const dropoff =
            i === 0
              ? responses - answers
              : perQuestion[i - 1].answers - answers;
          const pct = maxAns ? Math.round((answers / maxAns) * 100) : 0;
          return (
            <div
              key={field.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 truncate font-medium text-[var(--text)]">
                  {field.title}
                </div>
                <div className="flex shrink-0 items-center gap-5 text-sm">
                  <span className="text-[var(--text2)]">
                    Respostas <b className="text-[var(--text)]">{answers}</b>
                  </span>
                  <span className="text-[var(--text2)]">
                    Abandono{" "}
                    <b className={dropoff > 0 ? "text-[var(--red)]" : "text-[var(--text)]"}>
                      {dropoff > 0 ? dropoff : 0}
                    </b>
                  </span>
                </div>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg)]">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ n, label }: { n: React.ReactNode; label: string }) {
  return (
    <div className="text-center">
      <div className="text-[1.9rem] font-black leading-none">{n}</div>
      <div className="mt-1.5 text-[0.72rem] opacity-80">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Respostas
function Responses({
  steps,
  submissions,
  formSlug,
  onChange,
}: {
  steps: Field[];
  submissions: Submission[];
  formSlug: string;
  onChange: () => void;
}) {
  const [q, setQ] = useState("");
  const [campaign, setCampaign] = useState("");

  const campaigns = useMemo(() => {
    const set = new Set<string>();
    submissions.forEach((s) => {
      const c = s.tracking?.utm_campaign;
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [submissions]);

  const rows = useMemo(() => {
    const t = q.toLowerCase();
    return submissions.filter((s) => {
      if (campaign && s.tracking?.utm_campaign !== campaign) return false;
      if (!t) return true;
      const blob = [
        s.nome,
        s.email,
        s.telefone,
        s.tracking?.utm_source,
        s.tracking?.utm_campaign,
        JSON.stringify(s.answers),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(t);
    });
  }, [q, campaign, submissions]);

  async function remove(id: string) {
    if (!confirm("Excluir esta resposta?")) return;
    const res = await fetch(`/api/admin/submissions/${id}`, { method: "DELETE" });
    if (res.ok) onChange();
    else alert("Não foi possível excluir.");
  }

  return (
    <div className="border-y border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nas respostas…"
            className="w-full max-w-[280px] rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm outline-none focus:border-[var(--acc2)]"
          />
          {campaigns.length > 0 && (
            <select
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text2)]"
            >
              <option value="">Todas as campanhas</option>
              {campaigns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="mono text-[0.72rem] text-[var(--text3)]">{rows.length} respostas</span>
          <a
            href={`/api/admin/export?form=${formSlug}`}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text2)] hover:border-[#bbb] hover:text-[var(--text)]"
          >
            Baixar CSV
          </a>
          <a
            href={`/api/admin/export-google?form=${formSlug}`}
            title="CSV de conversões offline (leads qualificados com gclid) para upload no Google Ads"
            className="rounded-full bg-[var(--text)] px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
          >
            Conversões Google
          </a>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm [&_td]:border-r [&_td]:border-[var(--border)] [&_th]:border-r [&_th]:border-[var(--border)] [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">

          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg)] text-left">
              <Th>
                <HdrIcon d="M12 8v4l3 2" circle /> Enviado
              </Th>
              <Th>
                <HdrIcon d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1" /> ID
              </Th>
              <Th>
                <HdrIcon d="M20 6L9 17l-5-5" /> Status
              </Th>
              <Th>
                <HdrIcon d="M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20" /> Origem
              </Th>
              <Th>
                <HdrIcon d="M4 4h16v4H4zM4 12h10v8H4z" /> Campanha
              </Th>
              {steps.map((s) => (
                <Th key={s.id}>
                  <span className="inline-flex items-center gap-1.5">
                    <FieldTypeIcon type={s.type} size={16} />
                    {s.title}
                  </span>
                </Th>
              ))}
              <Th className="text-right">Score</Th>
              <Th>Faixa</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={steps.length + 8} className="px-4 py-12 text-center text-[var(--text2)]">
                  Nenhuma resposta ainda. Aparecem aqui assim que alguém responder.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]">
                <td className="whitespace-nowrap px-4 py-3 mono text-[0.72rem] text-[var(--text3)]">
                  {fmtDate(r.created_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 mono text-[0.7rem] text-[var(--text3)]">
                  {r.id.slice(0, 8)}
                </td>
                <td className="px-4 py-3">
                  <span className="mono rounded-full bg-[rgba(194,251,141,0.2)] px-2 py-0.5 text-[0.55rem] font-bold uppercase text-[#3d7a00]">
                    {r.status === "complete" ? "Completa" : "Parcial"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--text2)]">
                  {r.tracking?.utm_source || (r.tracking?.gclid ? "google/ads" : "—")}
                </td>
                <td className="max-w-[180px] truncate px-4 py-3 text-[var(--text2)]" title={r.tracking?.utm_campaign || ""}>
                  {r.tracking?.utm_campaign || "—"}
                </td>
                {steps.map((s) => (
                  <td key={s.id} className="max-w-[200px] truncate px-4 py-3 text-[var(--text2)]" title={answerText(s, r.answers?.[s.id])}>
                    {answerText(s, r.answers?.[s.id])}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-black tabular-nums text-[var(--text)]">{r.score}</td>
                <td className="px-4 py-3"><TierBadge tier={r.tier} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Link href={`/admin/${r.id}`} className="mono text-[0.72rem] text-[var(--text2)] hover:text-[var(--text)] hover:underline">ver</Link>
                  <button onClick={() => remove(r.id)} className="ml-3 text-[var(--text3)] hover:text-[var(--red)]" aria-label="Excluir">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Kanban
function Kanban({
  formId,
  steps,
  initialColumns,
  submissions,
  onRefresh,
}: {
  formId: string;
  steps: Field[];
  initialColumns: Column[];
  submissions: Submission[];
  onRefresh: () => void;
}) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [cards, setCards] = useState<Submission[]>(submissions);
  const [dragId, setDragId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = cards.find((c) => c.id === selectedId) ?? null;

  async function updateLabels(id: string, labels: string[]) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, labels } : c)));
    await fetch(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labels }),
    });
  }

  const firstCol = columns[0]?.id ?? "nao_iniciado";
  function colOf(s: Submission): string {
    return columns.some((c) => c.id === s.stage) ? s.stage : firstCol;
  }

  async function saveColumns(next: Column[]) {
    setColumns(next);
    await fetch(`/api/admin/forms/${formId}/kanban`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columns: next }),
    });
  }
  function setColumnName(id: string, name: string) {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }
  async function persistColumns() {
    await fetch(`/api/admin/forms/${formId}/kanban`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columns }),
    });
  }

  async function moveCard(id: string, stage: string) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, stage } : c)));
    await fetch(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
  }

  function addColumn() {
    const name = prompt("Nome da nova coluna:");
    if (!name) return;
    const id = `col_${Math.random().toString(36).slice(2, 7)}`;
    saveColumns([...columns, { id, name }]);
  }
  function renameColumn(id: string) {
    const col = columns.find((c) => c.id === id);
    const name = prompt("Renomear coluna:", col?.name);
    if (!name) return;
    saveColumns(columns.map((c) => (c.id === id ? { ...c, name } : c)));
  }
  function removeColumn(id: string) {
    if (columns.length <= 1) return;
    if (!confirm("Remover esta coluna? Os leads voltam para a primeira.")) return;
    saveColumns(columns.filter((c) => c.id !== id));
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="lbl">Kanban</span>
        <div className="flex items-center gap-2">
          <RoundBtn label="Atualizar" onClick={onRefresh}>↻</RoundBtn>
          <RoundBtn label="Filtrar" onClick={() => {}}>⧩</RoundBtn>
          <RoundBtn label="Adicionar coluna" onClick={addColumn}>＋</RoundBtn>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colCards = cards.filter((c) => colOf(c) === col.id);
          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) moveCard(dragId, col.id);
                setDragId(null);
              }}
              className="flex max-h-[75vh] w-[310px] shrink-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3"
            >
              <div className="mb-3 flex items-center gap-2">
                <input
                  value={col.name}
                  onChange={(e) => setColumnName(col.id, e.target.value)}
                  onBlur={() => persistColumns()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="mono min-w-0 flex-1 rounded bg-transparent px-1 text-[0.62rem] font-bold uppercase tracking-wider text-[var(--text2)] outline-none hover:bg-[var(--bg)] focus:bg-[var(--bg)]"
                  title="Clique para renomear"
                />
                <span className="inline-flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-md bg-[var(--text)] px-1.5 text-xs font-bold text-white">
                  {colCards.length}
                </span>
                {columns.length > 1 && (
                  <button
                    onClick={() => removeColumn(col.id)}
                    className="shrink-0 text-[var(--text3)] transition hover:text-[var(--red)]"
                    aria-label="Excluir coluna"
                    title="Excluir coluna"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H7a1 1 0 01-1-1V6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {colCards.length === 0 && (
                  <div className="flex flex-1 flex-col items-center justify-center rounded-xl bg-[var(--bg)] py-16 text-center">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-[var(--text3)]">
                      <rect x="3" y="4" width="5" height="16" rx="1.2" />
                      <rect x="9.5" y="4" width="5" height="16" rx="1.2" />
                      <rect x="16" y="4" width="5" height="16" rx="1.2" />
                    </svg>
                    <span className="mt-2 text-xs text-[var(--text3)]">Sem leads nesta etapa</span>
                  </div>
                )}
                {colCards.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setSelectedId(c.id)}
                    className={`cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition hover:border-[#ccc] hover:shadow-md ${
                      dragId === c.id ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="mono truncate text-[0.6rem] text-[var(--text3)]">
                        #{c.id.slice(0, 10)}
                      </span>
                      <span className="mono shrink-0 text-[0.6rem] text-[var(--text3)]">
                        {shortDate(c.created_at)}
                      </span>
                    </div>
                    <div className="mt-1 truncate font-bold text-[var(--text)]">{c.nome || "Lead"}</div>
                    {c.telefone && (
                      <div className="truncate text-sm text-[var(--text2)]">{c.telefone}</div>
                    )}
                    {c.email && (
                      <div className="truncate text-sm text-[var(--text2)]">{c.email}</div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {c.status === "complete" && (
                        <span className="mono rounded-full bg-[rgba(194,251,141,0.25)] px-2 py-0.5 text-[0.55rem] font-bold uppercase text-[#3d7a00]">
                          🎉 Completa
                        </span>
                      )}
                      <TierBadge tier={c.tier} />
                      <span className="mono text-[0.6rem] text-[var(--text3)]">
                        {relativeTime(c.created_at)}
                      </span>
                    </div>
                    {c.labels?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.labels.map((l) => (
                          <span key={l} className="mono rounded bg-[var(--bg)] px-1.5 py-0.5 text-[0.55rem] text-[var(--text2)]">
                            {l}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <LeadModal
          submission={selected}
          steps={steps}
          columns={columns}
          onClose={() => setSelectedId(null)}
          onStage={(stage) => moveCard(selected.id, stage)}
          onLabels={(labels) => updateLabels(selected.id, labels)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Modal do lead
function LeadModal({
  submission,
  steps,
  columns,
  onClose,
  onStage,
  onLabels,
}: {
  submission: Submission;
  steps: Field[];
  columns: Column[];
  onClose: () => void;
  onStage: (stage: string) => void;
  onLabels: (labels: string[]) => void;
}) {
  const [labelInput, setLabelInput] = useState("");
  const answered = steps.filter((s) => hasAnswer(submission.answers?.[s.id]));

  function addLabel() {
    const v = labelInput.trim();
    if (!v || submission.labels.includes(v)) return;
    onLabels([...submission.labels, v]);
    setLabelInput("");
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-[1000px] flex-col overflow-hidden rounded-2xl bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <span className="mono text-[0.62rem] uppercase tracking-wider text-[var(--text2)]">
            Detalhes da resposta · #{submission.id.slice(0, 12).toUpperCase()}
          </span>
          <button onClick={onClose} className="text-[var(--text3)] hover:text-[var(--text)]">✕</button>
        </div>

        <div className="grid flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_300px]">
          {/* Campos */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="lbl">Campos da resposta</span>
              <span className="mono rounded-full bg-[var(--bg)] px-2 py-0.5 text-[0.62rem] text-[var(--text2)]">
                {steps.length}
              </span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-start gap-3 py-3">
                  <NumberedIcon type={s.type} n={i + 1} />
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--text)]">{s.title}</div>
                    <div className="mt-0.5 text-[var(--text2)]">
                      {answerText(s, submission.answers?.[s.id])}
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 py-3">
                <span className="mono rounded bg-[rgba(194,251,141,0.25)] px-2 py-1 text-[0.62rem] font-bold text-[#3d7a00]">
                  # score
                </span>
                <span className="text-[var(--text2)]">{submission.score}</span>
                <TierBadge tier={submission.tier} />
              </div>
            </div>
          </div>

          {/* Propriedades + Labels */}
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="mono mb-3 text-[0.6rem] uppercase tracking-wider text-[var(--text3)]">
                Propriedades
              </div>
              <Row label="Status">
                <span className="mono rounded-full bg-[rgba(194,251,141,0.2)] px-2 py-0.5 text-[0.55rem] font-bold uppercase text-[#3d7a00]">
                  {submission.status === "complete" ? "Completa" : "Parcial"}
                </span>
              </Row>
              <Row label="Estágio">
                <select
                  value={columns.some((c) => c.id === submission.stage) ? submission.stage : columns[0]?.id}
                  onChange={(e) => onStage(e.target.value)}
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm"
                >
                  {columns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Row>
              <Row label="Enviado">
                <span className="text-sm text-[var(--text2)]">{relativeTime(submission.created_at)}</span>
              </Row>
              <Row label="Atualizado">
                <span className="text-sm text-[var(--text2)]">{relativeTime(submission.updated_at)}</span>
              </Row>
            </div>

            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="mono mb-3 text-[0.6rem] uppercase tracking-wider text-[var(--text3)]">
                Labels
              </div>
              <input
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLabel();
                  }
                }}
                placeholder="Digite e pressione Enter"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--acc2)]"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {submission.labels.length === 0 && (
                  <span className="text-sm text-[var(--text3)]">Nenhum ainda</span>
                )}
                {submission.labels.map((l) => (
                  <span key={l} className="inline-flex items-center gap-1 rounded-full bg-[var(--bg)] px-2.5 py-1 text-xs text-[var(--text2)]">
                    {l}
                    <button
                      onClick={() => onLabels(submission.labels.filter((x) => x !== l))}
                      className="text-[var(--text3)] hover:text-[var(--red)]"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberedIcon({ type, n }: { type: Field["type"]; n: number }) {
  const m = FIELD_META[type] ?? FIELD_META.text;
  return (
    <span
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
      style={{ background: m.color }}
    >
      <span className="absolute left-1 top-0.5 text-[0.52rem] font-bold leading-none text-white/85">{n}</span>
      <span style={{ fontSize: 15 }}>{m.icon}</span>
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3 last:mb-0">
      <span className="text-sm text-[var(--text2)]">{label}</span>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- helpers UI
function SubTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active ? "bg-[var(--text)] text-white" : "text-[var(--text2)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}
function RoundBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--text2)] transition hover:border-[#bbb] hover:text-[var(--text)]"
    >
      {children}
    </button>
  );
}
function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`mono whitespace-nowrap px-4 py-3 text-[0.6rem] font-normal uppercase tracking-wider text-[var(--text3)] ${className}`}>
      <span className="inline-flex items-center gap-1.5">{children}</span>
    </th>
  );
}

function HdrIcon({ d, circle }: { d: string; circle?: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
      {circle && <circle cx="12" cy="12" r="9" />}
      <path d={d} />
    </svg>
  );
}
