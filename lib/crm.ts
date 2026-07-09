// ============================================================
// Envio do lead para o webhook do CRM (com retry e backoff).
// Configurado via variáveis de ambiente:
//   CRM_WEBHOOK_URL   — URL de destino (obrigatória para ligar o envio)
//   CRM_WEBHOOK_TOKEN — opcional; enviado como header Authorization: Bearer
// ============================================================

export interface CrmResult {
  ok: boolean;
  attempts: number;
  status?: number;
  error?: string;
}

/** URL efetiva: prioriza a do formulário, cai para a variável global. */
export function resolveCrmUrl(formUrl?: string | null): string | undefined {
  return (formUrl && formUrl.trim()) || process.env.CRM_WEBHOOK_URL || undefined;
}

export function isCrmConfigured(formUrl?: string | null): boolean {
  return Boolean(resolveCrmUrl(formUrl));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendToCrm(
  payload: unknown,
  formUrl?: string | null
): Promise<CrmResult> {
  const url = resolveCrmUrl(formUrl);
  if (!url) return { ok: false, attempts: 0, error: "sem_url" };

  const token = process.env.CRM_WEBHOOK_TOKEN;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const backoff = [0, 600, 1800]; // 3 tentativas
  let lastError = "";

  for (let attempt = 1; attempt <= backoff.length; attempt++) {
    if (backoff[attempt - 1]) await sleep(backoff[attempt - 1]);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        return { ok: true, attempts: attempt, status: res.status };
      }
      lastError = `HTTP ${res.status}`;
      // 4xx (exceto 429) não adianta repetir
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return { ok: false, attempts: attempt, status: res.status, error: lastError };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "erro_desconhecido";
    }
  }
  return { ok: false, attempts: backoff.length, error: lastError };
}
