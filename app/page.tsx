import Link from "next/link";
import { Logo } from "@/components/Logo";
import { allForms } from "@/lib/forms";

export default function Home() {
  const forms = allForms();
  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Logo height={24} />
        <span className="lbl">Painel interno</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-5 pb-16">
        <div className="w-full max-w-[560px]">
          <span className="lbl">Formulários</span>
          <h1 className="mt-3 text-[2rem] font-black leading-tight tracking-tight text-[var(--text)]">
            Construtor de formulários de captação
          </h1>
          <p className="mt-3 text-[var(--text2)]">
            Cada formulário publicado tem um link público próprio, usado como
            página de destino de anúncio ou botão de landing page.
          </p>

          <div className="mt-8 grid gap-3">
            {forms.map((f) => (
              <Link
                key={f.slug}
                href={`/f/${f.slug}`}
                className="group flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 transition-all hover:border-[#bbb] hover:-translate-y-[2px]"
              >
                <div>
                  <div className="font-bold text-[var(--text)]">{f.name}</div>
                  <div className="mono mt-1 text-[11px] text-[var(--text3)]">
                    /f/{f.slug}
                  </div>
                </div>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-[var(--text2)] transition-transform group-hover:translate-x-[3px]"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
