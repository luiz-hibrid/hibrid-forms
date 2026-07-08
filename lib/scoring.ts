import type { FormConfig, Tier } from "@/lib/types";

/**
 * Soma os pesos das respostas de campos single/multi.
 * answers: { [fieldId]: value | value[] }
 */
export function computeScore(
  config: FormConfig,
  answers: Record<string, string | string[]>
): number {
  let score = 0;
  for (const field of config.steps) {
    if (field.type !== "single" && field.type !== "multi") continue;
    if (!field.options) continue;
    const answer = answers[field.id];
    if (!answer) continue;
    const selected = Array.isArray(answer) ? answer : [answer];
    for (const opt of field.options) {
      if (selected.includes(opt.value)) {
        score += opt.weight ?? 0;
      }
    }
  }
  return score;
}

/**
 * Score máximo possível do formulário.
 * - single: maior peso entre as opções (só uma pode ser escolhida)
 * - multi: soma de todos os pesos positivos (todas podem ser marcadas)
 */
export function maxScore(config: FormConfig): number {
  let max = 0;
  for (const field of config.steps) {
    if (!field.options?.length) continue;
    const weights = field.options.map((o) => o.weight ?? 0);
    if (field.type === "single") {
      max += Math.max(0, ...weights);
    } else if (field.type === "multi") {
      max += weights.reduce((s, w) => s + Math.max(0, w), 0);
    }
  }
  return max;
}

/** Percentual do score em relação ao máximo do formulário (0–100). */
export function scorePct(config: FormConfig, score: number): number {
  const max = maxScore(config);
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

/** Resolve a faixa pelo percentual do score máximo. */
export function resolveTier(config: FormConfig, score: number): Tier {
  const pct = scorePct(config, score);
  const sorted = [...config.tiers].sort((a, b) => b.minPct - a.minPct);
  return sorted.find((t) => pct >= t.minPct) ?? sorted[sorted.length - 1];
}
