-- Rode UMA vez no SQL Editor do Supabase (pode rodar mais de uma vez)
create table if not exists redefinicao_senha (
  id          bigint generated always as identity primary key,
  id_cliente  bigint      not null,
  codigo_hash text        not null,
  expira_em   timestamptz not null,
  tentativas  int         not null default 0,
  criado_em   timestamptz not null default now()
);

create index if not exists redefinicao_senha_cliente_idx
  on redefinicao_senha (id_cliente);

-- Limpeza opcional de códigos vencidos:
-- delete from redefinicao_senha where expira_em < now();

-- Se o backend usa a chave "anon" com RLS ligado, libere esta tabela:
-- alter table redefinicao_senha disable row level security;
