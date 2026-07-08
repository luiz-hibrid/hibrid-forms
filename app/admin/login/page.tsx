"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(
        data?.error === "admin_nao_configurado"
          ? "Painel ainda não configurado (defina ADMIN_PASSWORD)."
          : "Senha incorreta."
      );
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-5">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center justify-between">
          <Logo height={24} />
          <span className="lbl">Painel interno</span>
        </div>
        <form
          onSubmit={submit}
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-7"
        >
          <h1 className="text-[1.4rem] font-black tracking-tight text-[var(--text)]">
            Acessar leads
          </h1>
          <p className="mt-2 text-sm text-[var(--text2)]">
            Área restrita ao time da Hibrid.
          </p>
          <input
            type="password"
            autoFocus
            placeholder="Senha de acesso"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-6 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--acc2)] focus:shadow-[0_0_0_3px_rgba(194,251,141,0.4)]"
          />
          {error && <p className="mt-3 text-sm text-[var(--red)]">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-full bg-[var(--accent)] py-3 font-bold text-[var(--text)] transition hover:bg-[var(--acc2)] disabled:opacity-45"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
