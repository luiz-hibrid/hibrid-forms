"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Field } from "@/lib/types";
import { TierBadge } from "@/components/TierBadge";
import { FieldTypeIcon } from "@/components/FieldTypeIcon";

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
  created_at: string;
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
  const [tab, setTab] = useState<"summary" | "responses" | "kanban">("summary");

  const responses = submissions.length;
  const completion = stats.views > 0 ? Math.round((responses / stats.views) * 100) : 0;

  return (
    <div className="w-full px-5 py-6 sm:px-8">
      {/* Sub-nav */}
      <div className="mb-6 inline-flex items-center gap-1 rounded-full bg-[var(--card)] p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <SubTab active={tab === "summary"} onClick={() => setTab("summary")}>Resumo</SubTab>
        <SubTab active={tab === "responses"} onClick={() => setTab("responses")}>Respostas</SubTab>
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
      {tab === "kanban" && (
        <Kanban
          formId={formId}
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
  const rows = useMemo(() => {
    if (!q) return submissions;
    const t = q.toLowerCase();
    return submissions.filter((s) => {
      const blob = [s.nome, s.email, s.telefone, JSON.stringify(s.answers)]
        .join(" ")
        .toLowerCase();
      return blob.includes(t);
    });
  }, [q, submissions]);

  async function remove(id: string) {
    if (!confirm("Excluir esta resposta?")) return;
    const res = await fetch(`/api/admin/submissions/${id}`, { method: "DELETE" });
    if (res.ok) onChange();
    else alert("Não foi possível excluir.");
  }

  return (
    <div className="border-y border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3 sm:px-8">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nas respostas…"
          className="w-full max-w-[320px] rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm outline-none focus:border-[var(--acc2)]"
        />
        <div className="flex items-center gap-2">
          <span className="mono text-[0.72rem] text-[var(--text3)]">{rows.length} respostas</span>
          <a
            href={`/api/admin/export?form=${formSlug}`}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text2)] hover:border-[#bbb] hover:text-[var(--text)]"
          >
            Baixar CSV
          </a>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
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
                <td colSpan={steps.length + 6} className="px-4 py-12 text-center text-[var(--text2)]">
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
  initialColumns,
  submissions,
  onRefresh,
}: {
  formId: string;
  initialColumns: Column[];
  submissions: Submission[];
  onRefresh: () => void;
}) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [cards, setCards] = useState<Submission[]>(submissions);
  const [dragId, setDragId] = useState<string | null>(null);

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
              className="flex max-h-[70vh] w-[300px] shrink-0 flex-col rounded-2xl bg-[var(--bg)] p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <button
                  onDoubleClick={() => renameColumn(col.id)}
                  className="mono text-[0.62rem] font-bold uppercase tracking-wider text-[var(--text2)]"
                  title="Dois cliques para renomear"
                >
                  {col.name}
                </button>
                <div className="flex items-center gap-2">
                  <span className="mono rounded bg-[var(--card)] px-2 py-0.5 text-[0.62rem] text-[var(--text2)]">
                    {colCards.length}
                  </span>
                  <button onClick={() => removeColumn(col.id)} className="text-[var(--text3)] hover:text-[var(--red)]" aria-label="Remover coluna">⋯</button>
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {colCards.length === 0 && (
                  <div className="rounded-lg border border-dashed border-[var(--border)] py-8 text-center text-xs text-[var(--text3)]">
                    Sem leads nesta etapa
                  </div>
                )}
                {colCards.map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/${c.id}`}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`block cursor-grab rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 transition hover:border-[#bbb] ${
                      dragId === c.id ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold text-[var(--text)]">{c.nome || "Lead"}</span>
                      <TierBadge tier={c.tier} />
                    </div>
                    <div className="mono mt-1 truncate text-[0.7rem] text-[var(--text3)]">
                      {c.email || c.telefone || "—"}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
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
