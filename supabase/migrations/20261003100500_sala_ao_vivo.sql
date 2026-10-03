-- Sala ao vivo: sessão, perguntas, votos e mensagens.
--
-- Diferença em relação à primeira versão do PRD (registrada na seção 3):
-- a autoria da pergunta fica em `pergunta_autoria`, fora da tabela `pergunta`.
-- O Realtime entrega a linha inteira a quem pode lê-la e a RLS filtra linhas,
-- não colunas; com `inscricao_id` dentro de `pergunta`, toda pergunta anônima
-- chegaria aos colegas com o autor junto.

create table public.sessao_ao_vivo (
  id uuid primary key default gen_random_uuid(),
  -- Uma sessão por encontro.
  encontro_id uuid not null unique references public.encontro (id) on delete cascade,
  status text not null default 'agendada' check (status in ('agendada', 'aberta', 'encerrada')),
  aberta_em timestamptz,
  encerrada_em timestamptz,
  permite_anonimo boolean not null default true,
  chat_ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sessao_ao_vivo_updated_at
  before update on public.sessao_ao_vivo
  for each row execute function public.definir_updated_at();

-- PRD F18: cada encontro nasce com a sua sessão 'agendada'.
create or replace function public.criar_sessao_do_encontro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sessao_ao_vivo (encontro_id) values (new.id);
  return new;
end;
$$;

create trigger encontro_criar_sessao
  after insert on public.encontro
  for each row execute function public.criar_sessao_do_encontro();

create table public.pergunta (
  id uuid primary key default gen_random_uuid(),
  sessao_ao_vivo_id uuid not null references public.sessao_ao_vivo (id) on delete cascade,
  -- Bloco ativo no momento do envio.
  bloco_encontro_id uuid references public.bloco_encontro (id) on delete set null,
  texto text not null check (length(trim(texto)) between 3 and 500),
  -- 'turma' = mural aberto; 'professor' = só o autor e o admin veem.
  destino text not null check (destino in ('turma', 'professor')),
  anonima boolean not null default false,
  -- Nome exibido no mural; fica null quando a pergunta é anônima.
  autor_nome text,
  status text not null default 'aberta' check (status in ('aberta', 'respondida', 'oculta')),
  resposta text,
  respondida_em timestamptz,
  -- Contador mantido por `alternar_voto`; evita expor quem votou.
  votos int not null default 0 check (votos >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pergunta_anonima_sem_nome check (not anonima or autor_nome is null)
);

create index pergunta_mural_idx on public.pergunta (sessao_ao_vivo_id, votos desc, created_at);

create trigger pergunta_updated_at
  before update on public.pergunta
  for each row execute function public.definir_updated_at();

-- Autor de cada pergunta (sempre gravado). Fora do Realtime.
create table public.pergunta_autoria (
  pergunta_id uuid primary key references public.pergunta (id) on delete cascade,
  inscricao_id uuid not null references public.inscricao (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index pergunta_autoria_inscricao_idx on public.pergunta_autoria (inscricao_id);

create table public.pergunta_voto (
  id uuid primary key default gen_random_uuid(),
  pergunta_id uuid not null references public.pergunta (id) on delete cascade,
  inscricao_id uuid not null references public.inscricao (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Um voto por aluno.
  unique (pergunta_id, inscricao_id)
);

create table public.mensagem (
  id uuid primary key default gen_random_uuid(),
  sessao_ao_vivo_id uuid not null references public.sessao_ao_vivo (id) on delete cascade,
  perfil_id uuid not null references public.perfil (id) on delete cascade,
  -- Preenchido por trigger: o aluno não lê a tabela perfil dos colegas.
  autor_nome text not null default '',
  tipo text not null check (tipo in ('texto', 'link', 'aviso')),
  texto text not null check (length(trim(texto)) between 1 and 1000),
  fixada boolean not null default false,
  removida boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mensagem_feed_idx on public.mensagem (sessao_ao_vivo_id, created_at);
create index mensagem_autor_idx on public.mensagem (sessao_ao_vivo_id, perfil_id, created_at desc);

create trigger mensagem_updated_at
  before update on public.mensagem
  for each row execute function public.definir_updated_at();

create or replace function public.preencher_autor_da_mensagem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select p.nome into new.autor_nome from public.perfil p where p.id = new.perfil_id;
  new.autor_nome = coalesce(new.autor_nome, '');
  return new;
end;
$$;

create trigger mensagem_autor
  before insert on public.mensagem
  for each row execute function public.preencher_autor_da_mensagem();

-- Pergunta ocultada e mensagem removida deixam de ser visíveis ao aluno, então
-- o Realtime não entrega a ele o UPDATE correspondente. Tocar a sessão avisa
-- os clientes (que assinam `sessao_ao_vivo`) para recarregar as listas.
create or replace function public.avisar_sessao_de_moderacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sessao_ao_vivo set updated_at = now() where id = new.sessao_ao_vivo_id;
  return new;
end;
$$;

create trigger pergunta_moderada
  after update of status on public.pergunta
  for each row
  when (new.status = 'oculta' and old.status is distinct from 'oculta')
  execute function public.avisar_sessao_de_moderacao();

create trigger mensagem_moderada
  after update of removida on public.mensagem
  for each row
  when (new.removida and not old.removida)
  execute function public.avisar_sessao_de_moderacao();

-- ---------------------------------------------------------------------------
-- Funções de apoio à RLS
-- ---------------------------------------------------------------------------

create or replace function public.turma_da_sessao(p_sessao_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.turma_id
  from public.sessao_ao_vivo s
  join public.encontro e on e.id = s.encontro_id
  where s.id = p_sessao_id;
$$;

create or replace function public.sou_autor_da_pergunta(p_pergunta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pergunta_autoria pa
    join public.inscricao i on i.id = pa.inscricao_id
    where pa.pergunta_id = p_pergunta_id and i.perfil_id = (select auth.uid())
  );
$$;

alter table public.sessao_ao_vivo enable row level security;
alter table public.pergunta enable row level security;
alter table public.pergunta_autoria enable row level security;
alter table public.pergunta_voto enable row level security;
alter table public.mensagem enable row level security;

create policy sessao_ao_vivo_ler on public.sessao_ao_vivo
  for select to authenticated
  using (public.eh_admin() or public.turma_da_sessao(id) in (select public.minhas_turmas()));

create policy sessao_ao_vivo_admin on public.sessao_ao_vivo
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- Mural: perguntas para a turma que não foram ocultadas. Pergunta "só para o
-- professor" aparece apenas para quem a escreveu.
create policy pergunta_ler on public.pergunta
  for select to authenticated
  using (
    public.eh_admin()
    or (
      public.turma_da_sessao(sessao_ao_vivo_id) in (select public.minhas_turmas())
      and (
        (destino = 'turma' and status <> 'oculta')
        or public.sou_autor_da_pergunta(id)
      )
    )
  );

-- O aluno envia pela função `enviar_pergunta`; só o admin escreve direto.
create policy pergunta_admin on public.pergunta
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- O autor enxerga a própria autoria. O professor só enxerga a autoria de
-- perguntas não anônimas: o anonimato vale também no painel dele.
create policy pergunta_autoria_ler on public.pergunta_autoria
  for select to authenticated
  using (
    inscricao_id in (select i.id from public.inscricao i where i.perfil_id = (select auth.uid()))
    or (
      public.eh_admin()
      and not exists (select 1 from public.pergunta p where p.id = pergunta_id and p.anonima)
    )
  );

create policy pergunta_voto_ler_proprio on public.pergunta_voto
  for select to authenticated
  using (
    inscricao_id in (select i.id from public.inscricao i where i.perfil_id = (select auth.uid()))
  );

create policy mensagem_ler on public.mensagem
  for select to authenticated
  using (
    public.eh_admin()
    or (
      not removida
      and public.turma_da_sessao(sessao_ao_vivo_id) in (select public.minhas_turmas())
    )
  );

-- O aluno envia pela função `enviar_mensagem`; só o admin escreve direto.
-- O professor publica em nome próprio e modera (fixa, remove) as de todos.
create policy mensagem_admin_inserir on public.mensagem
  for insert to authenticated
  with check (public.eh_admin() and perfil_id = (select auth.uid()));

create policy mensagem_admin_atualizar on public.mensagem
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy mensagem_admin_excluir on public.mensagem
  for delete to authenticated
  using (public.eh_admin());
