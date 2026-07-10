import { redirect } from "next/navigation";
import { getSession, activeWorkspaceId } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { listForms } from "@/lib/forms-db";
import { AdminHeader } from "@/components/AdminHeader";
import { FormsDashboard } from "@/components/FormsDashboard";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const s = getSession();
  if (!s) redirect("/admin/login");
  // cliente sempre escopado ao próprio workspace; master usa o workspace ativo
  const scope = s.role === "client" ? s.workspaceId : activeWorkspaceId();
  const forms = isSupabaseConfigured() ? await listForms(scope) : [];

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <AdminHeader />
      <FormsDashboard forms={forms} canCreate={s.role === "master"} />
    </main>
  );
}
