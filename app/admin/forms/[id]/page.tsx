import { redirect, notFound } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getFormRow } from "@/lib/forms-db";
import { FormEditor } from "@/components/FormEditor";

export const dynamic = "force-dynamic";

export default async function EditFormPage({
  params,
}: {
  params: { id: string };
}) {
  if (!isAuthenticated()) redirect("/admin/login");
  if (!isSupabaseConfigured()) redirect("/admin/forms");

  const row = await getFormRow(params.id);
  if (!row) notFound();

  return <FormEditor initial={row} />;
}
