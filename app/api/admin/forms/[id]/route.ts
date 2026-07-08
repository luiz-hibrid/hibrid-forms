import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { slugify } from "@/lib/forms-db";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAuthenticated()) return NextResponse.json({ ok: false }, { status: 401 });
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

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAuthenticated()) return NextResponse.json({ ok: false }, { status: 401 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, error: "sem_supabase" }, { status: 400 });

  const { error } = await sb.from("forms").delete().eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
