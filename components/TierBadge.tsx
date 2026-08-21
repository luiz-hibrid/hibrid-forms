const MAP: Record<string, { label: string; bg: string; color: string }> = {
  quente: { label: "Quente", bg: "var(--success-dim)", color: "var(--success)" },
  morno: { label: "Morno", bg: "var(--warning-dim)", color: "var(--warning-ink)" },
  frio: { label: "Frio", bg: "var(--border)", color: "var(--text2)" },
};

export function TierBadge({ tier }: { tier?: string | null }) {
  const t = (tier && MAP[tier]) || MAP.frio;
  return (
    <span
      className="mono inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wide"
      style={{ background: t.bg, color: t.color }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: t.color }}
      />
      {t.label}
    </span>
  );
}
