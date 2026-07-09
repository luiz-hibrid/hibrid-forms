import { notFound } from "next/navigation";
import { getFormBySlug } from "@/lib/forms-db";
import { themeVars } from "@/lib/theme";
import { FormRunner } from "@/components/FormRunner";
import { PixelInit } from "@/components/PixelInit";
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

  // Protege segredos: só IDs públicos vão para o client.
  const metaPixelId = form.pixel?.metaPixelId;
  const ga4Id = form.pixel?.ga4Id;
  const clientForm = {
    ...form,
    pixel: { metaPixelId, ga4Id },
  };

  const style = {
    ...themeVars(form.theme),
    background: "var(--form-bg)",
    fontFamily: "var(--form-font)",
  } as React.CSSProperties;

  return (
    <main className="min-h-screen flex flex-col" style={style}>
      <PixelInit metaPixelId={metaPixelId} ga4Id={ga4Id} />
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Logo height={24} />
        <span className="lbl">Ferramenta Hibrid</span>
      </header>
      <FormRunner form={clientForm} />
    </main>
  );
}
