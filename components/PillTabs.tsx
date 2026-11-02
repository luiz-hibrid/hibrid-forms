"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Grupo de abas em vidro com indicador deslizante. Os filhos devem usar a classe
 * `ga-tab` e marcar o ativo com `data-active="true"` (ou aria-current="page").
 * O indicador é posicionado por medição e desliza com a mesma curva do restante do admin.
 */
export function PillTabs({
  children,
  className = "",
  size = "md",
  fill = false,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  size?: "md" | "sm";
  fill?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ x: 0, w: 0, on: false });

  // roda a cada render do grupo (a troca de aba re-renderiza os filhos) e quando a largura muda
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const a = el.querySelector<HTMLElement>('[data-active="true"], [aria-current="page"]');
      const next = a ? { x: a.offsetLeft, w: a.offsetWidth, on: true } : { x: 0, w: 0, on: false };
      setPill((p) => (p.x === next.x && p.w === next.w && p.on === next.on ? p : next));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  });

  return (
    <div ref={ref} role="group" aria-label={label} className={`ga-tabs ga-tabs--${size}${fill ? " ga-tabs--fill" : ""} ${className}`.trim()}>
      <span
        className="ga-tabs__pill"
        aria-hidden="true"
        style={{ width: pill.w, transform: `translateX(${pill.x}px)`, opacity: pill.on ? 1 : 0 }}
      />
      {children}
    </div>
  );
}
