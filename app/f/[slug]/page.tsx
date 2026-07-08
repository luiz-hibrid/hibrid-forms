import { notFound } from "next/navigation";
import { getForm } from "@/lib/forms";
import { FormRunner } from "@/components/FormRunner";
import { Logo } from "@/components/Logo";

// SSR: a página carrega rápido e serve como página de destino de anúncio.
export function generateMetadata({ params }: { params: { slug: string } }) {
  const form = getForm(params.slug);
  return {
    title: form ? `${form.name} · Hibrid` : "Formulário · Hibrid",
  };
}

export default function FormPage({ params }: { params: { slug: string } }) {
  const form = getForm(params.slug);
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
