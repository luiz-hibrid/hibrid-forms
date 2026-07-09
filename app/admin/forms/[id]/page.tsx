import { redirect, notFound } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getFormRow } from "@/lib/forms-db";
import { FormEditor } from "@/components/FormEditor";

export const dynamic = "force-dynamic";

export default async function EditFormPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  if (!isAuthenticated()) redirect("/admin/login");
  if (!isSupabaseConfigured()) redirect("/admin/forms");

  const row = await getFormRow(params.id);
  if (!row) notFound();

  const initialTab =
    searchParams.tab === "integrate"
      ? "integrate"
      : searchParams.tab === "share"
      ? "share"
      : "edit";

  return <FormEditor initial={row} initialTab={initialTab} />;
}
