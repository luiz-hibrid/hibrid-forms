import { notFound } from "next/navigation";
import { getFormBySlug } from "@/lib/forms-db";
import { FormRunner } from "@/components/FormRunner";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const form = await getFormBySlug(params.slug);
  return {
    title: form ? `${form.name} · Hibrid` : "Formulário · Hibrid",
  };
}

export default async function FormPage({
  params,
}: {
  params: { slug: string };
}) {
  const form = await getFormBySlug(params.slug);
  if (!form) notFound();

  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Logo height={24} />
        <span className="lbl">Ferramenta Hibrid</span>
      </header>
      <FormRunner form={form} />
    </main>
  );
}
