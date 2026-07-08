import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";

export function AdminHeader({ active }: { active: "leads" | "forms" }) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-5 py-3 sm:px-8">
      <div className="flex items-center gap-5">
        <Logo height={22} />
        <nav className="flex items-center gap-1">
          <Tab href="/admin" label="Leads" active={active === "leads"} />
          <Tab href="/admin/forms" label="Formulários" active={active === "forms"} />
        </nav>
      </div>
      <LogoutButton />
    </header>
  );
}

function Tab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-[var(--text)] text-white"
          : "text-[var(--text2)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
      }`}
    >
      {label}
    </Link>
  );
}
