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

  return (
    <div className="mx-auto max-w-[900px] px-5 py-8 sm:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.5rem] font-black tracking-tight text-[var(--text)]">Clientes</h1>
          <p className="mt-1 text-sm text-[var(--text2)]">
            Cada cliente é um workspace com seus formulários, leads e logins.
          </p>
        </div>
      </div>

      <div className="mb-6 flex gap-2">
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

      <div className="grid gap-3 sm:grid-cols-2">
        {workspaces.map((w) => (
          <Link
            key={w.id}
            href={`/admin/workspaces/${w.id}`}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 transition hover:border-[#bbb]"
          >
            <div className="font-bold text-[var(--text)]">{w.name}</div>
            <div className="mono mt-1 text-[11px] text-[var(--text3)]">/{w.slug}</div>
            <div className="mt-3 flex gap-4 text-sm text-[var(--text2)]">
              <span>{w.forms} formulários</span>
              <span>{w.users} usuários</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
