"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Ws {
  id: string;
  name: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
function colorOf(name: string): string {
  const palette = ["#4b5735", "#3d7a00", "#246FDB", "#c53d5d", "#e37400", "#6b4bb5"];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % palette.length;
  return palette[h];
}

export function WorkspaceSwitcher({
  role,
  workspaces,
  activeId,
  userEmail,
}: {
  role: "master" | "client";
  workspaces: Ws[];
  activeId: string | null;
  userEmail: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const active =
    workspaces.find((w) => w.id === activeId) ??
    (role === "master" ? null : workspaces[0] ?? null);
  const label = active?.name ?? (role === "master" ? "Todos os clientes" : "Workspace");

  async function pick(id: string | null) {
    await fetch("/api/admin/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: id ?? "" }),
    });
    setOpen(false);
    router.refresh();
  }

  // Cliente: rótulo travado, sem dropdown
  if (role === "client") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-[var(--bg)] px-3 py-1.5">
        <Avatar name={label} />
        <span className="max-w-[160px] truncate text-sm font-medium text-[var(--text)]">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 transition hover:border-[#bbb]"
      >
        <Avatar name={label} />
        <span className="max-w-[180px] truncate text-sm font-medium text-[var(--text)]">
          {label}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text3)]">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[280px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="mono truncate text-[0.6rem] uppercase tracking-wider text-[var(--text3)]">
              {userEmail}
            </span>
            <span className="rounded-full bg-[rgba(36,111,219,0.12)] px-2 py-0.5 text-[0.55rem] font-bold uppercase text-[#246FDB]">
              Master
            </span>
          </div>
          <div className="max-h-[300px] overflow-y-auto border-t border-[var(--border)] py-1">
            <Item
              active={!activeId}
              name="Todos os clientes"
              subtitle="Visão geral"
              onClick={() => pick(null)}
            />
            {workspaces.map((w) => (
              <Item
                key={w.id}
                active={w.id === activeId}
                name={w.name}
                subtitle="Cliente"
                onClick={() => pick(w.id)}
              />
            ))}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              router.push("/admin/workspaces");
            }}
            className="w-full border-t border-[var(--border)] px-4 py-3 text-left text-sm font-bold text-[var(--text)] transition hover:bg-[var(--bg)]"
          >
            + Gerenciar clientes…
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[0.6rem] font-bold text-white"
      style={{ background: colorOf(name) }}
    >
      {initials(name)}
    </span>
  );
}

function Item({
  active,
  name,
  subtitle,
  onClick,
}: {
  active: boolean;
  name: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[var(--bg)] ${
        active ? "bg-[var(--bg)]" : ""
      }`}
    >
      <Avatar name={name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-[var(--text)]">{name}</span>
        <span className="block truncate text-[0.7rem] text-[var(--text3)]">{subtitle}</span>
      </span>
      {active && (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3d7a00" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
