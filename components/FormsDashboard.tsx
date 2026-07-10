"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormListItem } from "@/lib/forms-db";

type SortKey = "recent" | "name" | "responses";

export function FormsDashboard({
  forms,
  canCreate = false,
}: {
  forms: FormListItem[];
  canCreate?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<"list" | "grid">("grid");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    let list = forms.filter(
      (f) =>
        f.name.toLowerCase().includes(q.toLowerCase()) ||
        f.slug.toLowerCase().includes(q.toLowerCase())
    );
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "responses") return b.responses - a.responses;
      return (b.created_at || "").localeCompare(a.created_at || "");
    });
    return list;
  }, [forms, q, sort]);

  async function createForm() {
    setCreating(true);
    const res = await fetch("/api/admin/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Novo formulário" }),
    });
    const data = await res.json().catch(() => ({}));
    setCreating(false);
    if (res.ok && data.id) router.push(`/admin/forms/${data.id}`);
    else if (data.error === "selecione_workspace")
      alert("Selecione um cliente no seletor de workspace antes de criar o formulário.");
    else alert("Não foi possível criar o formulário.");
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Excluir "${name}" e suas respostas? Não pode ser desfeito.`)) return;
    const res = await fetch(`/api/admin/forms/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else alert("Não foi possível excluir.");
  }

  return (
    <div className="mx-auto flex max-w-[1100px] gap-6 px-5 py-8 sm:px-8">
      {/* Sidebar de pastas */}
      <aside className="hidden w-[190px] shrink-0 md:block">
        <div className="lbl mb-3">Pastas</div>
        <div className="grid gap-1">
          <div className="rounded-lg bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--text)] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            Todos os formulários
          </div>
          <button
            disabled
            title="Em breve"
            className="mt-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--text3)]"
          >
            + Nova pasta
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="min-w-0 flex-1">
        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
              </svg>
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Pesquisar formulário…"
              className="w-full rounded-full border border-[var(--border)] bg-[var(--card)] py-2.5 pl-9 pr-4 text-sm text-[var(--text)] outline-none focus:border-[var(--acc2)] focus:shadow-[0_0_0_3px_rgba(194,251,141,0.3)]"
            />
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--text2)]"
          >
            <option value="recent">Mais recentes</option>
            <option value="name">Nome (A–Z)</option>
            <option value="responses">Mais respostas</option>
          </select>

          <div className="flex items-center rounded-full border border-[var(--border)] bg-[var(--card)] p-1">
            <ViewBtn active={view === "list"} onClick={() => setView("list")} label="Lista">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </ViewBtn>
            <ViewBtn active={view === "grid"} onClick={() => setView("grid")} label="Grade">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </ViewBtn>
          </div>

          {canCreate && (
            <button
              onClick={createForm}
              disabled={creating}
              className="rounded-full bg-[var(--text)] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-45"
            >
              {creating ? "Criando…" : "+ Criar formulário"}
            </button>
          )}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg)] text-[var(--text3)]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M9 12h6M9 16h6M9 8h6M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
              </svg>
            </div>
            <p className="mt-4 text-sm text-[var(--text2)]">
              {q
                ? "Nenhum formulário encontrado para essa busca."
                : "Nenhum formulário ainda. Clique em “Criar formulário” para começar."}
            </p>
          </div>
        )}

        {/* Grade */}
        {view === "grid" && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((f) => (
              <div
                key={f.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition hover:border-[#bbb]"
              >
                <Link
                  href={`/admin/forms/${f.id}/respostas`}
                  className="flex h-28 items-center justify-center bg-[var(--bg)] text-[var(--text3)]"
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M9 12h6M9 16h6M9 8h6M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
                  </svg>
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/admin/forms/${f.id}`}
                      className="truncate font-bold text-[var(--text)] hover:underline"
                    >
                      {f.name}
                    </Link>
                    <StatusDot published={f.published} />
                  </div>
                  <div className="mono mt-1 text-[11px] text-[var(--text3)]">
                    {f.responses} respostas · {f.steps} etapas
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Link
                      href={`/admin/forms/${f.id}/respostas`}
                      className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[var(--text)] transition hover:bg-[var(--acc2)]"
                    >
                      Respostas
                    </Link>
                    {canCreate && (
                      <>
                        <Link
                          href={`/admin/forms/${f.id}`}
                          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text2)] transition hover:border-[#bbb] hover:text-[var(--text)]"
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => remove(f.id, f.name)}
                          className="ml-auto text-[var(--text3)] hover:text-[var(--red)]"
                          aria-label="Excluir"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H7a1 1 0 01-1-1V6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lista */}
        {view === "list" && filtered.length > 0 && (
          <div className="grid gap-3">
            {filtered.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Link
                    href={`/admin/forms/${f.id}/respostas`}
                    className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--bg)] text-[var(--text3)]"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M9 12h6M9 16h6M9 8h6M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
                    </svg>
                  </Link>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/forms/${f.id}`} className="truncate font-bold text-[var(--text)] hover:underline">
                        {f.name}
                      </Link>
                      <StatusDot published={f.published} />
                    </div>
                    <div className="mono mt-0.5 text-[11px] text-[var(--text3)]">
                      {f.responses} respostas · /f/{f.slug}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link href={`/admin/forms/${f.id}/respostas`} className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--text)] transition hover:bg-[var(--acc2)]">
                    Respostas
                  </Link>
                  {canCreate && (
                    <>
                      <Link href={`/admin/forms/${f.id}`} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text2)] transition hover:border-[#bbb] hover:text-[var(--text)]">
                        Editar
                      </Link>
                      <button onClick={() => remove(f.id, f.name)} className="text-[var(--text3)] hover:text-[var(--red)]" aria-label="Excluir">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H7a1 1 0 01-1-1V6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ViewBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
        active ? "bg-[var(--text)] text-white" : "text-[var(--text3)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

function StatusDot({ published }: { published: boolean }) {
  return published ? (
    <span className="mono shrink-0 rounded-full bg-[rgba(194,251,141,0.22)] px-2 py-0.5 text-[0.55rem] font-bold uppercase text-[#3d7a00]">
      Publicado
    </span>
  ) : (
    <span className="mono shrink-0 rounded-full bg-[rgba(0,0,0,0.06)] px-2 py-0.5 text-[0.55rem] font-bold uppercase text-[var(--text3)]">
      Rascunho
    </span>
  );
}
