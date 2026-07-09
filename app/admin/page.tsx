import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { TierBadge } from "@/components/TierBadge";
import { AdminHeader } from "@/components/AdminHeader";

export const dynamic = "force-dynamic";

interface Submission {
  id: string;
  form_slug: string;
  form_name: string | null;
  status: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  score: number;
  tier: string | null;
  qualified: boolean;
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

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tier?: string };
}) {
  if (!isAuthenticated()) redirect("/admin/login");

  const tierFilter = searchParams.tier;

  if (!isSupabaseConfigured()) {
    return (
      <Shell>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <h2 className="text-lg font-bold text-[var(--text)]">
            Conecte o Supabase para ver os leads
          </h2>
          <p className="mt-2 text-sm text-[var(--text2)]">
            Defina as variáveis <code>SUPABASE_URL</code> e{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> na Vercel e rode o
            <code> supabase-schema.sql</code> no seu projeto Supabase.
          </p>
        </div>
      </Shell>
    );
  }

  const supabase = getSupabaseAdmin()!;
  let query = supabase
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (tierFilter) query = query.eq("tier", tierFilter);

  const { data, error } = await query;
  const rows = (data ?? []) as Submission[];

  const counts = {
    total: rows.length,
    quente: rows.filter((r) => r.tier === "quente").length,
    morno: rows.filter((r) => r.tier === "morno").length,
    frio: rows.filter((r) => r.tier === "frio").length,
  };

  const exportHref = `/api/admin/export${
    tierFilter ? `?tier=${tierFilter}` : ""
  }`;

  return (
    <Shell>
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total de leads" value={counts.total} />
        <Kpi label="Quentes" value={counts.quente} accent />
        <Kpi label="Mornos" value={counts.morno} />
        <Kpi label="Frios" value={counts.frio} />
      </div>

      {/* Filtros + export */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterPill href="/admin" active={!tierFilter} label="Todos" />
          <FilterPill href="/admin?tier=quente" active={tierFilter === "quente"} label="Quentes" />
          <FilterPill href="/admin?tier=morno" active={tierFilter === "morno"} label="Mornos" />
          <FilterPill href="/admin?tier=frio" active={tierFilter === "frio"} label="Frios" />
        </div>
        <a
          href={exportHref}
          className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text2)] transition hover:border-[#bbb] hover:text-[var(--text)]"
        >
          Exportar CSV
        </a>
      </div>

      {/* Tabela */}
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                <Th>Data</Th>
                <Th>Nome</Th>
                <Th>Contato</Th>
                <Th>Formulário</Th>
                <Th className="text-right">Score</Th>
                <Th>Faixa</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--red)]">
                    Erro ao carregar leads: {error.message}
                  </td>
                </tr>
              )}
              {!error && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[var(--text2)]">
                    Nenhum lead ainda. Assim que alguém enviar o formulário,
                    aparece aqui.
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
                  <td className="px-4 py-3 font-medium text-[var(--text)]">
                    {r.nome || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--text2)]">
                    <div>{r.email || "—"}</div>
                    <div className="mono text-[0.7rem] text-[var(--text3)]">
                      {r.telefone || ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text2)]">
                    {r.form_name || r.form_slug}
                  </td>
                  <td className="px-4 py-3 text-right font-black tabular-nums text-[var(--text)]">
                    {r.score}
                  </td>
                  <td className="px-4 py-3">
                    <TierBadge tier={r.tier} />
                  </td>
                  <td className="px-4 py-3 text-right">
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
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <AdminHeader active="leads" />
      <div className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8">{children}</div>
    </main>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-xl border bg-[var(--card)] p-4"
      style={{ borderColor: accent ? "var(--accent)" : "var(--border)" }}
    >
      <div className="lbl">{label}</div>
      <div className="mt-2 text-[1.8rem] font-black leading-none tracking-tight text-[var(--text)]">
        {value}
      </div>
    </div>
  );
}

function FilterPill({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-[var(--text)] text-white"
          : "border border-[var(--border)] bg-[var(--card)] text-[var(--text2)] hover:border-[#bbb] hover:text-[var(--text)]"
      }`}
    >
      {label}
    </Link>
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
      className={`mono px-4 py-3 text-[0.6rem] font-normal uppercase tracking-wider text-[var(--text3)] ${className}`}
    >
      {children}
    </th>
  );
}
