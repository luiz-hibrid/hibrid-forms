import { redirect } from "next/navigation";
import { getSession, activeWorkspaceId } from "@/lib/auth";
import { isSupabaseConfigured, getSupabaseAdmin } from "@/lib/supabase";
import { listForms } from "@/lib/forms-db";
import { listWorkspaces } from "@/lib/users";
import { AdminHeader } from "@/components/AdminHeader";
import { FormsDashboard, type RecentLead } from "@/components/FormsDashboard";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const s = getSession();
  if (!s) redirect("/admin/login");
  // cliente sempre escopado ao próprio workspace; master usa o workspace ativo
  const scope = s.role === "client" ? s.workspaceId : activeWorkspaceId();
  const forms = isSupabaseConfigured() ? await listForms(scope) : [];
  const workspaces =
    s.role === "master" && isSupabaseConfigured()
      ? (await listWorkspaces()).map((w) => ({ id: w.id, name: w.name }))
      : [];

  // Últimos leads (completos + parciais) no escopo atual
  let recentLeads: RecentLead[] = [];
  if (isSupabaseConfigured()) {
    const sb = getSupabaseAdmin()!;
    let q = sb
      .from("submissions")
      .select("id,nome,email,form_name,form_slug,status,tier,qualified,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (scope) q = q.eq("workspace_id", scope);
    const { data } = await q;
    recentLeads = (data ?? []) as RecentLead[];
  }

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <AdminHeader />
      <FormsDashboard
        forms={forms}
        canManage={s.role === "master"}
        workspaces={workspaces}
        recentLeads={recentLeads}
      />
    </main>
  );
}
