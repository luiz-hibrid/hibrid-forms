import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { listForms } from "@/lib/forms-db";
import { AdminHeader } from "@/components/AdminHeader";
import { NewFormButton } from "@/components/NewFormButton";
import { DeleteFormButton } from "@/components/DeleteFormButton";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  if (!isAuthenticated()) redirect("/admin/login");

  const forms = isSupabaseConfigured() ? await listForms() : [];

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <AdminHeader active="forms" />
      <div className="mx-auto max-w-[900px] px-5 py-8 sm:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="lbl">Gestão</span>
            <h1 className="mt-2 text-[1.6rem] font-black tracking-tight text-[var(--text)]">
              Formulários
            </h1>
          </div>
          <NewFormButton />
        </div>

        <div className="grid gap-3">
          {forms.length === 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-sm text-[var(--text2)]">
              Nenhum formulário ainda. Clique em “+ Novo formulário” para criar o
              primeiro.
            </div>
          )}
          {forms.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/forms/${f.id}`}
                    className="truncate font-bold text-[var(--text)] hover:underline"
                  >
                    {f.name}
                  </Link>
                  {f.published ? (
                    <span className="mono rounded-full bg-[rgba(194,251,141,0.22)] px-2 py-0.5 text-[0.58rem] font-bold uppercase text-[#3d7a00]">
                      Publicado
                    </span>
                  ) : (
                    <span className="mono rounded-full bg-[rgba(0,0,0,0.06)] px-2 py-0.5 text-[0.58rem] font-bold uppercase text-[var(--text3)]">
                      Rascunho
                    </span>
                  )}
                </div>
                <div className="mono mt-1 text-[11px] text-[var(--text3)]">
                  /f/{f.slug} · {f.steps} etapas
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                {f.published && (
                  <a
                    href={`/f/${f.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono text-[0.72rem] text-[var(--text2)] hover:text-[var(--text)]"
                  >
                    abrir ↗
                  </a>
                )}
                <Link
                  href={`/admin/forms/${f.id}`}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text2)] transition hover:border-[#bbb] hover:text-[var(--text)]"
                >
                  Editar
                </Link>
                <DeleteFormButton id={f.id} name={f.name} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
