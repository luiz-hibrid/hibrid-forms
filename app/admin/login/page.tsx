"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

// Ícones inline (sem lib externa) — traço fino, currentColor,
// no mesmo estilo dos demais ícones do painel.
function IconEye() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.7 5.1A10.4 10.4 0 0112 5c7 0 10 7 10 7a13.2 13.2 0 01-1.7 2.7" />
      <path d="M6.6 6.6A13.5 13.5 0 002 12s3 7 10 7a9.7 9.7 0 005.4-1.6" />
      <path d="M9.9 9.9a3 3 0 004.2 4.2" />
      <path d="M2 2l20 20" />
    </svg>
  );
}

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/admin/forms");
      router.refresh();
    } else {
      setError("E-mail ou senha incorretos.");
    }
  }

  return (
    <main className="login-page">
      <Logo height={34} className="login-logo" />

      <form onSubmit={submit} className="login-card">
        <h1 className="login-title">Acessar leads</h1>
        <p className="login-sub">Entre com seu e-mail e senha.</p>

        <div className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            autoFocus
            autoComplete="username"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
            aria-label="E-mail"
          />

          <div className="login-pass">
            <input
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Senha de acesso"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              aria-label="Senha"
            />
            <button
              type="button"
              className="login-eye"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
              title={showPass ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPass ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
        </div>

        {error && <p className="login-error">{error}</p>}

        <div className="mt-5">
          <button type="submit" disabled={loading} className="login-btn">
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </form>
    </main>
  );
}
