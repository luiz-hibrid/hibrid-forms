# Google Ads API — configuração (cenário agência/MCC)

Objetivo: enviar conversões de leads qualificados direto do backend (Vercel) para o
Google Ads, com Enhanced Conversions (gclid + e-mail/telefone em hash).

A autenticação é feita **uma única vez** no nível da sua MCC. Só o Customer ID e o
Conversion Action ID mudam por cliente (configurados em cada formulário).

---

## Parte A — Developer Token (na sua MCC)

1. Entre na **conta MCC** do Google Ads.
2. Ferramentas → Configuração → **API Center**.
3. Copie o **Developer Token**. Para uso real (não só contas de teste), solicite o
   **Basic access** (o Google aprova, normalmente rápido).

---

## Parte B — Projeto no Google Cloud + OAuth

4. Acesse **console.cloud.google.com** → crie um projeto (ex.: `hibrid-ads`).
5. **APIs e serviços → Biblioteca** → procure e **ative a "Google Ads API"**.
6. **Tela de consentimento OAuth**:
   - Se sua conta é Google Workspace da sua empresa → tipo **Interno** (recomendado; o
     refresh token não expira).
   - Se é um gmail comum → tipo **Externo** e adicione seu e-mail em "usuários de
     teste" (nesse caso publique o app depois para o token não expirar em 7 dias).
   - Escopo: `https://www.googleapis.com/auth/adwords`.
7. **Credenciais → Criar credenciais → ID do cliente OAuth** → tipo **App para
   computador (Desktop)**. Guarde o **Client ID** e o **Client Secret**.

---

## Parte C — Gerar o Refresh Token (uma vez, com usuário da MCC)

8. Abra o **OAuth 2.0 Playground**: developers.google.com/oauthplayground
9. Engrenagem (canto sup. direito) → marque **"Use your own OAuth credentials"** →
   cole o Client ID e Client Secret.
10. No campo de escopo (esquerda), digite: `https://www.googleapis.com/auth/adwords`
    → **Authorize APIs** → faça login com o **usuário que tem acesso à MCC**.
11. **Exchange authorization code for tokens** → copie o **refresh_token**.

> Importante: autorizar com o usuário da MCC faz o token cobrir **todas as contas
> filhas** — não precisa reautorizar por cliente.

---

## Parte D — Variáveis na Vercel (uma vez, nível agência)

Em Settings → Environment Variables do projeto `hibrid-forms`:

| Variável | Valor |
|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Developer token (Parte A) |
| `GOOGLE_ADS_CLIENT_ID` | Client ID do OAuth (Parte B) |
| `GOOGLE_ADS_CLIENT_SECRET` | Client Secret do OAuth (Parte B) |
| `GOOGLE_ADS_REFRESH_TOKEN` | Refresh token (Parte C) |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | ID da sua **MCC** (só dígitos, sem traços) |

Depois de salvar, faça um redeploy.

---

## Parte E — Por cliente (dentro de cada formulário)

Na conta do **cliente** (dentro da MCC):
1. Crie a **ação de conversão** do tipo que aceita importação (Importar → outras fontes
   / offline), e ative **Enhanced Conversions for Leads** nela.
2. Anote o **Customer ID** da conta do cliente e o **Conversion Action ID** (número da
   ação de conversão).

No formulário (Editor → Integrações → Google Ads):
- **Customer ID do cliente** = a conta do cliente na MCC.
- **Conversion Action ID** = a ação de conversão daquele cliente.

Pronto: quando um lead qualificado com gclid concluir aquele formulário, o backend
envia a conversão pra conta certa, com os dados em hash.

---

## Observações

- **Test access** do developer token só funciona em contas de teste. Para valer em
  contas reais, precisa do **Basic access**.
- O **refresh token** não expira se o app OAuth estiver como **Interno** (ou
  **Externo publicado**). Em "Externo + testing" expira em 7 dias.
- Nada dispara enquanto as variáveis não estiverem preenchidas — é seguro publicar o
  código antes de configurar.
