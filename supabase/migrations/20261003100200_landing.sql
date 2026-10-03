-- Landing page: perfil público (linha única), experiências e mensagens de contato.

create table public.perfil_publico (
  id uuid primary key default gen_random_uuid(),
  -- Garante a linha única: só existe um valor possível para a coluna.
  unico boolean not null default true unique check (unico),
  nome_exibicao text not null,
  titulo text not null,
  bio text not null,
  foto_path text,
  email_contato text not null,
  telefone text,
  linkedin_url text not null,
  outros_links jsonb not null default '[]' check (jsonb_typeof(outros_links) = 'array'),
  cidade text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger perfil_publico_updated_at
  before update on public.perfil_publico
  for each row execute function public.definir_updated_at();

create table public.experiencia (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('profissional', 'docencia')),
  organizacao text not null,
  cargo text not null,
  local text,
  data_inicio date not null,
  data_fim date check (data_fim is null or data_fim >= data_inicio),
  descricao text check (descricao is null or length(descricao) <= 600),
  tags text[] not null default '{}',
  ordem int not null default 0,
  publicado boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index experiencia_landing_idx on public.experiencia (tipo, ordem, data_inicio desc);

create trigger experiencia_updated_at
  before update on public.experiencia
  for each row execute function public.definir_updated_at();

create table public.contato_mensagem (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  email text not null check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'),
  assunto text not null check (assunto in ('consultoria', 'treinamento', 'palestra', 'outro')),
  assunto_outro text,
  mensagem text not null check (length(mensagem) between 10 and 2000),
  lida boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contato_assunto_outro_obrigatorio
    check (assunto <> 'outro' or length(trim(coalesce(assunto_outro, ''))) > 0)
);

create index contato_mensagem_caixa_idx on public.contato_mensagem (lida, created_at desc);

create trigger contato_mensagem_updated_at
  before update on public.contato_mensagem
  for each row execute function public.definir_updated_at();

alter table public.perfil_publico enable row level security;
alter table public.experiencia enable row level security;
alter table public.contato_mensagem enable row level security;

-- Leitura pública da landing; escrita só do admin.
create policy perfil_publico_ler on public.perfil_publico
  for select to anon, authenticated
  using (true);

create policy perfil_publico_admin on public.perfil_publico
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy experiencia_ler_publicadas on public.experiencia
  for select to anon, authenticated
  using (publicado or public.eh_admin());

create policy experiencia_admin on public.experiencia
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- Contato é insert only para o público: não há política de select para anon.
-- O envio passa pela Edge Function `contato`, que aplica o limite por IP; a
-- política abaixo mantém o insert direto válido, sempre como não lida.
create policy contato_mensagem_inserir on public.contato_mensagem
  for insert to anon, authenticated
  with check (lida = false);

create policy contato_mensagem_admin_ler on public.contato_mensagem
  for select to authenticated
  using (public.eh_admin());

create policy contato_mensagem_admin_atualizar on public.contato_mensagem
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy contato_mensagem_admin_excluir on public.contato_mensagem
  for delete to authenticated
  using (public.eh_admin());
