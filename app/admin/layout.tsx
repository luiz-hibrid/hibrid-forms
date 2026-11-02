import "./admin-glass.css";

// Moldura visual do admin: fundo de vidro + tokens remapeados (ver admin-glass.css).
// O script aplica o tema guardado ("light" | "dark" | "system") antes da primeira pintura.
// A troca de tema fica no menu do usuário (components/AdminTools.tsx).
const themeScript = `(function(){try{var t=localStorage.getItem('hf-admin-theme');var el=document.currentScript&&document.currentScript.parentElement;if(!el)return;var dark=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(dark)el.dataset.theme='dark'}catch(e){}})()`;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gl-admin" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <div className="gl-admin-bg" aria-hidden="true" />
      {children}
    </div>
  );
}
