import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/svg+xml", "image/webp"];
const MAX = 2 * 1024 * 1024; // 2MB

export async function POST(request: Request) {
  if (!isAuthenticated()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "sem_supabase" }, { status: 400 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "sem_arquivo" }, { status: 400 });
  }
  if (file.size > MAX) {
    return NextResponse.json({ ok: false, error: "arquivo_grande" }, { status: 400 });
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    return NextResponse.json({ ok: false, error: "tipo_invalido" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await sb.storage
    .from("form-media")
    .upload(path, buffer, { contentType: file.type || "image/png", upsert: false });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data } = sb.storage.from("form-media").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
