"use client";

import { PillTabs } from "@/components/PillTabs";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Field } from "@/lib/types";
import { TierBadge } from "@/components/TierBadge";
import { FieldTypeIcon, FIELD_META } from "@/components/FieldTypeIcon";
import { BrazilGeoMap } from "@/components/BrazilGeoMap";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { OptimizePanel } from "@/components/OptimizePanel";
import { ConversionTimeline, ConversionLogTable } from "@/components/ConversionLog";

interface Submission {
  id: string;
  /** de qual versão do formulário este lead veio */
  form_slug?: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  answers: Record<string, unknown>;
  score: number;
  tier: string | null;
  status: string;
  stage: string;
  labels: string[];
  qualified?: boolean;
  tracking: Record<string, string> | null;
  geo_uf: string | null;
  geo_city: string | null;
  geo_country: string | null;
  gads_status: string | null;
  gads_error: string | null;
  gads_sent_at: string | null;
  device?: string | null;
  duration_ms?: number | null;
  created_at: string;
  updated_at: string;
}

function GadsBadge({
  status,
  error,
  qualified,
}: {
  status: string | null;
  error: string | null;
  qualified?: boolean;
}) {
  const map: Record<string, { label: string; icon: string; cls: string }> = {
    sent: { label: "Enviado", icon: "✓", cls: "bg-[var(--success-dim)] text-[var(--success)]" },
    failed: { label: "Falhou", icon: "✗", cls: "bg-[var(--danger-dim)] text-[var(--red)]" },
    skipped: { label: "Não enviado", icon: "•", cls: "bg-[var(--bg)] text-[var(--text3)]" },
  };
  const m = status ? map[status] : null;
  if (!m) {
    return <span className="text-[var(--text3)]">{qualified ? "pendente" : "—"}</span>;
  }
  return (
    <span
      title={error || undefined}
      className={`mono inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.55rem] font-bold uppercase ${m.cls}`}
    >
      {m.icon} {m.label}
    </span>
  );
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
  qualified?: boolean;
}

