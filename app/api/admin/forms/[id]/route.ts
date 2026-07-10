import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { slugify } from "@/lib/forms-db";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const s = getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  if (s.role !== "master") return NextResponse.json({ ok: false }, { status: 403 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, error: "sem_supabase" }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "payload" }, { status: 400 });

  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "nome_obrigatorio" }, { status: 400 });

  const slug = slugify(body.slug || name);
  if (!slug) return NextResponse.json({ ok: false, error: "slug_invalido" }, { status: 400 });

  // garante slug único (exceto o próprio registro)
  const { data: clash } = await sb
    .from("forms")
    .select("id")
    .eq("slug", slug)
    .neq("id", params.id)
    .maybeSingle();
  if (clash) {
    return NextResponse.json({ ok: false, error: "slug_em_uso" }, { status: 409 });
  }

  const config = body.config ?? {};
  const published = !!body.published;

  const { error } = await sb
    .from("forms")
    .update({ name, slug, config, published, updated_at: new Date().toISOString() })
    .eq("id", params.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, slug });
}

// Ações leves: mover o formulário (e seus leads/eventos) de workspace.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const s = getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  if (s.role !== "master") return NextResponse.json({ ok: false }, { status: 403 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, error: "sem_supabase" }, { status: 400 });

  const { workspaceId } = await request.json().catch(() => ({ workspaceId: "" }));
  if (!workspaceId)
    return NextResponse.json({ ok: false, error: "workspace_obrigatorio" }, { status: 400 });

  const { data: form } = await sb
    .from("forms")
    .select("slug")
    .eq("id", params.id)
    .maybeSingle();
  if (!form) return NextResponse.json({ ok: false, error: "nao_encontrado" }, { status: 404 });

  const { error } = await sb
    .from("forms")
    .update({ workspace_id: workspaceId, updated_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // move também os leads e eventos daquele formulário
  await sb.from("submissions").update({ workspace_id: workspaceId }).eq("form_slug", form.slug);
  await sb.from("form_events").update({ workspace_id: workspaceId }).eq("form_slug", form.slug);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const s = getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  if (s.role !== "master") return NextResponse.json({ ok: false }, { status: 403 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, error: "sem_supabase" }, { status: 400 });

  const { error } = await sb.from("forms").delete().eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
