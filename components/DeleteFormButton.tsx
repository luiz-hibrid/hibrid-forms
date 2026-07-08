"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteFormButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    if (!confirm(`Excluir o formulário "${name}"? Essa ação não pode ser desfeita.`))
      return;
    setLoading(true);
    const res = await fetch(`/api/admin/forms/${id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) router.refresh();
    else alert("Não foi possível excluir.");
  }

  return (
    <button
      onClick={remove}
      disabled={loading}
      className="text-[var(--text3)] transition hover:text-[var(--red)] disabled:opacity-45"
      title="Excluir"
      aria-label="Excluir"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H7a1 1 0 01-1-1V6" />
      </svg>
    </button>
  );
}
