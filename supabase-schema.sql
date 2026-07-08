-- ============================================================
-- Hibrid Forms — schema do banco (rodar no SQL Editor do Supabase)
-- ============================================================

create table if not exists submissions (
  id           uuid primary key default gen_random_uuid(),
  form_slug    text not null,
  form_name    text,
  status       text not null default 'complete',   -- 'complete' | 'partial'
  nome         text,
  email        text,
  telefone     text,
  answers      jsonb not null default '{}'::jsonb,  -- todas as respostas
  score        integer not null default 0,
  tier         text,                                -- 'frio' | 'morno' | 'quente'
  qualified    boolean not null default false,
  tracking     jsonb not null default '{}'::jsonb,  -- utm, gclid, fbclid...
  created_at   timestamptz not null default now()
);

-- Índices para o painel (ordenação e filtros)
create index if not exists submissions_created_at_idx on submissions (created_at desc);
create index if not exists submissions_form_slug_idx  on submissions (form_slug);
create index if not exists submissions_tier_idx       on submissions (tier);

-- RLS: mantemos ligado. O acesso é feito só pelo backend com a Service Role
-- Key (que ignora RLS), então NENHUMA policy pública é necessária.
alter table submissions enable row level security;
