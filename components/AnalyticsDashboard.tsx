"use client";

import { useId, useMemo, useState } from "react";

// ============================================================
// Dashboard analítico de origem dos leads.
// Todos os gráficos são SVG/CSS próprios — sem biblioteca externa.
// Cross-filter: clicar numa barra filtra todos os outros painéis.
// ============================================================

export interface AnalyticsSubmission {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  score: number;
  tier: string | null;
  status: string;
  qualified?: boolean;
  tracking: Record<string, string> | null;
  geo_uf: string | null;
  geo_city: string | null;
  device?: string | null;
  gads_status: string | null;
  duration_ms?: number | null;
  created_at: string;
}

const TZ = "America/Sao_Paulo";
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Dimensões filtráveis do dashboard. */
type Dim = "campaign" | "term" | "adgroup" | "device" | "uf" | "weekday" | "hour";
type Filters = Partial<Record<Dim, string>>;

/** Linha já derivada — evita reprocessar data/tracking a cada render. */
interface Row {
  sub: AnalyticsSubmission;
  hour: number;
  weekday: number;
  dayKey: string;
  campaign: string | null;
  term: string | null;
  adgroup: string | null;
  source: string | null;
  device: string | null;
  uf: string | null;
}

function buildRows(subs: AnalyticsSubmission[]): Row[] {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return subs.map((sub) => {
    const parts = fmt.formatToParts(new Date(sub.created_at));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const hour = parseInt(get("hour"), 10) || 0;
    const year = Number(get("year"));
    const month = Number(get("month"));
    const day = Number(get("day"));
    // Dia da semana pela data já convertida ao fuso — evita depender do
    // nome localizado ("sáb." quebrava ao ser normalizado).
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const t = sub.tracking ?? {};
    return {
      sub,
      hour,
      weekday,
      dayKey: `${get("year")}-${get("month")}-${get("day")}`,
      campaign: t.utm_campaign || null,
      term: t.utm_term || null,
      adgroup: t.adgroup || t.utm_content || null,
      source: t.utm_source || null,
      device: sub.device || null,
      uf: sub.geo_uf || null,
    };
  });
}

function matches(r: Row, f: Filters): boolean {
  if (f.campaign && r.campaign !== f.campaign) return false;
  if (f.term && r.term !== f.term) return false;
  if (f.adgroup && r.adgroup !== f.adgroup) return false;
  if (f.device && r.device !== f.device) return false;
  if (f.uf && r.uf !== f.uf) return false;
  if (f.weekday && String(r.weekday) !== f.weekday) return false;
  if (f.hour && String(r.hour) !== f.hour) return false;
  return true;
}

