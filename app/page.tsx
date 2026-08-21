import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

// A raiz do site não expõe mais o diretório de formulários publicados —
// isso listava nome e slug de todos os formulários (de todos os clientes)
// para qualquer visitante anônimo. Espelha o padrão de app/admin/page.tsx:
// logado vai para o painel, deslogado vai para o login. Os links /f/<slug>
// usados nos anúncios não são afetados por esta página.
export default function Home() {
  if (!isAuthenticated()) redirect("/admin/login");
  redirect("/admin/forms");
}
