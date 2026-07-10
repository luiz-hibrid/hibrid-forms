import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { slugify } from "@/lib/forms-db";

export const runtime = "nodejs";

// Duplica um formulário (master). Nasce como rascunho, no mesmo workspace.
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const s = getSession();
  if (!s || s.role !== "master")
    return NextResponse.json({ ok: false }, { status: 403 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, error: "sem_supabase" }, { status: 400 });

  const { data: src } = await sb
    .from("forms")
    .select("name,config,workspace_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!src) return NextResponse.json({ ok: false, error: "nao_encontrado" }, { status: 404 });

  const name = `${src.name} (cópia)`;
  let base = slugify(name) || "formulario";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data: ex } = await sb.from("forms").select("id").eq("slug", slug).maybeSingle();
    if (!ex) break;
    slug = `${base}-${i}`;
  }

  const { data, error } = await sb
    .from("forms")
    .insert({
      slug,
      name,
      config: src.config,
      published: false,
      workspace_id: src.workspace_id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
