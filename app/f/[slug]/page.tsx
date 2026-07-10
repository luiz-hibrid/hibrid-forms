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
  const title =
    form?.pageTitle?.trim() || form?.name?.trim() || "Formulário";
  return { title };
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
    <main className="flex min-h-screen min-h-[100dvh] flex-col" style={style}>
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
      {form.logoUrl && (
        <div className="pointer-events-none fixed left-5 top-5 z-40 sm:left-8 sm:top-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={form.logoUrl}
            alt=""
            className="h-8 w-auto object-contain sm:h-10"
          />
        </div>
      )}
      <FormRunner form={clientForm} />
    </main>
  );
}
