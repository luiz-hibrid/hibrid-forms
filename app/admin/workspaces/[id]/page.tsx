import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getWorkspace, listUsersOfWorkspace } from "@/lib/users";
import { listForms } from "@/lib/forms-db";
import { AdminHeader } from "@/components/AdminHeader";
import { UsersManager } from "@/components/UsersManager";

export const dynamic = "force-dynamic";

export default async function WorkspaceDetail({
  params,
}: {
  params: { id: string };
}) {
  const s = getSession();
  if (!s) redirect("/admin/login");
  if (s.role !== "master") redirect("/admin/forms");
  if (!isSupabaseConfigured()) redirect("/admin/forms");

  const ws = await getWorkspace(params.id);
  if (!ws) notFound();

  const [forms, users] = await Promise.all([
    listForms(params.id),
    listUsersOfWorkspace(params.id),
  ]);

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <AdminHeader />
      <div className="mx-auto max-w-[900px] px-5 py-8 sm:px-8">
        <Link href="/admin/workspaces" className="text-sm text-[var(--text2)] hover:text-[var(--text)]">
          ← Clientes
        </Link>
        <h1 className="mt-2 text-[1.5rem] font-black tracking-tight text-[var(--text)]">
          {ws.name}
        </h1>
        <p className="mono mt-1 text-[11px] text-[var(--text3)]">/{ws.slug}</p>

        <div className="mt-6 grid gap-5">
          <UsersManager workspaceId={ws.id} users={users.map((u) => ({ id: u.id, email: u.email, active: u.active }))} />

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="lbl mb-3">Formulários deste cliente</div>
            {forms.length === 0 && (
              <p className="text-sm text-[var(--text3)]">
                Nenhum formulário. Selecione este cliente no seletor de workspace e crie
                pela tela de formulários.
              </p>
            )}
            <div className="divide-y divide-[var(--border)]">
              {forms.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--text)]">{f.name}</div>
                    <div className="mono text-[11px] text-[var(--text3)]">
                      {f.responses} respostas · /f/{f.slug}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={`/admin/forms/${f.id}/respostas`} className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[var(--text)]">
                      Respostas
                    </Link>
                    <Link href={`/admin/forms/${f.id}`} className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text2)] hover:border-[#bbb]">
                      Editar
                    </Link>
                    <a
                      href={`/f/${f.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir link público em nova aba"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text2)] hover:border-[#bbb] hover:text-[var(--text)]"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                        <path d="M15 3h6v6M10 14L21 3" />
                      </svg>
                      Ver link
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
