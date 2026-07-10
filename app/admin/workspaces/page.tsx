import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured, getSupabaseAdmin } from "@/lib/supabase";
import { listWorkspaces } from "@/lib/users";
import { AdminHeader } from "@/components/AdminHeader";
import { WorkspacesManager } from "@/components/WorkspacesManager";

export const dynamic = "force-dynamic";

export default async function WorkspacesPage() {
  const s = getSession();
  if (!s) redirect("/admin/login");
  if (s.role !== "master") redirect("/admin/forms");
  if (!isSupabaseConfigured()) redirect("/admin/forms");

  const workspaces = await listWorkspaces();
  const sb = getSupabaseAdmin()!;

  const items = await Promise.all(
    workspaces.map(async (w) => {
      const [{ count: forms }, { count: users }] = await Promise.all([
        sb.from("forms").select("id", { count: "exact", head: true }).eq("workspace_id", w.id),
        sb.from("users").select("id", { count: "exact", head: true }).eq("workspace_id", w.id),
      ]);
      return { id: w.id, name: w.name, slug: w.slug, forms: forms ?? 0, users: users ?? 0 };
    })
  );

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <AdminHeader />
      <WorkspacesManager workspaces={items} />
    </main>
  );
}
