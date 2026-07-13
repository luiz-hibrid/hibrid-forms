"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormListItem, FormPreview } from "@/lib/forms-db";

type SortKey = "recent" | "name" | "responses";

export interface RecentLead {
  id: string;
  nome: string | null;
  email: string | null;
  form_name: string | null;
  form_slug: string;
  status: string;
  tier: string | null;
  qualified: boolean | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  try {
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  } catch {
    return "";
  }
}

export function FormsDashboard({
  forms,
  canManage = false,
  workspaces = [],
  recentLeads = [],
}: {
  forms: FormListItem[];
  canManage?: boolean;
  workspaces?: { id: string; name: string }[];
  recentLeads?: RecentLead[];
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

  return (
    <div className="mx-auto flex max-w-[1320px] gap-6 px-5 py-8 sm:px-8">
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

          {canManage && (
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
                className="group relative flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] transition hover:border-[#bbb]"
              >
                <Link
                  href={`/admin/forms/${f.id}/respostas`}
                  className="block h-28 overflow-hidden rounded-t-2xl"
                >
                  <FormThumb preview={f.preview} />
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
                    <div className="ml-auto">
                      <FormMenu
                        form={f}
                        canManage={canManage}
                        workspaces={workspaces}
                        onChanged={() => router.refresh()}
                      />
                    </div>
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
                    className="h-11 w-14 shrink-0 overflow-hidden rounded-lg"
                  >
                    <FormThumb preview={f.preview} compact />
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
                  <FormMenu
                    form={f}
                    canManage={canManage}
                    workspaces={workspaces}
                    onChanged={() => router.refresh()}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Últimos leads */}
      <aside className="hidden w-[280px] shrink-0 xl:block">
        <RecentLeads leads={recentLeads} />
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- Últimos leads
function RecentLeads({ leads }: { leads: RecentLead[] }) {
  function initial(l: RecentLead): string {
    const n = (l.nome || l.email || "?").trim();
    return n ? n[0].toUpperCase() : "?";
  }
  return (
    <div className="sticky top-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="lbl">Últimos leads</span>
        <span className="mono text-[0.62rem] text-[var(--text3)]">{leads.length}</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        {leads.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-[var(--text3)]">
            Nenhum lead ainda.
          </p>
        )}
        {leads.map((l) => (
          <Link
            key={l.id}
            href={`/admin/${l.id}`}
            className="flex items-start gap-2.5 border-b border-[var(--border)] px-3 py-2.5 transition last:border-0 hover:bg-[var(--bg)]"
          >
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-white ${
                l.qualified ? "bg-[#3d7a00]" : "bg-[#8a94a6]"
              }`}
            >
              {initial(l)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-[var(--text)]">
                  {l.nome || l.email || "Lead"}
                </span>
                <span className="mono shrink-0 text-[0.6rem] text-[var(--text3)]">
                  {timeAgo(l.created_at)}
                </span>
              </div>
              <div className="truncate text-[0.72rem] text-[var(--text3)]">
                {l.form_name || l.form_slug}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                {l.status !== "complete" && (
                  <span className="mono rounded-full bg-[rgba(0,0,0,0.06)] px-1.5 py-0.5 text-[0.5rem] font-bold uppercase text-[var(--text3)]">
                    Parcial
                  </span>
                )}
                {l.qualified && (
                  <span className="mono rounded-full bg-[rgba(194,251,141,0.25)] px-1.5 py-0.5 text-[0.5rem] font-bold uppercase text-[#3d7a00]">
                    Qualificado
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Menu de ações
function FormMenu({
  form,
  canManage,
  workspaces,
  onChanged,
}: {
  form: FormListItem;
  canManage: boolean;
  workspaces: { id: string; name: string }[];
  onChanged: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setMoving(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/f/${form.slug}` : `/f/${form.slug}`;

  function close() {
    setOpen(false);
    setMoving(false);
  }

  async function duplicate() {
    close();
    const res = await fetch(`/api/admin/forms/${form.id}/duplicate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.id) router.push(`/admin/forms/${data.id}`);
    else alert("Não foi possível duplicar.");
  }

  async function moveTo(workspaceId: string) {
    close();
    const res = await fetch(`/api/admin/forms/${form.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    if (res.ok) onChanged();
    else alert("Não foi possível mover.");
  }

  async function remove() {
    close();
    if (!confirm(`Excluir "${form.name}" e suas respostas? Não pode ser desfeito.`)) return;
    const res = await fetch(`/api/admin/forms/${form.id}`, { method: "DELETE" });
    if (res.ok) onChanged();
    else alert("Não foi possível excluir.");
  }

  function copyLink() {
    close();
    navigator.clipboard?.writeText(publicUrl).catch(() => {});
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Mais opções"
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text3)] transition hover:bg-[var(--bg)] hover:text-[var(--text)]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[220px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] py-1.5 shadow-xl">
          {!moving && (
            <>
              {canManage && (
                <MenuItem icon={<IcoEdit />} onClick={() => { close(); router.push(`/admin/forms/${form.id}`); }}>
                  Editar
                </MenuItem>
              )}
              <MenuItem icon={<IcoPie />} onClick={() => { close(); router.push(`/admin/forms/${form.id}/respostas`); }}>
                Ver respostas
              </MenuItem>
              {canManage && (
                <>
                  <MenuItem icon={<IcoShare />} onClick={() => { close(); router.push(`/admin/forms/${form.id}?tab=share`); }}>
                    Compartilhar
                  </MenuItem>
                  <MenuItem icon={<IcoIntegrate />} onClick={() => { close(); router.push(`/admin/forms/${form.id}?tab=integrate`); }}>
                    Integrar
                  </MenuItem>
                </>
              )}

              <Divider />
              <MenuItem icon={<IcoLink />} onClick={copyLink}>Copiar link</MenuItem>
              <MenuItem icon={<IcoExternal />} onClick={() => { close(); window.open(publicUrl, "_blank"); }}>
                Abrir em nova aba
              </MenuItem>

              {canManage && (
                <>
                  <Divider />
                  <MenuItem icon={<IcoDuplicate />} onClick={duplicate}>Duplicar</MenuItem>
                  <MenuItem icon={<IcoMove />} onClick={() => setMoving(true)} chevron>
                    Mover para workspace
                  </MenuItem>
                  <MenuItem icon={<IcoFolder />} disabled>Mover para pasta</MenuItem>
                  <MenuItem icon={<IcoExport />} onClick={() => { close(); window.location.href = `/api/admin/export?form=${form.slug}`; }}>
                    Exportar
                  </MenuItem>
                  <Divider />
                  <MenuItem icon={<IcoTrash />} danger onClick={remove}>Excluir</MenuItem>
                </>
              )}
            </>
          )}

          {moving && (
            <>
              <button
                onClick={() => setMoving(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[0.72rem] font-bold uppercase tracking-wider text-[var(--text3)] hover:text-[var(--text)]"
              >
                ← Mover para…
              </button>
              <Divider />
              <div className="max-h-[240px] overflow-y-auto">
                {workspaces.length === 0 && (
                  <p className="px-3 py-2 text-sm text-[var(--text3)]">Nenhum cliente.</p>
                )}
                {workspaces.map((w) => (
                  <MenuItem key={w.id} icon={<IcoWs />} onClick={() => moveTo(w.id)}>
                    {w.name}
                  </MenuItem>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  danger,
  disabled,
  chevron,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  chevron?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
        disabled
          ? "cursor-not-allowed text-[var(--text3)] opacity-60"
          : danger
          ? "text-[var(--red)] hover:bg-[rgba(255,69,69,0.08)]"
          : "text-[var(--text)] hover:bg-[var(--bg)]"
      }`}
    >
      <span className="shrink-0 text-[var(--text3)]">{icon}</span>
      <span className="flex-1 truncate">{children}</span>
      {chevron && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text3)]">
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-[var(--border)]" />;
}

const IK = {
  w: 16,
  h: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
function IcoEdit() {
  return (<svg width={IK.w} height={IK.h} viewBox={IK.viewBox} fill={IK.fill} stroke={IK.stroke} strokeWidth={IK.strokeWidth} strokeLinecap={IK.strokeLinecap} strokeLinejoin={IK.strokeLinejoin}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" /></svg>);
}
function IcoPie() {
  return (<svg width={IK.w} height={IK.h} viewBox={IK.viewBox} fill={IK.fill} stroke={IK.stroke} strokeWidth={IK.strokeWidth} strokeLinecap={IK.strokeLinecap} strokeLinejoin={IK.strokeLinejoin}><path d="M21.21 15.89A10 10 0 118 2.83" /><path d="M22 12A10 10 0 0012 2v10z" /></svg>);
}
function IcoShare() {
  return (<svg width={IK.w} height={IK.h} viewBox={IK.viewBox} fill={IK.fill} stroke={IK.stroke} strokeWidth={IK.strokeWidth} strokeLinecap={IK.strokeLinecap} strokeLinejoin={IK.strokeLinejoin}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>);
}
function IcoIntegrate() {
  return (<svg width={IK.w} height={IK.h} viewBox={IK.viewBox} fill={IK.fill} stroke={IK.stroke} strokeWidth={IK.strokeWidth} strokeLinecap={IK.strokeLinecap} strokeLinejoin={IK.strokeLinejoin}><rect x="9" y="2" width="6" height="6" rx="1" /><rect x="2" y="16" width="6" height="6" rx="1" /><rect x="16" y="16" width="6" height="6" rx="1" /><path d="M12 8v4M12 12H5v4M12 12h7v4" /></svg>);
}
function IcoLink() {
  return (<svg width={IK.w} height={IK.h} viewBox={IK.viewBox} fill={IK.fill} stroke={IK.stroke} strokeWidth={IK.strokeWidth} strokeLinecap={IK.strokeLinecap} strokeLinejoin={IK.strokeLinejoin}><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1.5-1.5" /></svg>);
}
function IcoExternal() {
  return (<svg width={IK.w} height={IK.h} viewBox={IK.viewBox} fill={IK.fill} stroke={IK.stroke} strokeWidth={IK.strokeWidth} strokeLinecap={IK.strokeLinecap} strokeLinejoin={IK.strokeLinejoin}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><path d="M15 3h6v6M10 14L21 3" /></svg>);
}
function IcoDuplicate() {
  return (<svg width={IK.w} height={IK.h} viewBox={IK.viewBox} fill={IK.fill} stroke={IK.stroke} strokeWidth={IK.strokeWidth} strokeLinecap={IK.strokeLinecap} strokeLinejoin={IK.strokeLinejoin}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>);
}
function IcoMove() {
  return (<svg width={IK.w} height={IK.h} viewBox={IK.viewBox} fill={IK.fill} stroke={IK.stroke} strokeWidth={IK.strokeWidth} strokeLinecap={IK.strokeLinecap} strokeLinejoin={IK.strokeLinejoin}><path d="M4 7h11l-3-3M20 17H9l3 3" /></svg>);
}
function IcoFolder() {
  return (<svg width={IK.w} height={IK.h} viewBox={IK.viewBox} fill={IK.fill} stroke={IK.stroke} strokeWidth={IK.strokeWidth} strokeLinecap={IK.strokeLinecap} strokeLinejoin={IK.strokeLinejoin}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>);
}
function IcoExport() {
  return (<svg width={IK.w} height={IK.h} viewBox={IK.viewBox} fill={IK.fill} stroke={IK.stroke} strokeWidth={IK.strokeWidth} strokeLinecap={IK.strokeLinecap} strokeLinejoin={IK.strokeLinejoin}><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" /><path d="M12 3v13M7 8l5-5 5 5" /></svg>);
}
function IcoTrash() {
  return (<svg width={IK.w} height={IK.h} viewBox={IK.viewBox} fill={IK.fill} stroke={IK.stroke} strokeWidth={IK.strokeWidth} strokeLinecap={IK.strokeLinecap} strokeLinejoin={IK.strokeLinejoin}><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H7a1 1 0 01-1-1V6" /></svg>);
}
function IcoWs() {
  return (<svg width={IK.w} height={IK.h} viewBox={IK.viewBox} fill={IK.fill} stroke={IK.stroke} strokeWidth={IK.strokeWidth} strokeLinecap={IK.strokeLinecap} strokeLinejoin={IK.strokeLinejoin}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18" /></svg>);
}

// Mini-prévia (print ao vivo) da tela de boas-vindas do formulário
function FormThumb({ preview: p, compact }: { preview: FormPreview; compact?: boolean }) {
  return (
    <div
      className="relative flex h-full w-full flex-col justify-center overflow-hidden"
      style={{ background: p.bg, padding: compact ? "6px" : "12px 16px" }}
    >
      {p.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.logoUrl}
          alt=""
          style={{ position: "absolute", left: compact ? 5 : 10, top: compact ? 4 : 8, height: compact ? 7 : 13, width: "auto", objectFit: "contain" }}
        />
      )}
      <div
        className="font-black leading-tight"
        style={{
          color: p.questionColor,
          fontSize: compact ? 6 : 12,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {p.title}
      </div>
      {!compact && p.subtitle && (
        <div
          className="mt-1 leading-snug"
          style={{
            color: p.subtitleColor,
            fontSize: 8,
            display: "-webkit-box",
            WebkitLineClamp: 1,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {p.subtitle}
        </div>
      )}
      <div
        className="mt-2 w-fit rounded-full font-bold"
        style={{
          background: p.buttonBg,
          color: p.buttonText,
          fontSize: compact ? 5 : 8,
          padding: compact ? "2px 5px" : "4px 9px",
          marginTop: compact ? 3 : 8,
        }}
      >
        {p.buttonLabel}
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
