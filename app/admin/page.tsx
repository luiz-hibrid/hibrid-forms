import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

// A página inicial do admin é a lista de formulários.
// Leads são visualizados dentro de cada formulário (aba Resultados).
export default function AdminIndex() {
  if (!isAuthenticated()) redirect("/admin/login");
  redirect("/admin/forms");
}
