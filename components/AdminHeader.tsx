import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";

export function AdminHeader() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-5 py-3 sm:px-8">
      <Link href="/admin/forms" aria-label="Início" className="transition hover:opacity-80">
        <Logo height={22} />
      </Link>
      <LogoutButton />
    </header>
  );
}
