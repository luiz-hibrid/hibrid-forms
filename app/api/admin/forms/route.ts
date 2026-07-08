import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { slugify } from "@/lib/forms-db";

export const runtime = "nodejs";

const DEFAULT_CONFIG = {
  eyebrow: "",
  steps: [
    {
      id: "welcome",
      type: "welcome",
      title: "Bem-vindo!",
      subtitle: "Responda algumas perguntas rápidas.",
      buttonLabel: "Começar",
    },
    {
      id: "nome",
      type: "name",
      title: "Como podemos te chamar?",
      placeholder: "Seu nome",
      required: true,
    },
    {
      id: "email",
      type: "email",
      title: "Qual o seu e-mail?",
      placeholder: "voce@email.com",
      required: true,
    },
  ],
  tiers: [
    { id: "frio", name: "Frio", minPct: 0, color: "#999999" },
    { id: "morno", name: "Morno", minPct: 40, color: "#F0B822" },
    { id: "quente", name: "Quente", minPct: 70, color: "#c2fb8d" },
  ],
  endScreens: [
    { tier: "quente", title: "Obrigado, {nome}!", message: "Recebemos suas respostas.", qualified: true },
    { tier: "morno", title: "Obrigado, {nome}!", message: "Recebemos suas respostas." },
    { tier: "frio", title: "Obrigado, {nome}!", message: "Recebemos suas respostas." },
  ],
};

export async function POST(request: Request) {
  if (!isAuthenticated()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "sem_supabase" }, { status: 400 });
  }

  const { name } = await request.json().catch(() => ({ name: "" }));
  const cleanName = (name || "").trim() || "Novo formulário";

  // slug único
  let base = slugify(cleanName) || "formulario";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data: exists } = await sb
      .from("forms")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!exists) break;
    slug = `${base}-${i}`;
  }

  const { data, error } = await sb
    .from("forms")
    .insert({ slug, name: cleanName, config: DEFAULT_CONFIG, published: false })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id, slug });
}
