"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewFormButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    const res = await fetch("/api/admin/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Novo formulário" }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok && data.id) {
      router.push(`/admin/forms/${data.id}`);
    } else {
      alert("Não foi possível criar o formulário.");
    }
  }

  return (
    <button
      onClick={create}
      disabled={loading}
      className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--text)] transition hover:bg-[var(--acc2)] disabled:opacity-45"
    >
      {loading ? "Criando…" : "+ Novo formulário"}
    </button>
  );
}
