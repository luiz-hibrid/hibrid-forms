# Handoff de sessão — contexto para continuar no Claude Code

> Cole este arquivo (ou peça pro Claude Code ler ele) ao abrir uma nova sessão local, para retomar de onde paramos numa conversa anterior no Cowork.

## Estado atual do projeto

Hibrid Forms está funcionando em produção (Vercel) com multi-tenant completo: usuário master (Luiz) cria workspaces (= clientes), cada workspace tem vários formulários, e cada workspace pode ter usuários próprios (login travado ao workspace, resultados-only). Autenticação é via tabela `users` própria (scrypt), não Supabase Auth. Documentação de arquitetura já está em `CLAUDE.md` na raiz do repo — comece por lá.

## O que foi entregue na última sessão longa (ordem cronológica)

1. Log de status de envio ao Google Ads por lead (badge `sent/failed/skipped/pending` na tabela de respostas).
2. Card de integração do Google Ads movido para 2º lugar (abaixo do GTM) + logos reais das plataformas (GTM, Google Ads, Meta, GA4) substituindo ícones de letra.
3. Qualificação manual via Kanban: mover um lead para uma coluna marcada como "qualified" dispara a conversão do Google Ads mesmo que o score não tenha qualificado automaticamente (guard contra reenvio duplicado via `gads_status !== "sent"`).
4. Funil de abandono + tempo médio de preenchimento — **opt-in por formulário** (`trackDropoff` em Ajustes). Salva parciais via `sendBeacon` em `pagehide`/`visibilitychange`, tabela `form_events` (view/start/step).
5. Sistema multi-tenant completo implementado (era só planejado antes): tabelas `workspaces` + `users`, sessão HMAC-assinada em cookie (`hibrid_admin` + `hibrid_ws` p/ workspace ativo do master), scoping de todas as queries admin por workspace, páginas `/admin/workspaces` e `/admin/workspaces/[id]`.
6. Menu de ações rápidas (kebab "⋯") no card do formulário: Editar, Ver respostas, Compartilhar, Integrar, Copiar link, Abrir em nova aba, Duplicar, Mover para workspace, Mover para pasta (placeholder), Exportar, Excluir.
7. Cores do form público seguem o tema (borda de input, opção selecionada, texto do end-screen, subtítulo) via CSS `color-mix()` contra `--form-btn-bg`.
8. Fix de bug: menu kebab sumia na visão em blocos (era `overflow-hidden` no card clipando o dropdown).
9. Botão "Ver link" público na listagem de formulários do workspace; link de acesso admin (`/admin/login`) copiável na tela de usuários do workspace.
10. Fix de centralização vertical no mobile (Chrome/iOS) — `min-h-[100dvh]`.
11. Campo de cor separado para subtítulo (`subtitleColor` / `--form-subtitle`).
12. Removido campo "Nome da conversão (CSV)" do Google Ads — fluxo é 100% API agora (usuário aprovou "Remover (API-only)"; **decidiu explicitamente NÃO** ter uma 2ª Conversion Action ID para qualificação manual vs automática — não reabrir isso sem pedir).
13. Correção de layout: filtro de status ao lado da busca na aba Respostas (estava quebrando linha); removido botão antigo de export "Conversões Google" (CSV descontinuado).
14. Título de página por formulário (`pageTitle`), default = nome do form, editável em Ajustes.
15. Upload de logo por formulário, exibida no canto superior esquerdo do form público (`logoUrl`, componente `LogoUploader`).
16. Notificação por e-mail de novo lead via Resend (`lib/email.ts`, campo `notifyEmails` por form, fallback `LEAD_NOTIFY_EMAILS` global).
17. `CLAUDE.md` gerado via `/init`.
18. Feed de "últimos leads" (completos + parciais) na dashboard — inicialmente como sidebar, **realocado a pedido do usuário para seção full-width abaixo do grid principal**.
19. Logo da Hibrid aumentada 30% em todas as 6 telas onde aparece.
20. Botão "Falar no WhatsApp" (click-to-chat, `wa.me`) na página de detalhe do lead.
21. Opções de múltipla escolha do form público trocadas de círculo/checkbox para **badge de letra (A, B, C…)**, estilo Typeform.
22. Redesign responsivo mobile da aba Resumo/funil (usando skill frontend-design) — sem corte de tela nem scroll horizontal, chips de "Alcançaram X / Abandono Y".
23. Ícone de "olho" movido para o início da tabela de respostas (era link "ver" no fim).
24. Clique no olho abre um **lightbox animado** (spring/fade, `prefers-reduced-motion` respeitado) em vez de navegar pra página cheia — bottom-sheet no mobile, modal centralizado no desktop.
25. Investigação de tracking (UTM/gclid) perdido num lead real do Google Ads (form Favini/advogados): causa raiz identificada — o anúncio aponta para uma landing page em domínio separado (`favininicolini.com.br`), que recebe os UTMs mas não repassa a query string no link/botão que leva ao form Hibrid. Passei snippet JS de correção (para a landing page, fora deste repo) + alternativa de apontar o Final URL do anúncio direto pro form. Usuário confirmou "feito" — aplicou a correção por conta própria.
26. Limpeza de dados via SQL direto no Supabase: apagadas 12 respostas do form `advogados` (Hibrid - Advogados), 4 respostas de 10/07 do form Favini + seus `form_events`, e zerado todo o funil de abandono (`form_events`) do form `advogados`.

## Perguntas recentes já respondidas (não é trabalho pendente, é só contexto)

- Confirmado: todo acesso ao Supabase é via `service_role` no servidor (`lib/supabase.ts` → `getSupabaseAdmin()`); o frontend nunca fala direto com o Supabase, sempre passa pelas rotas `/api/*`.
- Investigado: tabelas `criativo_*` e bucket `storage.criativos` **não existem em lugar nenhum deste repo** — são de outro projeto/app que compartilha o mesmo banco Supabase físico. Não dá pra saber se são acessadas via `anon` key + RLS direto do frontend sem inspecionar esse outro projeto. Se a policy for `USING (true)` e o acesso for via `anon` key no browser, é risco real; se for só `service_role` server-side, o "always true" é ruído do linter. Fica pendente o usuário indicar qual app usa essas tabelas, se quiser essa análise.

## Pendências / ofertas não confirmadas (não implementar sem pedir de novo)

- Mensagem pré-preenchida do WhatsApp configurável por formulário (foi oferecido, sem resposta do usuário).
- 2ª Conversion Action ID do Google Ads para qualificação manual — **usuário já disse "NAO"**, não reabrir.

## Gotchas operacionais (já em `CLAUDE.md`, reforçando)

- Build trava em pasta montada/fuse — validar com `rsync` pra `/tmp/hb` e `npx next build` lá (recriar `/tmp/hb` se sumir).
- Usuário só usa GitHub Desktop (commit + push) e o painel da Vercel — nunca roda comandos de terminal ele mesmo.
- Fontes self-hosted (BR Firma) — não usar `next/font/google`.
- Não usar `@ts-expect-error` antes de server components async (esse tsconfig não erra nisso, a diretiva vira erro de "unused").
- UI em português do Brasil.
