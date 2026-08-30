"use client";

import { useState } from "react";
import WhatsappDestinations from "@/components/WhatsappDestinations";

// ============================================================
// Destino padrão dos alertas de novo lead deste cliente.
// Vale para todos os formulários do workspace que não tiverem
// um destino próprio configurado na aba Integrações.
// ============================================================

export function WorkspaceWhatsappCard({
  workspaceId,
  initial,
}: {
  workspaceId: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ ok: boolean; msg: string } | null>(null);

  const dirty = value.trim() !== initial.trim();

  async function save() {
    setSaving(true);
    setSaved(null);
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyWhatsapp: value }),
      });
      const j = await res.json();
      if (j.ok) {
        setValue(j.notifyWhatsapp ?? "");
        setSaved({ ok: true, msg: "Destino salvo." });
      } else {
        setSaved({ ok: false, msg: j.error || "falha ao salvar" });
      }
    } catch {
      setSaved({ ok: false, msg: "falha de rede" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="lbl mb-1">Alerta de novo lead no WhatsApp</div>
      <p className="mb-4 text-sm text-[var(--text2)]">
        Para onde avisar quando este cliente receber um lead. Vale para todos os
        formulários do cliente — um formulário específico pode apontar para outro
        destino na aba Integrações.
      </p>

      <WhatsappDestinations
        value={value}
        onChange={(v) => {
          setValue(v);
          setSaved(null);
        }}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-[var(--text)] transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Salvando…" : "Salvar destino"}
        </button>
        {saved && (
          <span
            className={`text-[0.72rem] ${
              saved.ok ? "text-[var(--text2)]" : "text-[var(--red)]"
            }`}
          >
            {saved.ok ? "✓ " : "✕ "}
            {saved.msg}
          </span>
        )}
      </div>
    </div>
  );
}
