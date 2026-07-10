// ============================================================
// Tipos do motor de formulário
// ============================================================

export type FieldType =
  | "welcome"
  | "text"
  | "name"
  | "email"
  | "tel"
  | "link" // URL / site
  | "single" // escolha única (pontuável)
  | "multi"; // múltipla escolha

export interface Option {
  label: string;
  value: string;
  /** Peso de lead scoring (as "chamas" do fluxo). Padrão 0. */
  weight?: number;
  /**
   * Destino ao escolher esta opção (fluxo condicional):
   * - undefined  → segue na ordem
   * - "__end__"  → encerra e vai para a tela final
   * - <id>       → pula para a etapa com esse id
   */
  next?: string;
}

export const END_STEP = "__end__";

export interface FieldMedia {
  kind: "image" | "video";
  url: string;
  alt?: string;
  /** largura em % (ex.: "60") ou vazio para auto */
  width?: string;
  /** altura em px (ex.: "240") ou vazio para auto */
  height?: string;
  /** alinhamento do bloco acima da pergunta */
  align?: "left" | "center" | "right";
}

export interface Field {
  id: string;
  type: FieldType;
  title: string;
  subtitle?: string;
  placeholder?: string;
  required?: boolean;
  /** Para single/multi */
  options?: Option[];
  /** Texto do botão em telas welcome */
  buttonLabel?: string;
  /** imagem ou vídeo exibido acima da pergunta */
  media?: FieldMedia;
}

export interface Tier {
  id: string;
  name: string;
  /** corte mínimo em % do score máximo do formulário (0–100) */
  minPct: number;
  /** cor de referência para dashboards/admin */
  color: string;
  /** tela final exibida quando o lead cai nesta faixa (id do EndScreen) */
  endScreenId?: string;
}

export interface EndScreen {
  /** identificador estável da tela final */
  id: string;
  /** nome exibido no editor */
  name: string;
  title: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** dispara evento de conversão "qualificado" */
  qualified?: boolean;
}

export interface PixelConfig {
  /** Google Tag Manager — container ID (GTM-XXXX) */
  gtmId?: string;
  /** Meta Pixel ID (client-side) */
  metaPixelId?: string;
  /** Meta Conversions API — token de acesso (server-side) */
  metaCapiToken?: string;
  /** Código de teste de eventos da Meta (opcional, para depurar) */
  metaTestCode?: string;
  /** Google Analytics 4 — Measurement ID (G-XXXX) */
  ga4Id?: string;
  /** GA4 Measurement Protocol — API secret (server-side) */
  ga4ApiSecret?: string;
  /** Nome da ação de conversão no Google Ads (para exportação offline via gclid) */
  googleConversionName?: string;
  /** ID numérico da ação de conversão no Google Ads (para envio via API) */
  googleConversionActionId?: string;
  /** Customer ID da conta do cliente no Google Ads (só dígitos) — envio via API */
  googleCustomerId?: string;
}

export interface ThemeConfig {
  /** cor de fundo da página */
  bg?: string;
  /** chave da fonte (ver FONT_OPTIONS) */
  font?: string;
  /** tamanho base da fonte */
  fontSize?: "sm" | "md" | "lg";
  /** cor de títulos e textos */
  questionColor?: string;
  /** cor dos subtítulos */
  subtitleColor?: string;
  /** cor das respostas */
  answerColor?: string;
  /** cor de fundo do botão */
  buttonBg?: string;
  /** cor do texto do botão */
  buttonText?: string;
  /** formato dos cantos do botão */
  corners?: "square" | "rounded" | "pill";
}

export interface FormConfig {
  slug: string;
  name: string;
  /** frase curta de topo (mono label) */
  eyebrow?: string;
  steps: Field[];
  tiers: Tier[];
  endScreens: EndScreen[];
  /** tela final usada quando não há rota explícita nem faixa aplicável */
  defaultEndScreenId?: string;
  /** rastreamento/conversão por formulário */
  pixel?: PixelConfig;
  /** personalização visual do formulário */
  theme?: ThemeConfig;
  /** registra por onde as pessoas passam para montar o funil de abandono */
  trackDropoff?: boolean;
  /** título da aba do navegador (padrão: nome do formulário) */
  pageTitle?: string;
  /** logo exibida no canto superior esquerdo do formulário */
  logoUrl?: string;
}
