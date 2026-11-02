"use client";

import { useEffect, useState } from "react";

const KEY = "hf-admin-theme";

/** Alterna claro/escuro do painel (atributo data-theme no wrapper .gl-admin; guardado no navegador). */
export function AdminThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const t = document.querySelector<HTMLElement>(".gl-admin")?.dataset.theme;
    setTheme(t === "dark" ? "dark" : "light");
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.querySelector<HTMLElement>(".gl-admin")!.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* navegador sem storage: vale só nesta sessão */
    }
  }
  return (
    <button type="button" className="gl-theme" onClick={toggle} aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"} title="Alternar tema">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {theme === "dark" ? (
          <path d="M12 8a4 4 0 100 8 4 4 0 000-8zM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
        ) : (
          <path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z" />
        )}
      </svg>
    </button>
  );
}
