// Deriva o tipo de dispositivo a partir do user-agent do envio.
// Guardado em submissions.device para a análise de origem dos leads.
export type Device = "mobile" | "tablet" | "desktop";

export function deviceFromUa(ua: string | null | undefined): Device | null {
  if (!ua) return null;
  const s = ua.toLowerCase();
  // tablets antes de mobile: iPad e Android sem "mobile" são tablets
  if (/ipad|tablet|playbook|silk|kindle/.test(s)) return "tablet";
  if (/android/.test(s) && !/mobile/.test(s)) return "tablet";
  if (/mobi|iphone|ipod|windows phone|blackberry|opera mini/.test(s)) return "mobile";
  return "desktop";
}
