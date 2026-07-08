# Fase 2 — Ativar Supabase + Painel de Leads

Depois de subir o código (GitHub Desktop → Commit → Push), faça esta configuração **uma vez**. Sem ela, o formulário continua funcionando, mas os leads não são salvos e o painel não mostra nada.

## 1. Criar a tabela no Supabase
1. Abra seu projeto no **Supabase** → menu lateral **SQL Editor** → **New query**.
2. Cole todo o conteúdo do arquivo **`supabase-schema.sql`** (está na raiz do projeto) e clique em **Run**.
3. Isso cria a tabela `submissions`.

## 2. Pegar as chaves do Supabase
No Supabase: **Project Settings** (engrenagem) → **API**. Você vai precisar de dois valores:
- **Project URL** → vira a variável `SUPABASE_URL`
- **service_role** (em "Project API keys", a chave secreta) → vira `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ A `service_role` é secreta e dá acesso total ao banco. Ela só vive nas variáveis de ambiente do servidor (Vercel), nunca no código nem no navegador.

## 3. Configurar as variáveis na Vercel
No projeto na **Vercel** → **Settings** → **Environment Variables**. Adicione as quatro:

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | a Project URL do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | a chave service_role do Supabase |
| `ADMIN_PASSWORD` | a senha que o time vai usar pra entrar no painel (escolha uma) |
| `ADMIN_SESSION_SECRET` | um texto aleatório longo (ex.: 32+ caracteres quaisquer) |

Marque as variáveis para **Production** (e Preview, se usar). Salve.

## 4. Redeploy
A Vercel aplica variáveis novas no próximo deploy. Ou você dá um Commit+Push qualquer no GitHub Desktop, ou na Vercel vá em **Deployments** → no último deploy, menu **⋯** → **Redeploy**.

## Pronto — como usar
- **Formulário público:** `seu-dominio.vercel.app/f/advogados`
- **Painel de leads:** `seu-dominio.vercel.app/admin` (pede a `ADMIN_PASSWORD`)
- No painel: KPIs (total, quentes, mornos, frios), filtro por faixa, detalhe de cada lead com respostas e pesos, e **Exportar CSV**.

## Testar
Preencha o formulário uma vez em `/f/advogados`. O lead deve aparecer na hora em `/admin`. Se não aparecer, confira no Supabase (Table Editor → submissions) se a linha foi criada — se não, revise as variáveis `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