/** Conta ocorrências de uma chave, ordenado do maior para o menor. */
function tally(rows: Row[], key: (r: Row) => string | null) {
  const map = new Map<string, { n: number; qual: number }>();
  rows.forEach((r) => {
    const v = key(r);
    if (!v) return;
    const cur = map.get(v) ?? { n: 0, qual: 0 };
    cur.n += 1;
    if (r.sub.qualified) cur.qual += 1;
    map.set(v, cur);
  });
  return Array.from(map.entries())
    .map(([label, v]) => ({ label, value: v.n, qualified: v.qual }))
    .sort((a, b) => b.value - a.value);
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

// ---------------------------------------------------------------- shell

export function AnalyticsDashboard({
  submissions,
  views,
  starts,
  avgMs,
  funnel,
  rail,
  onOpenLog,
}: {
  submissions: AnalyticsSubmission[];
  views: number;
  starts: number;
  avgMs: number | null;
  funnel?: React.ReactNode;
  rail?: React.ReactNode;
  /** abre o log de envios já filtrado por este status */
  onOpenLog?: (status?: string) => void;
}) {
  const [filters, setFilters] = useState<Filters>({});
  const allRows = useMemo(() => buildRows(submissions), [submissions]);
  const rows = useMemo(() => allRows.filter((r) => matches(r, filters)), [allRows, filters]);

  const toggle = (dim: Dim, value: string) =>
    setFilters((f) => (f[dim] === value ? { ...f, [dim]: undefined } : { ...f, [dim]: value }));

  const activeFilters = (Object.entries(filters) as [Dim, string | undefined][]).filter(
    (e): e is [Dim, string] => Boolean(e[1])
  );

  // ---- agregações
  const campaigns = useMemo(() => tally(rows, (r) => r.campaign), [rows]);
  const terms = useMemo(() => tally(rows, (r) => r.term), [rows]);
  const adgroups = useMemo(() => tally(rows, (r) => r.adgroup), [rows]);
  const devices = useMemo(() => tally(rows, (r) => r.device), [rows]);
  const ufs = useMemo(() => tally(rows, (r) => r.uf), [rows]);
  const sources = useMemo(() => tally(rows, (r) => r.source), [rows]);

  const byHour = useMemo(() => {
    const arr = Array(24).fill(0) as number[];
    rows.forEach((r) => (arr[r.hour] += 1));
    return arr;
  }, [rows]);

  const byWeekday = useMemo(() => {
    const arr = Array(7).fill(0) as number[];
    rows.forEach((r) => (arr[r.weekday] += 1));
    return arr;
  }, [rows]);

  const trend = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.dayKey, (map.get(r.dayKey) ?? 0) + 1));
    return Array.from(map.entries())
      .map(([day, n]) => {
        const [y, m, d] = day.split("-");
        return { day, n, t: new Date(`${y}-${m}-${d}T12:00:00Z`).getTime(), label: `${d}/${m}` };
      })
      .sort((a, b) => a.t - b.t);
  }, [rows]);

  const tiers = useMemo(() => {
    const order = ["quente", "morno", "frio"];
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const t = r.sub.tier;
      if (t) map.set(t, (map.get(t) ?? 0) + 1);
    });
    return order
      .filter((t) => map.has(t))
      .map((t) => ({ label: t, value: map.get(t)! }))
      .concat(
        Array.from(map.entries())
          .filter(([t]) => !order.includes(t))
          .map(([label, value]) => ({ label, value }))
      );
  }, [rows]);

  const gads = useMemo(() => {
    const map = { sent: 0, failed: 0, skipped: 0, pending: 0 };
    rows.forEach((r) => {
      const s = r.sub.gads_status;
      if (s === "sent") map.sent += 1;
      else if (s === "failed") map.failed += 1;
      else if (s === "skipped") map.skipped += 1;
      else if (r.sub.qualified) map.pending += 1;
    });
    return map;
  }, [rows]);

  const durations = rows.map((r) => r.sub.duration_ms).filter((d): d is number => !!d && d > 0);
  const localAvgMs = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : avgMs;

  const qualifiedCount = rows.filter((r) => r.sub.qualified).length;
  const trackedCount = allRows.filter((r) => r.campaign || r.term || r.source).length;
  const deviceCount = allRows.filter((r) => r.device).length;
  const total = allRows.length;
  const filtered = activeFilters.length > 0;

  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
      {/* ---------------- coluna central: dashboard ---------------- */}
      <div className="min-w-0 flex-1">
        {/* KPI band */}
        <div
          className="grid grid-cols-2 gap-3 rounded-2xl p-4 text-white sm:grid-cols-3 lg:grid-cols-6 sm:gap-4 sm:p-6"
          style={{ background: "var(--dark)" }}
        >
          <Kpi n={views} label="Visualizações" />
          <Kpi n={starts} label="Iniciaram" />
          <Kpi n={rows.length} label={filtered ? "Leads (filtro)" : "Respostas"} />
          <Kpi
            n={views > 0 && !filtered ? `${Math.round((rows.length / views) * 100)}%` : "—"}
            label="Taxa de conclusão"
          />
          <Kpi n={qualifiedCount} label="Qualificados" accent={qualifiedCount > 0} />
          <Kpi n={localAvgMs ? fmtDuration(localAvgMs) : "—"} label="Tempo médio" />
        </div>

        {/* Filtros ativos */}
        {filtered && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="lbl">Filtros</span>
            {activeFilters.map(([dim, value]) => (
              <button
                key={dim}
                onClick={() => setFilters((f) => ({ ...f, [dim]: undefined }))}
                className="mono group inline-flex items-center gap-1.5 rounded-full bg-[var(--dark)] px-3 py-1 text-[0.66rem] font-bold uppercase tracking-wider text-white transition hover:bg-[var(--text2)]"
              >
                {dimLabel(dim)}: {dimValueLabel(dim, value)}
                <span className="opacity-50 transition group-hover:opacity-100">✕</span>
              </button>
            ))}
            <button
              onClick={() => setFilters({})}
              className="mono rounded-full border border-[var(--border)] px-3 py-1 text-[0.66rem] font-bold uppercase tracking-wider text-[var(--text2)] transition hover:border-[var(--text2)] hover:text-[var(--text)]"
            >
              Limpar tudo
            </button>
          </div>
        )}

        {/* Tendência */}
        <Panel title="Entrada de leads por dia" className="mt-5">
          <TrendChart data={trend} />
        </Panel>

        {/* Origem */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel
            title="Campanhas"
            coverage={{ n: trackedCount, total, what: "com origem rastreada" }}
            empty={campaigns.length === 0 ? "Nenhum lead com utm_campaign ainda." : null}
          >
            <BarList
              items={campaigns}
              active={filters.campaign}
              onPick={(v) => toggle("campaign", v)}
              showQuality
            />
          </Panel>

          <Panel
            title="Termos que geram leads"
            coverage={{ n: allRows.filter((r) => r.term).length, total, what: "com termo" }}
            empty={
              terms.length === 0
                ? "Sem utm_term. Adicione {keyword} no template de URL do Google Ads."
                : null
            }
          >
            <BarList items={terms} active={filters.term} onPick={(v) => toggle("term", v)} showQuality />
          </Panel>

          <Panel
            title="Grupos de anúncio"
            coverage={{ n: allRows.filter((r) => r.adgroup).length, total, what: "com grupo" }}
            empty={
              adgroups.length === 0
                ? "Sem grupo de anúncio. Adicione adgroup={adgroupid} nas UTMs."
                : null
            }
          >
            <BarList items={adgroups} active={filters.adgroup} onPick={(v) => toggle("adgroup", v)} showQuality />
          </Panel>

          <Panel
            title="Origem do tráfego"
            empty={sources.length === 0 ? "Nenhum utm_source registrado." : null}
          >
            <BarList items={sources} />
          </Panel>
        </div>

        {/* Tempo */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Horário do dia" hint="Fuso de Brasília">
            <HourChart data={byHour} active={filters.hour} onPick={(h) => toggle("hour", h)} />
          </Panel>
          <Panel title="Dia da semana">
            <WeekChart data={byWeekday} active={filters.weekday} onPick={(d) => toggle("weekday", d)} />
          </Panel>
        </div>

        {/* Perfil */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel
            title="Dispositivo"
            coverage={{ n: deviceCount, total, what: "com dispositivo" }}
            empty={
              devices.length === 0
                ? "Ainda sem dados — a captura começou agora e vale para leads novos."
                : null
            }
          >
            <Donut items={devices} active={filters.device} onPick={(v) => toggle("device", v)} />
          </Panel>
          <Panel title="Estados (UF)" empty={ufs.length === 0 ? "Sem geolocalização." : null}>
            <BarList items={ufs.slice(0, 8)} active={filters.uf} onPick={(v) => toggle("uf", v)} />
          </Panel>
        </div>

        {/* Qualidade + operação */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Classificação dos leads" empty={tiers.length === 0 ? "Sem classificação." : null}>
            <TierBars items={tiers} total={rows.length} />
          </Panel>
          <Panel title="Conversões Google Ads">
            <GadsHealth {...gads} onOpenLog={onOpenLog} />
          </Panel>
        </div>

        {/* Funil de abandono por pergunta */}
        {funnel && <div className="mt-6">{funnel}</div>}
      </div>

      {/* ---------------- rail direito: respostas ---------------- */}
      {rail && (
        <aside className="w-full shrink-0 xl:w-[336px] 2xl:w-[380px]">{rail}</aside>
      )}
    </div>
  );
}

function dimLabel(d: Dim): string {
  return {
    campaign: "Campanha",
    term: "Termo",
    adgroup: "Grupo",
    device: "Dispositivo",
    uf: "UF",
    weekday: "Dia",
    hour: "Hora",
  }[d];
}
function dimValueLabel(d: Dim, v: string): string {
  if (d === "weekday") return WEEKDAYS[Number(v)] ?? v;
  if (d === "hour") return `${String(v).padStart(2, "0")}h`;
  if (d === "device") return DEVICE_PT[v] ?? v;
  return v;
}

const DEVICE_PT: Record<string, string> = {
  mobile: "Celular",
  tablet: "Tablet",
  desktop: "Computador",
};

// ---------------------------------------------------------------- primitivos

function Kpi({ n, label, accent }: { n: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <div
        className="text-[1.45rem] font-black leading-none tabular-nums sm:text-[1.8rem]"
        style={accent ? { color: "var(--accent)" } : undefined}
      >
        {n}
      </div>
      <div className="mt-1.5 text-[0.66rem] opacity-80 sm:text-[0.7rem]">{label}</div>
    </div>
  );
}

function Panel({
  title,
  hint,
  coverage,
  empty,
  className = "",
  children,
}: {
  title: string;
  hint?: string;
  coverage?: { n: number; total: number; what: string };
  empty?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const partial = coverage && coverage.n < coverage.total;
  return (
    <section
      className={`dash-in rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 ${className}`}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="lbl">{title}</span>
          {hint && <span className="text-[0.66rem] text-[var(--text3)]">{hint}</span>}
        </div>
        {coverage && (
          <span
            title={`${coverage.n} de ${coverage.total} leads ${coverage.what}`}
            className={`mono rounded-full px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide ${
              partial
                ? "bg-[var(--danger-dim)] text-[var(--red)]"
                : "bg-[var(--bg)] text-[var(--text3)]"
            }`}
          >
            {coverage.n}/{coverage.total} {coverage.what}
          </span>
        )}
      </header>
      {empty ? (
        <p className="py-6 text-center text-[0.78rem] leading-relaxed text-[var(--text3)]">{empty}</p>
      ) : (
        children
      )}
    </section>
  );
}

/** Barras horizontais ordenadas. O líder recebe o accent da marca. */
function BarList({
  items,
  active,
  onPick,
  showQuality,
}: {
  items: { label: string; value: number; qualified?: number }[];
  active?: string;
  onPick?: (v: string) => void;
  showQuality?: boolean;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const clickable = Boolean(onPick);
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => {
        const pct = (item.value / max) * 100;
        const isActive = active === item.label;
        const lead = i === 0;
        return (
          <button
            key={item.label}
            type="button"
            disabled={!clickable}
            onClick={() => onPick?.(item.label)}
            className={`group block w-full text-left ${clickable ? "cursor-pointer" : "cursor-default"}`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span
                className={`truncate text-[0.82rem] ${
                  isActive ? "font-bold text-[var(--text)]" : "text-[var(--text2)]"
                } ${clickable ? "group-hover:text-[var(--text)]" : ""}`}
              >
                {item.label}
              </span>
              <span className="mono shrink-0 text-[0.72rem] font-bold tabular-nums text-[var(--text)]">
                {item.value}
                {showQuality && item.qualified ? (
                  <span className="ml-1.5 font-normal text-[var(--text3)]">
                    · {Math.round((item.qualified / item.value) * 100)}% qual.
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg)]">
              <div
                className="dash-bar h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  animationDelay: `${i * 45}ms`,
                  background: isActive || lead ? "var(--accent)" : "var(--chart-3)",
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** 24 colunas — intensidade por opacidade, pico em accent. */
function HourChart({
  data,
  active,
  onPick,
}: {
  data: number[];
  active?: string;
  onPick: (h: string) => void;
}) {
  const max = Math.max(...data, 1);
  const peak = data.indexOf(max);
  return (
    <div>
      <div className="flex h-32 items-end gap-[3px]">
        {data.map((n, h) => {
          const isActive = active === String(h);
          const pct = (n / max) * 100;
          return (
            <button
              key={h}
              type="button"
              title={`${String(h).padStart(2, "0")}h — ${n} lead${n === 1 ? "" : "s"}`}
              onClick={() => onPick(String(h))}
              className="group relative flex h-full flex-1 items-end"
            >
              <div
                className="dash-col w-full rounded-t-[3px] transition-opacity group-hover:opacity-100"
                style={{
                  height: `${Math.max(pct, n > 0 ? 6 : 2)}%`,
                  animationDelay: `${h * 18}ms`,
                  background: isActive || h === peak ? "var(--accent)" : "var(--dark)",
                  opacity: isActive || h === peak ? 1 : n === 0 ? 0.08 : 0.22 + (n / max) * 0.45,
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="mono mt-2 flex justify-between text-[0.6rem] text-[var(--text3)]">
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  );
}

function WeekChart({
  data,
  active,
  onPick,
}: {
  data: number[];
  active?: string;
  onPick: (d: string) => void;
}) {
  const max = Math.max(...data, 1);
  const peak = data.indexOf(max);
  return (
    <div className="flex h-32 items-end gap-2">
      {data.map((n, d) => {
        const isActive = active === String(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => onPick(String(d))}
            className="group flex h-full flex-1 flex-col justify-end gap-1.5"
            title={`${WEEKDAYS[d]} — ${n} lead${n === 1 ? "" : "s"}`}
          >
            <span className="mono text-center text-[0.68rem] font-bold tabular-nums text-[var(--text)]">
              {n}
            </span>
            <div
              className="dash-col w-full rounded-t-[4px]"
              style={{
                height: `${Math.max((n / max) * 100, n > 0 ? 8 : 3)}%`,
                animationDelay: `${d * 55}ms`,
                background: isActive || d === peak ? "var(--accent)" : "var(--chart-3)",
              }}
            />
            <span
              className={`mono text-center text-[0.62rem] uppercase tracking-wider ${
                isActive ? "font-bold text-[var(--text)]" : "text-[var(--text3)]"
              }`}
            >
              {WEEKDAYS[d]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Rosca em SVG com traço animado. */
function Donut({
  items,
  active,
  onPick,
}: {
  items: { label: string; value: number }[];
  active?: string;
  onPick: (v: string) => void;
}) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const R = 52;
  const C = 2 * Math.PI * R;
  const shades = ["var(--accent)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
      <svg viewBox="0 0 140 140" className="h-[132px] w-[132px] shrink-0 -rotate-90">
        {items.map((item, i) => {
          const frac = item.value / total;
          const dash = frac * C;
          const el = (
            <circle
              key={item.label}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              strokeWidth={active && active !== item.label ? 14 : 18}
              stroke={shades[i % shades.length]}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
              className="dash-ring origin-center transition-[stroke-width] duration-200"
              style={{ animationDelay: `${i * 110}ms` }}
            />
          );
          offset += dash;
          return el;
        })}
        <text
          x="70"
          y="70"
          textAnchor="middle"
          dominantBaseline="central"
          className="rotate-90 origin-center fill-[var(--text)] text-[26px] font-black tabular-nums"
        >
          {total}
        </text>
      </svg>
      <div className="flex w-full flex-col gap-2">
        {items.map((item, i) => {
          const isActive = active === item.label;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onPick(item.label)}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${
                isActive ? "bg-[var(--bg)]" : "hover:bg-[var(--bg)]"
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: shades[i % shades.length] }}
              />
              <span className={`flex-1 text-[0.82rem] ${isActive ? "font-bold" : "text-[var(--text2)]"}`}>
                {DEVICE_PT[item.label] ?? item.label}
              </span>
              <span className="mono text-[0.72rem] font-bold tabular-nums">
                {Math.round((item.value / total) * 100)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Área + linha da evolução diária. */
/** Curva suave por Catmull-Rom→bezier — pontos discretos, leitura contínua. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;
  }
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function TrendChart({ data }: { data: { label: string; n: number; day: string }[] }) {
  const gradientId = useId();
  if (data.length === 0) {
    return <p className="py-8 text-center text-[0.78rem] text-[var(--text3)]">Sem leads no período.</p>;
  }
  const W = 800;
  const H = 150;
  const P = 8;
  const max = Math.max(...data.map((d) => d.n), 1);
  const step = data.length > 1 ? (W - P * 2) / (data.length - 1) : 0;
  const pts = data.map((d, i) => ({
    x: P + i * step,
    y: H - P - (d.n / max) * (H - P * 2),
    ...d,
  }));
  const line = smoothPath(pts);
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;
  // pico do período: único ponto que recebe o accent (marca é flat, verde é pontual)
  const peak = pts.reduce((a, b) => (b.n > a.n ? b : a), pts[0]);
  // entrada em cascata: a linha termina de desenhar por ~0.9s (.dash-line);
  // os pontos pousam em seguida, um a um, não todos juntos
  const dotDelayMs = (i: number) => 500 + i * 45;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* grade de referência — só orientação, some no ruído por trás dos dados */}
        {[1 / 3, 2 / 3].map((f) => (
          <line
            key={f}
            x1={P}
            x2={W - P}
            y1={H - P - f * (H - P * 2)}
            y2={H - P - f * (H - P * 2)}
            stroke="var(--chart-grid)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            className="dash-fade"
          />
        ))}
        <path d={area} fill={`url(#${gradientId})`} className="dash-fade" />
        <path
          d={line}
          fill="none"
          stroke="var(--dark)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="dash-line"
        />
        {pts.map((p, i) => (
          <circle
            key={p.day}
            cx={p.x}
            cy={p.y}
            r={p === peak ? 4.5 : 3}
            fill={p === peak ? "var(--accent)" : "var(--dark)"}
            stroke={p === peak ? "var(--dark)" : "none"}
            strokeWidth={p === peak ? 1.5 : 0}
            className="dash-point"
            style={{
              animationDelay: `${dotDelayMs(i)}ms`,
              filter: p === peak ? "drop-shadow(0 0 5px var(--accent-glow))" : undefined,
            }}
          >
            <title>{`${p.label} — ${p.n} lead${p.n === 1 ? "" : "s"}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mono mt-1 flex justify-between text-[0.6rem] text-[var(--text3)]">
        <span>{data[0].label}</span>
        {data.length > 2 && <span>{data[Math.floor(data.length / 2)].label}</span>}
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}

function TierBars({ items, total }: { items: { label: string; value: number }[]; total: number }) {
  const tone: Record<string, string> = {
    quente: "var(--accent)",
    morno: "var(--chart-3)",
    frio: "var(--chart-4)",
  };
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--bg)]">
        {items.map((item, i) => (
          <div
            key={item.label}
            className="dash-bar h-full"
            style={{
              width: `${(item.value / Math.max(total, 1)) * 100}%`,
              background: tone[item.label] ?? "var(--chart-4)",
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <div className="text-[1.35rem] font-black leading-none tabular-nums">{item.value}</div>
            <div className="mono mt-1.5 text-[0.62rem] uppercase tracking-wider text-[var(--text3)]">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GadsHealth({
  sent,
  failed,
  skipped,
  pending,
  onOpenLog,
}: {
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  onOpenLog?: (status?: string) => void;
}) {
  const cells = [
    { n: sent, label: "Enviadas", color: "var(--accent)", status: "sent" },
    { n: failed, label: "Falharam", color: "var(--red)", status: "failed" },
    { n: skipped, label: "Não enviadas", color: "var(--chart-3)", status: "skipped" },
    { n: pending, label: "Pendentes", color: "var(--chart-2)", status: undefined },
  ];
  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {cells.map((c) => {
          const clickable = Boolean(onOpenLog && c.status);
          return (
            <button
              key={c.label}
              type="button"
              disabled={!clickable}
              onClick={() => onOpenLog?.(c.status)}
              title={clickable ? "Ver no histórico de envios" : undefined}
              className={`rounded-xl bg-[var(--bg)] p-3 text-center transition ${
                clickable ? "cursor-pointer hover:bg-[var(--bg)]" : "cursor-default"
              }`}
            >
              <div className="text-[1.3rem] font-black leading-none tabular-nums">{c.n}</div>
              <div className="mono mt-1.5 text-[0.58rem] uppercase tracking-wider text-[var(--text3)]">
                {c.label}
              </div>
              <div
                className="mt-2 h-1 rounded-full"
                style={{ background: c.n > 0 ? c.color : "var(--border)" }}
              />
            </button>
          );
        })}
      </div>
      {skipped > 0 && (
        <p className="mt-3 text-[0.72rem] leading-relaxed text-[var(--text3)]">
          Leads ignorados normalmente chegaram sem <span className="mono">gclid</span> — a origem do
          anúncio não foi repassada até o formulário.
        </p>
      )}
      {onOpenLog && (
        <button
          onClick={() => onOpenLog(undefined)}
          className="mono mt-3 text-[0.62rem] uppercase tracking-wider text-[var(--text2)] underline-offset-2 hover:text-[var(--text)] hover:underline"
        >
          Ver histórico completo de envios →
        </button>
      )}
    </div>
  );
}
