"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="text-sm text-[var(--text2)] transition hover:text-[var(--text)]"
    >
      Sair
    </button>
  );
}
