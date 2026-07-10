import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getFormBySlug } from "@/lib/forms-db";
import { uploadQualifiedConversion, isGoogleAdsConfigured } from "@/lib/google-ads";

export const runtime = "nodejs";

// Atualiza o estágio (coluna Kanban) e/ou labels de um lead.
// Se body.qualify === true, marca o lead como qualificado e dispara a
// conversão no Google Ads (qualificação manual pelo vendedor no Kanban).
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAuthenticated()) return NextResponse.json({ ok: false }, { status: 401 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.stage === "string") patch.stage = body.stage;
  if (Array.isArray(body.labels)) patch.labels = body.labels;

  const wantQualify = body.qualify === true;

  if (Object.keys(patch).length === 0 && !wantQualify)
    return NextResponse.json({ ok: false }, { status: 400 });

  let gadsStatus: string | null | undefined;

  // Qualificação manual → dispara conversão (uma vez, se ainda não enviada)
  if (wantQualify) {
    patch.qualified = true;
    const { data: row } = await sb
      .from("submissions")
      .select("form_slug,email,telefone,score,tracking,gads_status")
      .eq("id", params.id)
      .single();

    if (row && row.gads_status !== "sent") {
      const gclid = (row.tracking as { gclid?: string } | null)?.gclid;
      const form = await getFormBySlug(row.form_slug);
      const hasCfg =
        form?.pixel?.googleCustomerId && form?.pixel?.googleConversionActionId;

      if (!gclid) {
        gadsStatus = "skipped";
        patch.gads_status = "skipped";
        patch.gads_error = "lead sem gclid";
      } else if (!isGoogleAdsConfigured() || !hasCfg) {
        gadsStatus = "skipped";
        patch.gads_status = "skipped";
        patch.gads_error = !hasCfg
          ? "formulário sem Customer/Conversion ID"
          : "credenciais do Google Ads ausentes no servidor";
      } else {
        const r = await uploadQualifiedConversion({
          gclid,
          email: row.email,
          phone: row.telefone,
          value: row.score,
          currency: "BRL",
          orderId: params.id,
          conversionActionId: form!.pixel!.googleConversionActionId,
          customerId: form!.pixel!.googleCustomerId,
        });
        gadsStatus = r.ok ? "sent" : "failed";
        patch.gads_status = r.ok ? "sent" : "failed";
        patch.gads_error = r.ok ? null : r.error ?? "erro";
        if (r.ok) patch.gads_sent_at = new Date().toISOString();
      }
    } else if (row) {
      gadsStatus = "sent"; // já havia sido enviada antes
    }
  }

  patch.updated_at = new Date().toISOString();

  const { error } = await sb.from("submissions").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, gads_status: gadsStatus });
}

// Exclui um lead.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAuthenticated()) return NextResponse.json({ ok: false }, { status: 401 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false }, { status: 400 });
  const { error } = await sb.from("submissions").delete().eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
