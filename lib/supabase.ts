import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente Supabase server-side (usa a Service Role Key — NUNCA expor no client).
// Retorna null se as variáveis de ambiente não estiverem configuradas,
// para o app não quebrar antes do Supabase estar conectado.
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Evita o Data Cache do Next servir dados antigos (ex.: tema do formulário).
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
