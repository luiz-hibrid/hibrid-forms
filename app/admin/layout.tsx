import "./admin-glass.css";
import { AdminThemeToggle } from "@/components/AdminThemeToggle";

// Moldura visual do admin: fundo de vidro + tokens remapeados (ver admin-glass.css).
// O script aplica o tema guardado antes da primeira pintura (sem "piscada").
const themeScript = `(function(){try{var t=localStorage.getItem('hf-admin-theme');var el=document.currentScript&&document.currentScript.parentElement;if(el&&t==='dark')el.dataset.theme='dark'}catch(e){}})()`;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gl-admin" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <div className="gl-admin-bg" aria-hidden="true" />
      {children}
      <AdminThemeToggle />
    </div>
  );
}
