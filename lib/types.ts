// ============================================================
// Tipos do motor de formulário
// ============================================================

export type FieldType =
  | "welcome"
  | "text"
  | "name"
  | "email"
  | "tel"
  | "single" // escolha única (pontuável)
  | "multi"; // múltipla escolha

export interface Option {
  label: string;
  value: string;
  /** Peso de lead scoring (as "chamas" do fluxo). Padrão 0. */
  weight?: number;
}

export interface Field {
  id: string;
  type: FieldType;
  title: string;
  subtitle?: string;
  placeholder?: string;
  required?: boolean;
  /** Para single/multi */
  options?: Option[];
  /** Texto do botão em telas welcome */
  buttonLabel?: string;
}

export interface Tier {
  id: string;
  name: string;
  /** corte mínimo em % do score máximo do formulário (0–100) */
  minPct: number;
  /** cor de referência para dashboards/admin */
  color: string;
}

export interface EndScreen {
  /** faixa (tier.id) que dispara esta tela */
  tier: string;
  title: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** dispara evento de conversão "qualificado" */
  qualified?: boolean;
}

export interface FormConfig {
  slug: string;
  name: string;
  /** frase curta de topo (mono label) */
  eyebrow?: string;
  steps: Field[];
  tiers: Tier[];
  endScreens: EndScreen[];
}
