import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getWorkspaceIdBySlug } from "@/lib/forms-db";

export const runtime = "nodejs";

// Salvamento progressivo: grava/atualiza um lead PARCIAL amarrado à sessão.
// Nunca rebaixa um lead já "complete". Não dispara webhook/pixel/conversão.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const session = body?.session;
    const slug = body?.form?.slug;
    if (!session || !slug) return NextResponse.json({ ok: false }, { status: 400 });

    const sb = getSupabaseAdmin();
    if (!sb) return NextResponse.json({ ok: false }, { status: 200 });

    const answers: Record<string, unknown> = body?.answers ?? {};
    const h = request.headers;
    const geoCity = h.get("x-vercel-ip-city");

    // já existe linha desta sessão?
    const { data: existing } = await sb
      .from("submissions")
      .select("id,status")
      .eq("session", session)
      .maybeSingle();

    // não mexe em quem já concluiu
    if (existing?.status === "complete") {
      return NextResponse.json({ ok: true, skipped: "already_complete" });
    }

    const fields = {
      form_slug: slug,
      form_name: body?.form?.name ?? null,
      status: "partial",
      nome: (answers["nome"] as string) ?? null,
      email: (answers["email"] as string) ?? null,
      telefone: (answers["telefone"] as string) ?? null,
      answers,
      tracking: body?.tracking ?? {},
      session,
    };

    if (existing?.id) {
      await sb
        .from("submissions")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      const workspaceId = await getWorkspaceIdBySlug(slug);
      await sb.from("submissions").insert({
        ...fields,
        workspace_id: workspaceId,
        geo_country: h.get("x-vercel-ip-country") || null,
        geo_uf: h.get("x-vercel-ip-country-region") || null,
        geo_city: geoCity ? decodeURIComponent(geoCity) : null,
        geo_lat: h.get("x-vercel-ip-latitude") || null,
        geo_lng: h.get("x-vercel-ip-longitude") || null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
