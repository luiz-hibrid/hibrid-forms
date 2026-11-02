import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "@/components/AdminNav";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { getSession, activeWorkspaceId } from "@/lib/auth";
import { listWorkspaces } from "@/lib/users";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function AdminHeader() {
  const s = getSession();
  let workspaces: { id: string; name: string }[] = [];
  let userEmail = "";
  if (s) {
    const all = await listWorkspaces();
    if (s.role === "master") {
      workspaces = all.map((w) => ({ id: w.id, name: w.name }));
    } else if (s.workspaceId) {
      const own = all.find((w) => w.id === s.workspaceId);
      if (own) workspaces = [{ id: own.id, name: own.name }];
    }
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb.from("users").select("email").eq("id", s.userId).maybeSingle();
      userEmail = data?.email ?? "";
    }
  }

  return (
    <header className="ga-top">
      <div className="ga-top__left">
        <Link href="/admin/forms" aria-label="Início" className="transition hover:opacity-80">
          <Logo height={40} />
        </Link>
        {s && (
          <WorkspaceSwitcher
            role={s.role}
            workspaces={workspaces}
            activeId={activeWorkspaceId()}
            userEmail={userEmail}
          />
        )}
      </div>
      {s ? <AdminNav role={s.role} /> : <div />}
      <div className="ga-top__right">
        <LogoutButton />
      </div>
    </header>
  );
}
