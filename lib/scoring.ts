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

/** Retorna a faixa (tier) correspondente ao score. */
export function resolveTier(config: FormConfig, score: number): Tier {
  const found = config.tiers.find((t) => score >= t.min && score <= t.max);
  return found ?? config.tiers[config.tiers.length - 1];
}
