import type { ThemeConfig } from "@/lib/types";

export const FONT_OPTIONS = [
  {
    key: "brand",
    label: "Padrão (Hibrid)",
    stack: "var(--font-brand), ui-sans-serif, system-ui, sans-serif",
  },
  { key: "arial", label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  {
    key: "georgia",
    label: "Georgia (serifada)",
    stack: "Georgia, 'Times New Roman', serif",
  },
  {
    key: "mono",
    label: "Monoespaçada",
    stack: "ui-monospace, Menlo, Consolas, monospace",
  },
];

export const DEFAULT_THEME: Required<ThemeConfig> = {
  bg: "#f4f4f4",
  font: "brand",
  fontSize: "md",
  questionColor: "#111111",
  answerColor: "#111111",
  buttonBg: "#c2fb8d",
  buttonText: "#111111",
  corners: "rounded",
};

/** Gera as CSS variables do tema para aplicar num container. */
export function themeVars(theme?: ThemeConfig): Record<string, string> {
  const t = { ...DEFAULT_THEME, ...(theme || {}) };
  const radius =
    t.corners === "square" ? "8px" : t.corners === "pill" ? "9999px" : "16px";
  const scale = t.fontSize === "sm" ? "0.92" : t.fontSize === "lg" ? "1.12" : "1";
  const font =
    FONT_OPTIONS.find((f) => f.key === t.font)?.stack || FONT_OPTIONS[0].stack;
  return {
    "--form-bg": t.bg,
    "--form-title": t.questionColor,
    "--form-answer": t.answerColor,
    "--form-btn-bg": t.buttonBg,
    "--form-btn-text": t.buttonText,
    "--form-radius": radius,
    "--form-font": font,
    "--form-scale": scale,
  };
}
