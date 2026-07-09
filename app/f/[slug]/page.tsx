import { notFound } from "next/navigation";
import { getFormBySlug } from "@/lib/forms-db";
import { themeVars } from "@/lib/theme";
import { FormRunner } from "@/components/FormRunner";
import { PixelInit } from "@/components/PixelInit";

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
  const gtmId = form.pixel?.gtmId;
  const metaPixelId = form.pixel?.metaPixelId;
  const ga4Id = form.pixel?.ga4Id;
  const clientForm = {
    ...form,
    pixel: { gtmId, metaPixelId, ga4Id },
  };

  const style = {
    ...themeVars(form.theme),
    background: "var(--form-bg)",
    fontFamily: "var(--form-font)",
  } as React.CSSProperties;

  return (
    <main className="min-h-screen flex flex-col" style={style}>
      {gtmId && (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
      )}
      <PixelInit gtmId={gtmId} metaPixelId={metaPixelId} ga4Id={ga4Id} />
      <FormRunner form={clientForm} />
    </main>
  );
}
