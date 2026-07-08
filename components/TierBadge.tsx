const MAP: Record<string, { label: string; bg: string; color: string }> = {
  quente: { label: "Quente", bg: "rgba(194,251,141,0.22)", color: "#3d7a00" },
  morno: { label: "Morno", bg: "rgba(240,184,34,0.16)", color: "#8a6200" },
  frio: { label: "Frio", bg: "rgba(0,0,0,0.06)", color: "#666" },
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
