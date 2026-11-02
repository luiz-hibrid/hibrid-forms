"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface WsItem {
  id: string;
  name: string;
  slug: string;
  forms: number;
  users: number;
}

export function WorkspacesManager({ workspaces }: { workspaces: WsItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    if (res.ok) {
      setName("");
      router.refresh();
    } else alert("Não foi possível criar o cliente.");
  }

  const forms = workspaces.reduce((n, w) => n + w.forms, 0);
  const users = workspaces.reduce((n, w) => n + w.users, 0);
  return (
    <>
      <div className="ga-head">
        <h1>
          Clientes
        </h1>
        <div className="ga-stats">
          <HeadStat label="Clientes" value={workspaces.length} d="M4 20V8l8-4 8 4v12M9 20v-6h6v6" />
          <HeadStat label="Formulários" value={forms} d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />
          <HeadStat label="Usuários" value={users} d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM3 20c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
        </div>
      </div>
      <div className="ga-wrap">
        <p className="mb-5 text-sm text-[var(--text2)]">
          Cada cliente tem seus formulários, leads e logins.
        </p>

        <div className="mb-6 flex max-w-[640px] gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Nome do novo cliente…"
            className="flex-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm outline-none focus:border-[var(--acc2)]"
          />
          <button
            onClick={create}
            disabled={creating}
            className="rounded-full bg-[var(--text)] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-45"
          >
            {creating ? "Criando…" : "+ Novo cliente"}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((w) => (
            <Link
              key={w.id}
              href={`/admin/workspaces/${w.id}`}
              className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 transition hover:border-[#bbb]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-extrabold text-[#13171a]">
                  {w.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-bold text-[var(--text)]">{w.name}</div>
                  <div className="mono text-[11px] text-[var(--text3)]">/{w.slug}</div>
                </div>
              </div>
              <div className="mt-4 flex gap-4 text-sm text-[var(--text2)]">
                <span><b className="text-[var(--text)]">{w.forms}</b> formulários</span>
                <span><b className="text-[var(--text)]">{w.users}</b> usuários</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

function HeadStat({ label, value, d }: { label: string; value: number; d: string }) {
  return (
    <div className="ga-stat">
      <span className="ga-stat__ico">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={d} />
        </svg>
      </span>
      <div>
        <div className="ga-stat__v">{value}</div>
        <div className="ga-stat__l">{label}</div>
      </div>
    </div>
  );
}
