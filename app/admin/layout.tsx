import "./admin-glass.css";

// Moldura visual do admin: fundo de vidro + tokens remapeados (ver admin-glass.css).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gl-admin">
      <div className="gl-admin-bg" aria-hidden="true" />
      {children}
    </div>
  );
}
