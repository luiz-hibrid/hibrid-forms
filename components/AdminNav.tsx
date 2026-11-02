"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/forms", label: "Formulários", master: false },
  { href: "/admin/workspaces", label: "Workspaces", master: true },
];

export function AdminNav({ role }: { role: "master" | "client" }) {
  const path = usePathname() || "";
  const tabs = TABS.filter((t) => !t.master || role === "master");
  if (tabs.length < 2) return <div />; // cliente: só Formulários — sem barra de abas
  return (
    <nav className="gl-tabs" aria-label="Principal">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className="gl-tab" aria-current={path.startsWith(t.href) ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
