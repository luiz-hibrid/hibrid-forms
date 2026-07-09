import type { EndScreen, Tier } from "@/lib/types";

/** prefixo do valor `next` de uma opção que roteia para uma tela final específica */
export const END_PREFIX = "end:";

const TIER_NAMES: Record<string, string> = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
};

export interface NormalizedEnds {
  endScreens: EndScreen[];
  tiers: Tier[];
  defaultEndScreenId?: string;
}

/**
 * Converte o formato antigo (endScreens indexados por `tier`) para o novo
 * (telas finais nomeadas com id + faixas apontando para elas). Idempotente.
 */
export function normalizeEnds(cfg: {
  endScreens?: any[];
  tiers?: any[];
  defaultEndScreenId?: string;
}): NormalizedEnds {
  const rawEnds = Array.isArray(cfg.endScreens) ? cfg.endScreens : [];
  const endScreens: EndScreen[] = rawEnds.map((e, i) => ({
    id: e.id ?? e.tier ?? `end_${i + 1}`,
    name: e.name ?? TIER_NAMES[e.tier] ?? e.tier ?? `Tela ${i + 1}`,
    title: e.title ?? "Obrigado!",
    message: e.message ?? "Recebemos suas respostas.",
    ctaLabel: e.ctaLabel,
    ctaHref: e.ctaHref,
    qualified: e.qualified,
  }));

  const rawTiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
  const tiers: Tier[] = rawTiers.map((t) => ({
    id: t.id,
    name: t.name,
    minPct: t.minPct,
    color: t.color,
    endScreenId:
      t.endScreenId ?? endScreens.find((e) => e.id === t.id)?.id ?? undefined,
  }));

  const defaultEndScreenId = cfg.defaultEndScreenId ?? endScreens[0]?.id;

  return { endScreens, tiers, defaultEndScreenId };
}

/** Resolve a tela final a mostrar, dada a rota forçada, o score e as faixas. */
export function resolveEndScreen(
  ends: NormalizedEnds,
  opts: { forcedEndId?: string; scorePct: number }
): EndScreen | null {
  const { endScreens, tiers, defaultEndScreenId } = ends;
  if (opts.forcedEndId) {
    const forced = endScreens.find((e) => e.id === opts.forcedEndId);
    if (forced) return forced;
  }
  // por faixa de score
  if (tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => b.minPct - a.minPct);
    const tier = sorted.find((t) => opts.scorePct >= t.minPct) ?? sorted[sorted.length - 1];
    const byTier = tier?.endScreenId
      ? endScreens.find((e) => e.id === tier.endScreenId)
      : null;
    if (byTier) return byTier;
  }
  const def = defaultEndScreenId
    ? endScreens.find((e) => e.id === defaultEndScreenId)
    : null;
  return def ?? endScreens[0] ?? null;
}
