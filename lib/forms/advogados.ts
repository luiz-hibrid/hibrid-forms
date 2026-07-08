import type { FormConfig } from "@/lib/types";

// ============================================================
// Formulário de captação — Advogados
// Baseado no fluxo de referência (pesos = "chamas" do print).
// Edite este objeto para mudar perguntas, opções e pesos.
// ============================================================

export const advogados: FormConfig = {
  slug: "advogados",
  name: "Diagnóstico de Captação — Advogados",
  eyebrow: "Diagnóstico gratuito",
  steps: [
    {
      id: "welcome",
      type: "welcome",
      title: "Descubra como captar clientes pelo Google e Meta.",
      subtitle:
        "Responda 6 perguntas rápidas. Ao final, montamos um diagnóstico do seu potencial de captação.",
      buttonLabel: "Começar diagnóstico",
    },
    {
      id: "nome",
      type: "name",
      title: "Para começar, como podemos te chamar?",
      placeholder: "Seu nome",
      required: true,
    },
    {
      id: "email",
      type: "email",
      title: "Qual o seu melhor e-mail?",
      subtitle: "É onde enviamos o resultado do diagnóstico.",
      placeholder: "voce@escritorio.com.br",
      required: true,
    },
    {
      id: "telefone",
      type: "tel",
      title: "Em qual WhatsApp podemos falar com você?",
      placeholder: "(11) 99999-9999",
      required: true,
    },
    {
      id: "area",
      type: "single",
      title: "Qual a principal área de atuação do seu escritório?",
      required: true,
      options: [
        { label: "Trabalhista", value: "trabalhista" },
        { label: "Previdenciário", value: "previdenciario" },
        { label: "Cível", value: "civel" },
        { label: "Família", value: "familia" },
        { label: "Empresarial", value: "empresarial" },
        { label: "Imobiliário", value: "imobiliario" },
        { label: "Criminal", value: "criminal" },
        { label: "Outro", value: "outro" },
      ],
    },
    {
      id: "estrutura",
      type: "single",
      title: "Como é a estrutura do seu escritório hoje?",
      subtitle: "Isso nos ajuda a entender sua capacidade de atendimento.",
      required: true,
      options: [
        { label: "Somente eu", value: "somente_eu", weight: 1 },
        { label: "Tenho recepcionista", value: "recepcionista", weight: 2 },
        { label: "Tenho secretária", value: "secretaria", weight: 3 },
        { label: "Tenho marketing interno", value: "marketing", weight: 4 },
      ],
    },
    {
      id: "investimento",
      type: "single",
      title:
        "Para ter resultado com anúncios, o investimento médio é de R$30 a R$50/dia. Faz sentido para o seu momento?",
      required: true,
      options: [
        { label: "Sim, consigo investir isso", value: "sim", weight: 3 },
        {
          label: "Tenho dúvidas sobre o investimento",
          value: "duvidas",
          weight: 2,
        },
        { label: "Ainda não é o meu momento", value: "nao", weight: 1 },
      ],
    },
  ],
  // Faixas por % do score máximo do formulário (teto calculado automaticamente).
  tiers: [
    { id: "frio", name: "Frio", minPct: 0, color: "#999999" },
    { id: "morno", name: "Morno", minPct: 40, color: "#F0B822" },
    { id: "quente", name: "Quente", minPct: 70, color: "#c2fb8d" },
  ],
  endScreens: [
    {
      tier: "quente",
      title: "{nome}, seu perfil tem tudo a ver com o que fazemos! 🔥",
      message:
        "Seu escritório está pronto para escalar a captação. Um especialista da Hibrid vai te chamar no WhatsApp em instantes para montar sua estratégia.",
      ctaLabel: "Falar agora no WhatsApp",
      ctaHref: "https://wa.me/5500000000000",
      qualified: true,
    },
    {
      tier: "morno",
      title: "Obrigado, {nome}! Recebemos suas respostas.",
      message:
        "Vamos analisar seu perfil e preparar um diagnóstico com os próximos passos ideais para o seu momento. Fique de olho no seu e-mail e WhatsApp.",
      ctaLabel: "Conhecer a Hibrid",
      ctaHref: "https://hibrid.com.br",
    },
    {
      tier: "frio",
      title: "Obrigado por participar, {nome}!",
      message:
        "Guardamos suas respostas. Quando fizer sentido investir em captação, vamos estar aqui para te ajudar a crescer com previsibilidade.",
      ctaLabel: "Conhecer a Hibrid",
      ctaHref: "https://hibrid.com.br",
    },
  ],
};
