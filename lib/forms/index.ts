import type { FormConfig } from "@/lib/types";
import { advogados } from "./advogados";

// Registro de formulários publicados.
// Para criar um novo, adicione um arquivo em lib/forms/ e registre aqui.
const registry: Record<string, FormConfig> = {
  [advogados.slug]: advogados,
};

export function getForm(slug: string): FormConfig | null {
  return registry[slug] ?? null;
}

export function allForms(): FormConfig[] {
  return Object.values(registry);
}
