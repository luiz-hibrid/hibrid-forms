# Hibrid Forms — Plano Multi-Tenant (Workspaces por cliente)

> Documento de planejamento. Nada aqui foi aplicado ao código. Serve de referência
> para a implementação em fases.

## Modelo mental

Três níveis de hierarquia:

**Master (você)** › **Workspace (cliente)** › **Formulários + Leads**

- Você é o usuário master: cria workspaces (clientes) e cria os usuários de cada um.
- Cada workspace tem vários formulários (e seus leads, kanban, resumo).
- Cada usuário-cliente enxerga **apenas** o workspace dele, com login e senha que
  você define e gerencia.

---

## 1. Banco de dados

### Novas tabelas

| Tabela | Campos principais | Papel |
|---|---|---|
| `workspaces` | `id`, `name`, `slug`, `active`, `created_at` | Representa o cliente |
| `users` | `id`, `email`, `password_hash`, `role` (`master`\|`client`), `workspace_id` (nulo p/ master), `active`, `created_at` | Login por pessoa; senha gerenciada por você |

### Colunas novas em tabelas existentes (isolamento por cliente)

- `forms.workspace_id`
- `submissions.workspace_id` (preenchido no `/api/submit`, a partir do workspace do formulário)
- `form_events.workspace_id` (opcional, ajuda no filtro)

### Migração sem quebrar produção

1. Cria um workspace "Hibrid (interno)".
2. Faz backfill: todos os formulários e leads atuais recebem esse `workspace_id`.
3. Só depois torna `workspace_id` obrigatório (NOT NULL).

---

## 2. Autenticação

Hoje: senha única (cookie `isAuthenticated`). Passa a ser **login por usuário**.

- Sessão guarda `user_id`, `role` e `workspace_id` num cookie **assinado** (JWT com secret).
- Senhas com **hash** (bcrypt/argon2) — nunca em texto puro, mesmo você definindo-as.
- Uma tela de login única. Após entrar, redireciona por papel:
  - master → painel de workspaces;
  - client → direto no workspace dele.

**Decisão pendente:** tabela `users` própria **(recomendado)** vs Supabase Auth.
Como a intenção é "senha pré-definida que eu gerencio", a tabela própria dá mais
controle e é mais simples para esse fluxo.

---

## 3. Isolamento e permissões (segurança)

Regra de ouro: **toda** query do painel filtra por `workspace_id` derivado da sessão.

- **Master:** vê tudo; pode trocar de workspace (seletor no topo).
- **Cliente:** travado no próprio `workspace_id`; o servidor ignora qualquer tentativa
  de acessar outro. Nunca confiar em parâmetro vindo do cliente.
- Cada rota `/api/admin/*` e cada página do painel exigem sessão e aplicam o filtro.
- Reforço opcional (2ª camada): **RLS no Supabase** com política por workspace.

---

## 4. Telas e navegação

### Área do Master
- `/admin/workspaces` — lista e criação de clientes.
- `/admin/workspaces/[id]` — formulários do cliente + aba **Usuários** (criar login,
  definir/resetar senha, ativar/desativar).
- Seletor de workspace no cabeçalho.

### Área do Cliente
- O mesmo painel de hoje (formulários, leads, kanban, resumo), porém escopado.
- Ele não vê que existem outros workspaces.

---

## 5. URLs públicas dos formulários

Hoje: `/f/[slug]` com slug global. Dois caminhos:

- **Slug global único (recomendado agora):** mais simples, URLs curtas; gerar slug
  com prefixo do cliente para evitar colisão.
- **Namespaceado por workspace:** `/f/[cliente]/[form]` — mais organizado, mas muda
  as URLs atuais.

---

## 6. Permissão do cliente (decisão pendente)

- **Só resultados (recomendado):** cliente vê leads, kanban, resumo e export; você
  mantém a criação/edição de formulários.
- **Editor:** cliente também cria/edita formulários (abrir depois via sub-papel).

---

## 7. Ordem de implementação (fases)

1. Tabelas `workspaces` e `users` + colunas `workspace_id` (nuláveis).
2. Backfill: workspace padrão recebe tudo o que já existe.
3. Novo login por usuário (substitui o cookie único).
4. Escopo por workspace em todas as rotas/páginas do admin.
5. UI do master: CRUD de workspaces + CRUD de usuários com senha.
6. Seletor de workspace + redirecionamento por papel.
7. Tornar `workspace_id` obrigatório e (opcional) ligar RLS.

---

## 8. Estudo de UI — Seletor de workspace (referência: Yay Forms)

### Anatomia

**Botão fechado** (topo esquerdo): pílula com o nome do workspace atual + chevron.
Controles satélites ao lado: menu "…" (configurações do workspace), avatar do usuário
com selo (estrela = plano/owner) e "+" tracejado (atalho de criar).

**Dropdown aberto**, de cima para baixo:
1. **Cabeçalho de conta** — nome em maiúsculas pequenas + plano, com badge de papel
   (`OWNER`, azul). Não clicável; é só contexto.
2. **Lista de workspaces** — cada item: avatar quadrado com iniciais (cor sólida) +
   nome em negrito + subtítulo cinza ("Just you" / nº de membros). O atual destacado.
3. **Divisória fina.**
4. **Ação "Add workspace…"** no rodapé, em negrito, separada da lista.

### Estilo (tokens reaproveitáveis do nosso design)

Pílula e itens bem arredondados; avatar quadrado ~28–32px, radius médio, cor sólida
derivada do nome; hierarquia por peso/cor (nome bold escuro, subtítulo cinza, plano
em mono minúsculo); badge de papel como pílula pequena colorida; popover com sombra
suave e borda 1px; hover cinza-claro nos itens. Alinha com o que já usamos no editor.

### Adaptação Hibrid (master ↔ cliente)

- **Master:** dropdown lista **todos os clientes**, cada um com avatar + nome +
  subtítulo (ex.: "3 formulários"). Cabeçalho mostra você com badge **`MASTER`**.
  Rodapé "Add workspace…" (criar cliente) visível **só para o master**.
- **Cliente:** seletor **travado** — mostra só o workspace dele, sem chevron/lista e
  sem "Add workspace…". Vira um rótulo de contexto.
- **Muitos clientes:** adicionar **busca** no topo do dropdown; agrupar por
  recentes/favoritos se crescer.
- **Satélites:** "…" → configurações do workspace (renomear, usuários, desativar);
  avatar → conta/sair; "+" → só master.
- O selo de papel (`MASTER` vs `CLIENT`) reaproveita o componente de badge existente.

---

## Decisões a confirmar antes de implementar

1. **Auth:** tabela `users` própria (recomendado) ou Supabase Auth?
2. **Permissão do cliente:** só resultados (recomendado) ou também editor?
3. **URL pública:** manter `/f/[slug]` global ou namespacear por cliente?
