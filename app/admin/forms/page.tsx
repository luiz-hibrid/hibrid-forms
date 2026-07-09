import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { listForms } from "@/lib/forms-db";
import { AdminHeader } from "@/components/AdminHeader";
import { FormsDashboard } from "@/components/FormsDashboard";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  if (!isAuthenticated()) redirect("/admin/login");
  const forms = isSupabaseConfigured() ? await listForms() : [];

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <AdminHeader active="forms" />
      <FormsDashboard forms={forms} />
    </main>
  );
}
