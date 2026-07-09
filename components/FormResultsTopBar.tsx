import Link from "next/link";
import { Logo } from "@/components/Logo";

export function FormResultsTopBar({
  formId,
  formName,
}: {
  formId: string;
  formName: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link href="/admin/forms" aria-label="Voltar" className="shrink-0 text-[var(--text2)] hover:text-[var(--text)]">
          ←
        </Link>
        <Link href="/admin/forms" className="shrink-0">
          <Logo height={20} />
        </Link>
        <span className="min-w-0 max-w-[200px] truncate text-sm font-medium text-[var(--text2)]">
          {formName}
        </span>
      </div>

      <div className="hidden shrink-0 items-center gap-1 rounded-full bg-[var(--bg)] p-1 md:flex">
        <PillLink href={`/admin/forms/${formId}`} icon={<IconEdit />}>Editor</PillLink>
        <PillLink href={`/admin/forms/${formId}?tab=integrate`} icon={<IconIntegrate />}>Integrações</PillLink>
        <PillLink href={`/admin/forms/${formId}?tab=share`} icon={<IconShare />}>Compartilhar</PillLink>
        <span className="flex items-center gap-2 rounded-full bg-[var(--text)] px-4 py-1.5 text-sm font-medium text-white">
          <IconResults />
          Resultados
        </span>
      </div>

      <div className="flex flex-1 items-center justify-end">
        <Link
          href={`/admin/forms/${formId}`}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text2)] transition hover:border-[#bbb] hover:text-[var(--text)]"
        >
          Editar
        </Link>
      </div>
    </div>
  );
}

function PillLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-[var(--text2)] transition hover:text-[var(--text)]"
    >
      {icon}
      {children}
    </Link>
  );
}

function IconEdit() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
function IconIntegrate() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2.4" />
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="M12 7.4v3.2M10.2 16.4L7.6 14M13.8 16.4L16.4 14" />
    </svg>
  );
}
function IconShare() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="2.4" />
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="18" cy="19" r="2.4" />
      <path d="M8.1 10.9l7.8-4.6M8.1 13.1l7.8 4.6" />
    </svg>
  );
}
function IconResults() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15.5A9 9 0 1 1 8.5 3" />
      <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5V12z" />
    </svg>
  );
}
