import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
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
  const s = getSession();
  if (!s) redirect("/admin/login");
  // edição é só do master; cliente vai para os resultados
  if (s.role !== "master") redirect(`/admin/forms/${params.id}/respostas`);
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