/** Uma versão do formulário dentro do grupo que compartilha a base de leads. */
interface Variant {
  id: string;
  slug: string;
  name: string;
  label: string;
  published: boolean;
  views: number;
  starts: number;
  responses: number;
  qualified: number;
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
  tableSteps,
  kanbanColumns,
  submissions,
  stats,
  reached,
  variants = [],
  groupSlugs = [],
}: {
  formId: string;
  formName: string;
  formSlug: string;
  /** etapas desta versão — funil, Kanban e a análise */
  steps: Field[];
  /** união das etapas de todas as versões — colunas da tabela de respostas */
  tableSteps?: Field[];
  kanbanColumns: Column[];
  /** leads de todas as versões do grupo */
  submissions: Submission[];
  stats: { views: number; starts: number; avgMs?: number | null };
  reached?: Record<string, number> | null;
  variants?: Variant[];
  groupSlugs?: string[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<
    "summary" | "responses" | "map" | "kanban" | "optimize" | "log"
  >("summary");
  // status pré-selecionado ao chegar pelo painel de conversões do dashboard
  const [logStatus, setLogStatus] = useState<string | undefined>(undefined);

  const completes = useMemo(
    () => submissions.filter((s) => s.status === "complete"),
    [submissions]
  );

  // O Resumo e o funil são desta versão; o resto do painel é do grupo inteiro.
  const hasGroup = variants.length > 1;
  const ownCompletes = useMemo(
    () => (hasGroup ? completes.filter((s) => s.form_slug === formSlug) : completes),
    [completes, hasGroup, formSlug]
  );
  const ownSubmissions = useMemo(
    () => (hasGroup ? submissions.filter((s) => s.form_slug === formSlug) : submissions),
    [submissions, hasGroup, formSlug]
  );
  const variantLabels = useMemo(() => {
    const map: Record<string, string> = {};
    variants.forEach((v) => (map[v.slug] = v.label));
    return map;
  }, [variants]);

  const responses = ownCompletes.length;
  const exportSlugs = groupSlugs.length ? groupSlugs : [formSlug];

  const qualified = ownCompletes.filter((s) => s.qualified).length;
  const avgScore = ownCompletes.length
    ? Math.round(ownCompletes.reduce((n, s) => n + (s.score || 0), 0) / ownCompletes.length)
    : 0;
  const sections = [
    { id: "summary", label: "Resumo", icon: <IcoSummary /> },
    { id: "responses", label: "Respostas", icon: <IcoTable /> },
    { id: "map", label: "Mapa", icon: <IcoPin /> },
    { id: "kanban", label: "Kanban", icon: <IcoColumns /> },
    { id: "optimize", label: "Otimizar", icon: <IcoSpark /> },
    { id: "log", label: "Envios", icon: <IcoLog /> },
  ] as const;

  return (
    <div className="rv-main w-full px-5 pb-10 sm:px-8">
      {/* Menu lateral (dock) */}
      <nav className="ga-dock" aria-label="Seções de resultados">
        {sections.map((x) => (
          <button
            key={x.id}
            type="button"
            className="ga-dock__btn"
            data-active={tab === x.id}
            aria-label={x.label}
            aria-current={tab === x.id ? "page" : undefined}
            onClick={() => {
              if (x.id === "log") setLogStatus(undefined);
              setTab(x.id);
            }}
          >
            {x.icon}
            <span className="ga-dock__tip">{x.label}</span>
          </button>
        ))}
      </nav>

      {/* Título + estatísticas */}
      <header className="ga-head ga-head--in">
        <h1>
          Resultados
          <br />
          <span style={{ fontWeight: 300 }}>{formName}</span>
        </h1>
        <div className="ga-stats">
          <ResultStat label="Leads completos" value={responses} d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM3 20c.6-3.2 3-5 6-5s5.4 1.8 6 5M16 5.2a3.5 3.5 0 010 6.6M18 15c1.8.6 3 2.2 3.5 5" />
          <ResultStat label="Qualificados" value={qualified} d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z" badge={responses ? `${Math.round((qualified / responses) * 100)}%` : undefined} />
          <ResultStat label="Score médio" value={avgScore} d="M4 20h16M7 17v-5M12 17V7M17 17v-8" />
        </div>
      </header>

      {tab === "summary" && (
        <>
          {hasGroup && <VariantComparison variants={variants} currentSlug={formSlug} />}
          <AnalyticsDashboard
            submissions={ownCompletes}
            views={stats.views}
            starts={stats.starts}
            avgMs={stats.avgMs ?? null}
            funnel={
              <Funnel
                steps={steps}
                submissions={ownCompletes}
                starts={stats.starts}
                responses={responses}
                reached={reached ?? null}
              />
            }
            rail={
              <LeadsRail
                submissions={ownSubmissions}
                steps={steps}
                onSeeAll={() => setTab("responses")}
              />
            }
            onOpenLog={(status) => {
              setLogStatus(status);
              setTab("log");
            }}
          />
        </>
      )}
      {tab === "responses" && (
        <div>
          <Responses
            steps={tableSteps ?? steps}
            submissions={submissions}
            exportSlugs={exportSlugs}
            variantLabels={hasGroup ? variantLabels : null}
            onChange={() => router.refresh()}
          />
        </div>
      )}
      {tab === "map" && <BrazilGeoMap submissions={completes} />}
      {tab === "optimize" && <OptimizePanel formId={formId} steps={steps} />}
      {tab === "log" && <ConversionLogTable formId={formId} initialStatus={logStatus} />}
      {tab === "kanban" && (
        <Kanban
          formId={formId}
          steps={tableSteps ?? steps}
          initialColumns={kanbanColumns}
          submissions={completes}
          onRefresh={() => router.refresh()}
        />
      )}
    </div>
  );
}

function ResultStat({ label, value, d, badge }: { label: string; value: number; d: string; badge?: string }) {
  return (
    <div className="ga-stat">
      <span className="ga-stat__ico">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={d} />
        </svg>
      </span>
      <div>
        <div className="ga-stat__v">
          {value}
          {badge ? <span className="ga-badge-accent">{badge}</span> : null}
        </div>
        <div className="ga-stat__l">{label}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Comparação de versões

/**
 * Aparece quando o formulário tem versões geradas pela aba Otimizar. Os leads são
 * compartilhados, mas visualizações e conversão são de cada versão — é o que permite
 * dizer qual delas converte melhor.
 */
function VariantComparison({
  variants,
  currentSlug,
}: {
  variants: Variant[];
  currentSlug: string;
}) {
  const best = variants.reduce(
    (acc, v) => {
      const rate = v.views > 0 ? v.responses / v.views : 0;
      return rate > acc.rate ? { rate, slug: v.slug } : acc;
    },
    { rate: 0, slug: "" }
  );

  return (
    <div className="dash-in mb-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
        <span className="lbl">Comparação de versões</span>
        <span className="text-[0.72rem] text-[var(--text3)]">
          Os leads são compartilhados; visualizações e conversão são de cada versão.
        </span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="mono border-b border-[var(--border)] text-[0.58rem] uppercase tracking-wider text-[var(--text3)]">
              <th className="px-5 py-2 font-normal">Versão</th>
              <th className="px-3 py-2 text-right font-normal">Visualizações</th>
              <th className="px-3 py-2 text-right font-normal">Inícios</th>
              <th className="px-3 py-2 text-right font-normal">Respostas</th>
              <th className="px-3 py-2 text-right font-normal">Qualificados</th>
              <th className="px-5 py-2 text-right font-normal">Conversão</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const rate = v.views > 0 ? Math.round((v.responses / v.views) * 100) : null;
              const isCurrent = v.slug === currentSlug;
              return (
                <tr
                  key={v.slug}
                  className="border-b border-[var(--border)] text-[0.82rem] last:border-0"
                  style={isCurrent ? { background: "var(--bg)" } : undefined}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="mono rounded-full bg-[var(--dark)] px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-white">
                        {v.label}
                      </span>
                      <span className="truncate font-medium text-[var(--text)]">{v.name}</span>
                      {!v.published && (
                        <span className="mono shrink-0 rounded-full bg-[var(--bg)] px-2 py-0.5 text-[0.52rem] uppercase tracking-wide text-[var(--text3)]">
                          Rascunho
                        </span>
                      )}
                      {isCurrent && (
                        <span className="mono shrink-0 text-[0.52rem] uppercase tracking-wide text-[var(--text3)]">
                          nesta tela
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-[var(--text2)]">{v.views}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-[var(--text2)]">{v.starts}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold text-[var(--text)]">
                    {v.responses}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-[var(--text2)]">
                    {v.qualified}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {rate === null ? (
                      <span className="text-[var(--text3)]">—</span>
                    ) : (
                      <span
                        className="rounded-full px-2 py-0.5 font-bold tabular-nums"
                        style={
                          v.slug === best.slug && best.rate > 0
                            ? { background: "var(--accent)", color: "var(--dark)" }
                            : { color: "var(--text2)" }
                        }
                      >
                        {rate}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Resumo
function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

function Funnel({
  steps,
  submissions,
  starts,
  responses,
  reached,
}: {
  steps: Field[];
  submissions: Submission[];
  starts: number;
  responses: number;
  reached: Record<string, number> | null;
}) {
  // Com rastreio de abandono: usa sessões que alcançaram cada pergunta.
  // Sem rastreio: cai no comportamento antigo (respostas dos concluídos).
  const perQuestion = steps.map((s) => {
    const answered = submissions.filter((sub) => hasAnswer(sub.answers?.[s.id])).length;
    const reachedCount = reached ? reached[s.id] ?? 0 : answered;
    return { field: s, answered, reached: reachedCount };
  });
  const base = reached
    ? Math.max(starts, perQuestion[0]?.reached ?? 0, 1)
    : Math.max(responses, 1);

  return (
    <div>
      <div className="mb-3">
        <span className="lbl">
          {reached ? "Funil de abandono" : "Resumo das respostas"}
        </span>
        {!reached && (
          <p className="mt-1 text-[0.72rem] text-[var(--text3)]">
            Ative “Rastrear abandonos” nos Ajustes para ver onde as pessoas param.
          </p>
        )}
      </div>
      <div className="grid gap-3">
        {perQuestion.map(({ field, answered, reached: rc }, i) => {
          const count = reached ? rc : answered;
          const prev = i === 0 ? base : perQuestion[i - 1][reached ? "reached" : "answered"];
          const dropoff = Math.max(prev - count, 0);
          const pct = base ? Math.round((count / base) * 100) : 0;
          return (
            <div
              key={field.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0 truncate font-medium text-[var(--text)] sm:flex-1">
                  {field.title}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-[0.8rem]">
                  <span className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[var(--text2)]">
                    {reached ? "Alcançaram" : "Respostas"}{" "}
                    <b className="text-[var(--text)]">{count}</b>
                  </span>
                  <span className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[var(--text2)]">
                    Abandono{" "}
                    <b className={dropoff > 0 ? "text-[var(--red)]" : "text-[var(--text)]"}>
                      {dropoff}
                    </b>
                  </span>
                </div>
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg)]">
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
      <div className="text-[1.55rem] font-black leading-none sm:text-[1.9rem]">{n}</div>
      <div className="mt-1.5 text-[0.68rem] opacity-80 sm:text-[0.72rem]">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Rail de respostas
// Passagem rápida pelos leads, ao lado do dashboard. Abre o mesmo lightbox
// da aba Respostas ao clicar num card.
function LeadsRail({
  submissions,
  steps,
  onSeeAll,
}: {
  submissions: Submission[];
  steps: Field[];
  onSeeAll: () => void;
}) {
  const [filter, setFilter] = useState<"complete" | "all">("complete");
  const [viewId, setViewId] = useState<string | null>(null);
  const viewed = submissions.find((s) => s.id === viewId) ?? null;

  const rows = useMemo(
    () =>
      submissions
        .filter((s) => (filter === "complete" ? s.status === "complete" : true))
        .slice(0, 40),
    [submissions, filter]
  );

  return (
    <div className="dash-in rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <span className="lbl">Respostas</span>
        <PillTabs size="sm" className="!inline-flex" label="Filtro de respostas">
          {(["complete", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className="ga-tab" data-active={filter === f}>
              {f === "complete" ? "Completas" : "Todas"}
            </button>
          ))}
        </PillTabs>
      </header>

      <div className="max-h-[820px] overflow-y-auto">
        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-[0.78rem] text-[var(--text3)]">
            Nenhuma resposta ainda.
          </p>
        )}
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => setViewId(r.id)}
            className="flex w-full items-center gap-2 overflow-hidden border-b border-[var(--border)] px-4 py-2.5 text-left transition last:border-0 hover:bg-[var(--bg)]"
          >
            <span className="shrink-0 max-w-[38%] truncate text-[0.85rem] font-bold text-[var(--text)]">
              {r.nome || "Sem nome"}
            </span>
            {r.email && (
              <span className="min-w-0 flex-1 truncate text-[0.72rem] text-[var(--text2)]">
                {r.email}
              </span>
            )}
            {r.status !== "complete" && (
              <span className="mono shrink-0 rounded-full bg-[var(--bg)] px-2 py-0.5 text-[0.55rem] font-bold uppercase text-[var(--text3)]">
                Parcial
              </span>
            )}
            <span className="shrink-0">
              <TierBadge tier={r.tier} />
            </span>
            {r.tracking?.utm_campaign && (
              <span
                className="mono max-w-[90px] shrink-0 truncate rounded-full bg-[var(--bg)] px-2 py-0.5 text-[0.55rem] uppercase tracking-wide text-[var(--text3)]"
                title={r.tracking.utm_campaign}
              >
                {r.tracking.utm_campaign}
              </span>
            )}
            <span className="mono ml-auto inline-flex shrink-0 items-center gap-1 text-[0.6rem] text-[var(--text3)]">
              <HdrIcon d="M12 8v4l3 2" circle />
              {relativeTime(r.created_at)}
            </span>
          </button>
        ))}
      </div>

      <footer className="border-t border-[var(--border)] px-4 py-3">
        <button
          onClick={onSeeAll}
          className="mono w-full rounded-full bg-[var(--dark)] px-4 py-2 text-[0.62rem] font-bold uppercase tracking-wider text-white transition hover:bg-[var(--text2)]"
        >
          Ver tabela completa
        </button>
      </footer>

      {viewed && (
        <LeadQuickView submission={viewed} steps={steps} onClose={() => setViewId(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Respostas
function Responses({
  steps,
  submissions,
  exportSlugs,
  variantLabels,
  onChange,
}: {
  steps: Field[];
  submissions: Submission[];
  /** slugs incluídos na exportação — todas as versões do grupo */
  exportSlugs: string[];
  /** slug → rótulo da versão; null quando o formulário não tem versões */
  variantLabels: Record<string, string> | null;
  onChange: () => void;
}) {
  const [q, setQ] = useState("");
  const [campaign, setCampaign] = useState("");
  const [variant, setVariant] = useState("");
  const [statusFilter, setStatusFilter] = useState<"complete" | "partial" | "all">("complete");
  const [tier, setTier] = useState<"todos" | "quente" | "morno" | "frio">("todos");
  // "compact" = tabela resumida do novo padrão; "full" = todas as colunas de perguntas
  const [mode, setMode] = useState<"compact" | "full">("compact");
  const [viewId, setViewId] = useState<string | null>(null);
  // a escala do score vem das ponderações de cada formulário: a barra é relativa ao maior valor
  const maxScore = Math.max(1, ...submissions.map((x) => x.score || 0));
  const viewed = submissions.find((s) => s.id === viewId) ?? null;

  const partialCount = useMemo(
    () => submissions.filter((s) => s.status !== "complete").length,
    [submissions]
  );

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
      if (statusFilter === "complete" && s.status !== "complete") return false;
      if (statusFilter === "partial" && s.status === "complete") return false;
      if (tier !== "todos" && s.tier !== tier) return false;
      if (campaign && s.tracking?.utm_campaign !== campaign) return false;
      if (variant && s.form_slug !== variant) return false;
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
  }, [q, campaign, variant, statusFilter, tier, submissions]);

  async function remove(id: string) {
    if (!confirm("Excluir esta resposta?")) return;
    const res = await fetch(`/api/admin/submissions/${id}`, { method: "DELETE" });
    if (res.ok) onChange();
    else alert("Não foi possível excluir.");
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {(["todos", "quente", "morno", "frio"] as const).map((t) => (
            <button key={t} type="button" className="ga-chip" aria-pressed={tier === t} onClick={() => setTier(t)}>
              {t !== "todos" && <i className={`ga-dot ga-dot--${t}`} />}
              {t === "todos" ? "Todos" : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nas respostas…"
            className="w-[220px] shrink rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm outline-none focus:border-[var(--acc2)]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "complete" | "partial" | "all")}
            className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text2)]"
          >
            <option value="complete">Completas</option>
            <option value="partial">Parciais{partialCount ? ` (${partialCount})` : ""}</option>
            <option value="all">Todas</option>
          </select>
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
          {variantLabels && (
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text2)]"
            >
              <option value="">Todas as versões</option>
              {Object.entries(variantLabels).map(([slug, label]) => (
                <option key={slug} value={slug}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PillTabs size="sm" className="!inline-flex" label="Modo da tabela">
            <button type="button" className="ga-tab" data-active={mode === "compact"} onClick={() => setMode("compact")}>Resumo</button>
            <button type="button" className="ga-tab" data-active={mode === "full"} onClick={() => setMode("full")}>Todas as colunas</button>
          </PillTabs>
          <span className="mono text-[0.72rem] text-[var(--text3)]">{rows.length} respostas</span>
          <a
            href={`/api/admin/export?form=${exportSlugs.join(",")}`}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text2)] hover:border-[#bbb] hover:text-[var(--text)]"
          >
            Baixar CSV
          </a>
        </div>
      </div>
      {mode === "compact" && (
        <div className="overflow-x-auto">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Tier</th>
                <th>Score</th>
                <th className="ga-hide-md">Origem</th>
                <th className="ga-hide-md">Local</th>
                <th>Google Ads</th>
                <th className="r">Quando</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[var(--text2)]">
                    Nenhuma resposta ainda. Aparecem aqui assim que alguém responder.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setViewId(r.id)}>
                  <td>
                    <div className="ga-person">
                      <span className="ga-feed__av">{(r.nome || r.email || "?").trim()[0]?.toUpperCase() ?? "?"}</span>
                      <span>
                        <b>{r.nome || r.email || "Lead sem nome"}</b>
                        <small>
                          {r.email || r.telefone || "—"}
                          {variantLabels && r.form_slug && variantLabels[r.form_slug] ? ` · ${variantLabels[r.form_slug]}` : ""}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>
                    {r.status === "complete" ? (
                      <TierBadge tier={r.tier} />
                    ) : (
                      <span className="mono rounded-full bg-[var(--border)] px-2 py-1 text-[0.55rem] font-bold uppercase text-[var(--text3)]">Parcial</span>
                    )}
                  </td>
                  <td>
                    <div className="ga-score">
                      <b>{r.score}</b>
                      <span className="ga-meter">
                        <i style={{ transform: `scaleX(${Math.max(0.04, Math.min(1, r.score / maxScore))})` }} />
                      </span>
                    </div>
                  </td>
                  <td className="ga-hide-md">
                    <span>{r.tracking?.utm_source || (r.tracking?.gclid ? "google/ads" : "—")}</span>
                    {r.tracking?.utm_campaign ? <small className="ga-sub">{r.tracking.utm_campaign}</small> : null}
                  </td>
                  <td className="ga-hide-md">
                    {r.geo_city ? (
                      <>
                        {r.geo_city} <span className="mono text-[0.65rem] text-[var(--text3)]">· {r.geo_uf}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <GadsBadge status={r.gads_status} error={r.gads_error} qualified={r.qualified} />
                  </td>
                  <td className="r ga-when" title={fmtDate(r.created_at)}>
                    {relativeTime(r.created_at)}
                  </td>
                  <td className="r">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(r.id);
                      }}
                      className="text-[var(--text3)] hover:text-[var(--red)]"
                      aria-label="Excluir"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mode === "full" && (
      <div className="overflow-x-auto">
        <table className="w-full text-sm [&_td]:border-r [&_td]:border-[var(--border)] [&_th]:border-r [&_th]:border-[var(--border)] [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">

          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg)] text-left">
              <Th></Th>
              <Th>
                <HdrIcon d="M12 8v4l3 2" circle /> Enviado
              </Th>
              <Th>
                <HdrIcon d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1" /> ID
              </Th>
              <Th>
                <HdrIcon d="M20 6L9 17l-5-5" /> Status
              </Th>
              {variantLabels && (
                <Th>
                  <HdrIcon d="M6 3v12M6 21a3 3 0 100-6 3 3 0 000 6zM6 6a3 3 0 100-6 3 3 0 000 6zM18 9a3 3 0 100-6 3 3 0 000 6zM18 6v3a6 6 0 01-6 6H6" /> Versão
                </Th>
              )}
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
              <Th>
                <HdrIcon d="M4 4h16v4H4zM4 12h10v8H4z" /> Google Ads
              </Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={steps.length + 10 + (variantLabels ? 1 : 0)}
                  className="px-4 py-12 text-center text-[var(--text2)]"
                >
                  Nenhuma resposta ainda. Aparecem aqui assim que alguém responder.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]">
                <td className="px-3 py-3 text-center">
                  <button
                    onClick={() => setViewId(r.id)}
                    aria-label="Ver lead"
                    title="Ver lead"
                    className="inline-flex text-[var(--text3)] transition hover:text-[var(--text)]"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </td>
                <td className="whitespace-nowrap px-4 py-3 mono text-[0.72rem] text-[var(--text3)]">
                  {fmtDate(r.created_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 mono text-[0.7rem] text-[var(--text3)]">
                  {r.id.slice(0, 8)}
                </td>
                <td className="px-4 py-3">
                  <span className="mono rounded-full bg-[var(--success-dim)] px-2 py-0.5 text-[0.55rem] font-bold uppercase text-[var(--success)]">
                    {r.status === "complete" ? "Completa" : "Parcial"}
                  </span>
                </td>
                {variantLabels && (
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className="mono rounded-full bg-[var(--bg)] px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide text-[var(--text2)]"
                      title={r.form_slug || ""}
                    >
                      {(r.form_slug && variantLabels[r.form_slug]) || "—"}
                    </span>
                  </td>
                )}
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
                <td className="px-4 py-3">
                  <GadsBadge status={r.gads_status} error={r.gads_error} qualified={r.qualified} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button onClick={() => remove(r.id)} className="text-[var(--text3)] hover:text-[var(--red)]" aria-label="Excluir">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {viewed && (
        <LeadQuickView submission={viewed} steps={steps} onClose={() => setViewId(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Lightbox de leitura
function LeadQuickView({
  submission,
  steps,
  onClose,
}: {
  submission: Submission;
  steps: Field[];
  onClose: () => void;
}) {
  const wa = (() => {
    if (!submission.telefone) return null;
    const d = String(submission.telefone).replace(/\D/g, "");
    const num = d.length <= 11 ? `55${d}` : d;
    const first = (submission.nome || "").trim().split(" ")[0] || "";
    const msg = encodeURIComponent(
      `Olá${first ? ` ${first}` : ""}! Recebi seu contato pelo formulário da Hibrid.`
    );
    return `https://wa.me/${num}?text=${msg}`;
  })();

  return (
    <div
      className="lb-overlay fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="lb-panel flex max-h-[90vh] w-full max-w-[720px] flex-col overflow-hidden rounded-t-2xl bg-[var(--card)] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[1.3rem] font-black tracking-tight text-[var(--text)]">
              {submission.nome || "Lead sem nome"}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-[var(--text2)]">
              {submission.email && <span className="truncate">{submission.email}</span>}
              {submission.telefone && <span className="mono">{submission.telefone}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <div className="text-[1.7rem] font-black leading-none text-[var(--text)]">
                {submission.score}
              </div>
              <div className="lbl mt-0.5">Score</div>
            </div>
            <button onClick={onClose} className="text-[var(--text3)] hover:text-[var(--text)]" aria-label="Fechar">✕</button>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-2.5">
          <TierBadge tier={submission.tier} />
          <span className="mono rounded-full bg-[var(--success-dim)] px-2 py-0.5 text-[0.55rem] font-bold uppercase text-[var(--success)]">
            {submission.status === "complete" ? "Completa" : "Parcial"}
          </span>
          <GadsBadge status={submission.gads_status} error={submission.gads_error} qualified={submission.qualified} />
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-95"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.8 14.03c-.24.68-1.42 1.31-1.95 1.35-.5.05-.97.24-3.27-.68-2.77-1.09-4.53-3.92-4.67-4.11-.14-.19-1.13-1.5-1.13-2.86 0-1.36.71-2.03.96-2.31.25-.27.55-.34.73-.34.18 0 .37 0 .53.01.17.01.4-.06.62.48.24.56.81 1.96.88 2.1.07.14.12.31.02.5-.09.19-.14.31-.28.47-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.27.71 1.17 1.53 1.9 1.05.93 1.93 1.22 2.21 1.36.28.14.44.12.6-.07.17-.19.69-.81.87-1.09.18-.28.36-.23.61-.14.25.09 1.6.75 1.87.89z" />
              </svg>
              WhatsApp
            </a>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
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
          </div>

          {(submission.tracking?.utm_source ||
            submission.tracking?.utm_campaign ||
            submission.tracking?.gclid) && (
            <div className="mt-4 rounded-xl border border-[var(--border)] p-3">
              <div className="mono mb-2 text-[0.6rem] uppercase tracking-wider text-[var(--text3)]">Origem</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text2)]">
                {submission.tracking?.utm_source && <span>Fonte: <b className="text-[var(--text)]">{submission.tracking.utm_source}</b></span>}
                {submission.tracking?.utm_campaign && <span>Campanha: <b className="text-[var(--text)]">{submission.tracking.utm_campaign}</b></span>}
                {submission.tracking?.gclid && <span className="mono text-[0.7rem]">gclid ✓</span>}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-[var(--border)] p-3">
            <div className="mono mb-3 text-[0.6rem] uppercase tracking-wider text-[var(--text3)]">
              Histórico de envios
            </div>
            <ConversionTimeline submissionId={submission.id} />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="mono text-[0.62rem] text-[var(--text3)]">
              #{submission.id.slice(0, 12).toUpperCase()} · {fmtDate(submission.created_at)}
            </span>
            <Link href={`/admin/${submission.id}`} className="mono text-[0.72rem] text-[var(--text2)] hover:text-[var(--text)] hover:underline">
              abrir página completa →
            </Link>
          </div>
        </div>
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
  const [kq, setKq] = useState("");
  const [ktier, setKtier] = useState<"todos" | "quente" | "morno" | "frio">("todos");
  const [overCol, setOverCol] = useState<string | null>(null);
  const selected = cards.find((c) => c.id === selectedId) ?? null;
  // busca e filtro de tier só escondem cartões (não alteram os dados)
  const matches = (c: Submission) =>
    (ktier === "todos" || c.tier === ktier) &&
    (!kq.trim() ||
      [c.nome, c.email, c.telefone, ...(c.labels ?? [])].join(" ").toLowerCase().includes(kq.trim().toLowerCase()));

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
    const col = columns.find((c) => c.id === stage);
    const qualify = !!col?.qualified;
    setCards((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, stage, qualified: qualify ? true : c.qualified } : c
      )
    );
    const res = await fetch(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(qualify ? { stage, qualify: true } : { stage }),
    });
    if (qualify) {
      const data = await res.json().catch(() => ({}));
      const gs = data?.gads_status as string | undefined;
      if (gs) {
        setCards((prev) =>
          prev.map((c) => (c.id === id ? { ...c, gads_status: gs } : c))
        );
      }
    }
  }

  function toggleQualified(id: string) {
    const next = columns.map((c) =>
      c.id === id ? { ...c, qualified: !c.qualified } : c
    );
    saveColumns(next);
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

  const TONES = ["sky", "lime", "coral", "ink"] as const;
  const star = (filled: boolean) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.9 6.3 6.8.8-5 4.7 1.3 6.7L12 17.8 5.9 20.5 7.2 13.8l-5-4.7 6.8-.8z" />
    </svg>
  );

  return (
    <div className="kb">
      <div className="kb-toolbar">
        <label className="kb-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input value={kq} onChange={(e) => setKq(e.target.value)} placeholder="Buscar leads…" aria-label="Buscar leads" />
        </label>
        {(["todos", "quente", "morno", "frio"] as const).map((t) => (
          <button key={t} type="button" className="ga-chip" aria-pressed={ktier === t} onClick={() => setKtier(t)}>
            {t !== "todos" && <i className={`ga-dot ga-dot--${t}`} />}
            {t === "todos" ? "Todos" : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
        <span className="kb-toolbar__spacer" />
        <button type="button" className="kb-round" onClick={onRefresh} aria-label="Atualizar" title="Atualizar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19.5 12a7.5 7.5 0 11-2.2-5.3M19.5 4.5v4h-4" />
          </svg>
        </button>
        <button type="button" className="kb-new" onClick={addColumn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nova coluna
        </button>
      </div>

      <div className="kb-cols">
        {columns.map((col, ci) => {
          const colCards = cards.filter((c) => colOf(c) === col.id);
          const shown = colCards.filter(matches);
          const tone = TONES[ci % TONES.length];
          return (
            <section
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                if (overCol !== col.id) setOverCol(col.id);
              }}
              onDragLeave={() => setOverCol((o) => (o === col.id ? null : o))}
              onDrop={() => {
                if (dragId) moveCard(dragId, col.id);
                setDragId(null);
                setOverCol(null);
              }}
              className={`kb-col${col.qualified ? " is-qualified" : ""}${overCol === col.id ? " is-over" : ""}`}
              aria-label={col.name}
            >
              <header className="kb-col__head">
                <span className={`kb-col__dot kb-t--${tone}`} aria-hidden="true" />
                <input
                  value={col.name}
                  onChange={(e) => setColumnName(col.id, e.target.value)}
                  onBlur={() => persistColumns()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="kb-col__name"
                  title="Clique para renomear"
                  aria-label="Nome da coluna"
                />
                <span className="kb-col__count">{kq || ktier !== "todos" ? `${shown.length}/${colCards.length}` : colCards.length}</span>
                <button
                  onClick={() => toggleQualified(col.id)}
                  className={`kb-col__btn${col.qualified ? " is-on" : ""}`}
                  aria-label="Marcar coluna como qualificada"
                  title={
                    col.qualified
                      ? "Coluna qualificada — mover um lead pra cá dispara a conversão. Clique para desativar."
                      : "Marcar como coluna de qualificados (dispara conversão ao receber um lead)"
                  }
                >
                  {star(!!col.qualified)}
                </button>
                {columns.length > 1 && (
                  <button onClick={() => removeColumn(col.id)} className="kb-col__btn kb-col__btn--del" aria-label="Excluir coluna" title="Excluir coluna">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H7a1 1 0 01-1-1V6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </header>
              {col.qualified && <div className="kb-col__note">★ Dispara conversão de qualificado</div>}

              <div className="kb-col__body">
                {shown.length === 0 && (
                  <div className="kb-empty">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="3" y="4" width="5" height="16" rx="1.2" />
                      <rect x="9.5" y="4" width="5" height="16" rx="1.2" />
                      <rect x="16" y="4" width="5" height="16" rx="1.2" />
                    </svg>
                    <span>{colCards.length ? "Nenhum lead com esse filtro" : "Sem leads nesta etapa"}</span>
                  </div>
                )}
                {shown.map((c) => (
                  <article
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    onClick={() => setSelectedId(c.id)}
                    title={`#${c.id.slice(0, 10)}`}
                    className={`kb-card kb-t--${tone}${dragId === c.id ? " is-drag" : ""}`}
                  >
                    <div className="kb-card__top">
                      <span>Enviado {shortDate(c.created_at)}</span>
                      <span className="kb-card__rel">{relativeTime(c.created_at)}</span>
                    </div>
                    <h3 className="kb-card__title">{c.nome || "Lead"}</h3>
                    {c.email && <p className="kb-card__sub">{c.email}</p>}
                    {c.telefone && <p className="kb-card__sub">{c.telefone}</p>}
                    {c.labels?.length > 0 && (
                      <div className="kb-card__labels">
                        {c.labels.map((l) => (
                          <span key={l}>{l}</span>
                        ))}
                      </div>
                    )}
                    <div className="kb-card__foot">
                      <div className="kb-card__meta">
                        {c.tier && (
                          <span className="kb-pill">
                            <i className={`ga-dot ga-dot--${c.tier}`} />
                            {c.tier[0].toUpperCase() + c.tier.slice(1)} · {c.score}
                          </span>
                        )}
                        {c.status === "complete" ? <span className="kb-pill">🎉 Completa</span> : <span className="kb-pill">Parcial</span>}
                      </div>
                      <span className="kb-av">{(c.nome || c.email || "?").trim()[0]?.toUpperCase() ?? "?"}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
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

// ---------------------------------------------------------------- Detalhes do lead (gaveta lateral)
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
  const [closing, setClosing] = useState(false);
  const answered = steps.filter((s) => hasAnswer(submission.answers?.[s.id]));
  const TONES = ["sky", "lime", "coral", "ink"] as const;
  const stageId = columns.some((c) => c.id === submission.stage) ? submission.stage : columns[0]?.id;
  const stageIdx = Math.max(0, columns.findIndex((c) => c.id === stageId));
  const stage = columns[stageIdx];
  const tone = TONES[stageIdx % TONES.length];

  // fecha com animação (a gaveta desliza para fora antes de desmontar)
  function close() {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 220);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  function addLabel() {
    const v = labelInput.trim();
    if (!v || submission.labels.includes(v)) return;
    onLabels([...submission.labels, v]);
    setLabelInput("");
  }

  const wa = (() => {
    if (!submission.telefone) return null;
    const d = String(submission.telefone).replace(/\D/g, "");
    const num = d.length <= 11 ? `55${d}` : d;
    const first = (submission.nome || "").trim().split(" ")[0] || "";
    const msg = encodeURIComponent(`Olá${first ? ` ${first}` : ""}! Recebi seu contato pelo formulário da Hibrid.`);
    return `https://wa.me/${num}?text=${msg}`;
  })();

  return (
    <div className={`ld-overlay${closing ? " is-closing" : ""}`} onClick={close}>
      <aside
        className="ld-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Lead ${submission.nome || ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ld-top">
          <span className="ld-kicker">
            Lead · {submission.email || submission.telefone || `#${submission.id.slice(0, 8)}`}
          </span>
          <button type="button" className="ld-close" onClick={close} aria-label="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* cartão de cabeçalho — cor da etapa atual */}
        <div className={`ld-head kb-t--${tone}`}>
          <div className="ld-head__row">
            <span>Enviado {shortDate(submission.created_at)}</span>
            <span className="ld-stage-pill">
              <i className={`kb-col__dot kb-t--${tone}`} />
              {stage?.name}
            </span>
          </div>
          <h2 className="ld-head__title">{submission.nome || "Lead sem nome"}</h2>
          <p className="ld-head__sub">{submission.email || "—"}</p>
          <div className="ld-head__foot">
            <div>
              <b className="ld-head__score">{submission.score}</b>
              <small>score</small>
            </div>
            <div className="ld-head__badges">
              <TierBadge tier={submission.tier} />
              <span className="ld-av">{(submission.nome || submission.email || "?").trim()[0]?.toUpperCase() ?? "?"}</span>
            </div>
          </div>
        </div>

        {/* estágios cadastrados no Kanban */}
        <nav className="ld-steps" aria-label="Estágio do lead">
          <ol>
            {columns.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`ld-step${i <= stageIdx ? " is-on" : ""}${i === stageIdx ? " is-now" : ""}`}
                  aria-current={i === stageIdx ? "step" : undefined}
                  title={c.qualified ? `${c.name} — dispara conversão de qualificado` : c.name}
                  onClick={() => onStage(c.id)}
                >
                  {c.qualified && <span aria-hidden="true">★ </span>}
                  {c.name}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <section className="ld-card">
          <div className="ld-card__title">Propriedades</div>
          <dl className="ld-props">
            <div>
              <dt>Status</dt>
              <dd>{submission.status === "complete" ? "Completa" : "Parcial"}</dd>
            </div>
            <div>
              <dt>Enviado</dt>
              <dd>{relativeTime(submission.created_at)}</dd>
            </div>
            <div>
              <dt>Atualizado</dt>
              <dd>{relativeTime(submission.updated_at)}</dd>
            </div>
            <div>
              <dt>Google Ads</dt>
              <dd>
                <GadsBadge status={submission.gads_status} error={submission.gads_error} qualified={submission.qualified} />
              </dd>
            </div>
          </dl>
          {submission.gads_status === "failed" && submission.gads_error && (
            <div className="mt-2 rounded-lg bg-[var(--danger-dim)] px-3 py-2 text-[0.72rem] text-[var(--red)]">{submission.gads_error}</div>
          )}
          {submission.gads_status === "skipped" && submission.gads_error && (
            <div className="mt-2 text-[0.72rem] text-[var(--text3)]">Motivo: {submission.gads_error}</div>
          )}
        </section>

        <section className="ld-card">
          <div className="ld-card__title">Labels</div>
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
            className="ld-input"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {submission.labels.length === 0 && <span className="text-sm text-[var(--text3)]">Nenhum ainda</span>}
            {submission.labels.map((l) => (
              <span key={l} className="inline-flex items-center gap-1 rounded-full bg-[var(--bg)] px-2.5 py-1 text-xs text-[var(--text2)]">
                {l}
                <button onClick={() => onLabels(submission.labels.filter((x) => x !== l))} className="text-[var(--text3)] hover:text-[var(--red)]" aria-label={`Remover ${l}`}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        </section>

        <section className="ld-card">
          <div className="ld-card__title">
            Campos da resposta <span className="ld-count">{answered.length}/{steps.length}</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-start gap-3 py-3">
                <NumberedIcon type={s.type} n={i + 1} />
                <div className="min-w-0">
                  <div className="text-[0.85rem] font-medium text-[var(--text)]">{s.title}</div>
                  <div className="mt-0.5 break-words text-[0.85rem] text-[var(--text2)]">{answerText(s, submission.answers?.[s.id])}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 py-3">
              <span className="mono rounded bg-[var(--accent-dim)] px-2 py-1 text-[0.62rem] font-bold text-[var(--accent-ink)]"># score</span>
              <span className="text-[var(--text2)]">{submission.score}</span>
              <TierBadge tier={submission.tier} />
            </div>
          </div>
        </section>

        <div className="ld-actions">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="ld-btn ld-btn--accent">
              WhatsApp
            </a>
          )}
          <button type="button" className="ld-btn" onClick={close}>
            Fechar
          </button>
        </div>
      </aside>
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

function IcoSummary() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  );
}
function IcoTable() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 4v16" />
    </svg>
  );
}
function IcoPin() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
function IcoColumns() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="9.5" y="4" width="5" height="16" rx="1" />
      <rect x="16" y="4" width="5" height="16" rx="1" />
    </svg>
  );
}
function IcoLog() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v4l3 2" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
function IcoSpark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
    </svg>
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
