import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getFormRow } from "@/lib/forms-db";

export const runtime = "nodejs";

// Histórico de disparos. Dois modos:
//   ?submission=<id>  → linha do tempo de um lead
//   ?form=<formId>    → log operacional do formulário (filtros opcionais)
export async function GET(request: Request) {
  const s = getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false }, { status: 400 });

  const url = new URL(request.url);
  const submissionId = url.searchParams.get("submission");
  const formId = url.searchParams.get("form");
  const destination = url.searchParams.get("destination");
  const status = url.searchParams.get("status");

  let query = sb
    .from("conversion_events")
    .select("id,submission_id,form_slug,created_at,destination,trigger,status,actor_user_id,detail")
    .order("created_at", { ascending: false })
    .limit(500);

  if (submissionId) {
    // valida que o lead pertence ao workspace do usuário
    const { data: sub } = await sb
      .from("submissions")
      .select("workspace_id")
      .eq("id", submissionId)
      .maybeSingle();
    if (!sub) return NextResponse.json({ ok: false }, { status: 404 });
    if (s.role === "client" && sub.workspace_id !== s.workspaceId)
      return NextResponse.json({ ok: false }, { status: 403 });
    query = query.eq("submission_id", submissionId);
  } else if (formId) {
    const scope = s.role === "client" ? s.workspaceId : null;
    const form = await getFormRow(formId, scope);
    if (!form) return NextResponse.json({ ok: false }, { status: 404 });
    query = query.eq("form_slug", form.slug);
  } else {
    return NextResponse.json({ ok: false, error: "informe submission ou form" }, { status: 400 });
  }

  if (destination) query = query.eq("destination", destination);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const events = data ?? [];

  // resolve nomes de quem disparou (para "qualificação manual por X")
  const actorIds = Array.from(
    new Set(events.map((e) => e.actor_user_id).filter((v): v is string => !!v))
  );
  let actors: Record<string, string> = {};
  if (actorIds.length) {
    const { data: users } = await sb.from("users").select("id,email").in("id", actorIds);
    actors = Object.fromEntries((users ?? []).map((u) => [u.id, u.email as string]));
  }

  // nomes dos leads, no modo log do formulário
  let leads: Record<string, string> = {};
  if (formId) {
    const subIds = Array.from(
      new Set(events.map((e) => e.submission_id).filter((v): v is string => !!v))
    );
    if (subIds.length) {
      const { data: subs } = await sb.from("submissions").select("id,nome").in("id", subIds);
      leads = Object.fromEntries((subs ?? []).map((x) => [x.id, (x.nome as string) ?? "Sem nome"]));
    }
  }

  return NextResponse.json({ ok: true, events, actors, leads });
}
