"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface U {
  id: string;
  email: string;
  active: boolean;
}

export function UsersManager({
  workspaceId,
  users,
}: {
  workspaceId: string;
  users: U[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!email.trim() || !password.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/admin/workspaces/${workspaceId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setEmail("");
      setPassword("");
      router.refresh();
    } else {
      alert(
        data.error === "email_ja_existe"
          ? "Esse e-mail já está em uso."
          : "Não foi possível criar o usuário."
      );
    }
  }

  async function resetPass(id: string) {
    const p = prompt("Nova senha para este usuário:");
    if (!p) return;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: p }),
    });
    if (res.ok) alert("Senha atualizada.");
    else alert("Falha ao atualizar a senha.");
  }

  async function toggleActive(id: string, active: boolean) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    if (res.ok) router.refresh();
  }

  const loginUrl =
    typeof window !== "undefined" ? `${window.location.origin}/admin/login` : "/admin/login";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="lbl mb-3">Usuários do cliente</div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--bg)] px-3 py-2.5">
        <span className="mono text-[0.6rem] uppercase tracking-wider text-[var(--text3)]">
          Link de acesso do cliente
        </span>
        <code className="flex-1 truncate text-sm text-[var(--text)]">{loginUrl}</code>
        <button
          onClick={() => navigator.clipboard?.writeText(loginUrl).catch(() => {})}
          className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--text2)] hover:border-[#bbb] hover:text-[var(--text)]"
        >
          Copiar
        </button>
      </div>
      <p className="mb-4 text-[0.72rem] text-[var(--text3)]">
        Envie este link ao cliente junto com o e-mail e a senha que você cadastrar abaixo.
        Ele entra e vê apenas os formulários e leads deste workspace.
      </p>

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@cliente.com"
          className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--acc2)]"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="senha inicial"
          className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--acc2)]"
        />
        <button
          onClick={create}
          disabled={busy}
          className="rounded-md bg-[var(--text)] px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-45"
        >
          Adicionar
        </button>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {users.length === 0 && (
          <p className="py-3 text-sm text-[var(--text3)]">
            Nenhum usuário ainda. Crie um login para o cliente acessar só este workspace.
          </p>
        )}
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-[var(--text)]">{u.email}</div>
              <span
                className={`mono text-[0.6rem] uppercase ${
                  u.active ? "text-[#3d7a00]" : "text-[var(--text3)]"
                }`}
              >
                {u.active ? "ativo" : "desativado"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => resetPass(u.id)}
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text2)] hover:border-[#bbb] hover:text-[var(--text)]"
              >
                Resetar senha
              </button>
              <button
                onClick={() => toggleActive(u.id, u.active)}
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text2)] hover:border-[#bbb] hover:text-[var(--text)]"
              >
                {u.active ? "Desativar" : "Ativar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
