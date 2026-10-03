-- Atividades: quiz, pesquisa de satisfação e enquete num só modelo.
--
-- O aluno não lê `atividade_item` nem `atividade_opcao` direto: as duas têm o
-- gabarito (`correta`, `explicacao`) e a RLS não esconde colunas. Ele recebe
-- os itens pela função `atividade_para_aluno`, que só devolve a correção dos
-- itens já respondidos.

create table public.atividade (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turma (id) on delete cascade,
  -- null = atividade assíncrona na área do aluno.
  sessao_ao_vivo_id uuid references public.sessao_ao_vivo (id) on delete set null,
  tipo text not null check (tipo in ('quiz', 'pesquisa_satisfacao', 'enquete')),
  titulo text not null check (length(trim(titulo)) > 0),
  alvo text check (alvo in ('teoria', 'pratica', 'encontro', 'curso')),
  bloco_encontro_id uuid references public.bloco_encontro (id) on delete set null,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicada', 'encerrada')),
  anonima boolean not null default false,
  mostrar_resultado text not null default 'apos_encerrar'
    check (mostrar_resultado in ('nunca', 'apos_responder', 'apos_encerrar')),
  tempo_limite_s int check (tempo_limite_s > 0),
  publicada_em timestamptz,
  encerrada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atividade_pesquisa_tem_alvo check (tipo <> 'pesquisa_satisfacao' or alvo is not null)
);

create index atividade_turma_idx on public.atividade (turma_id, status);
create index atividade_sessao_idx on public.atividade (sessao_ao_vivo_id);

create trigger atividade_updated_at
  before update on public.atividade
  for each row execute function public.definir_updated_at();

create table public.atividade_item (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividade (id) on delete cascade,
  ordem int not null,
  enunciado text not null check (length(trim(enunciado)) > 0),
  tipo_resposta text not null
    check (tipo_resposta in ('escolha_unica', 'escolha_multipla', 'escala_1_5', 'nps_0_10', 'texto_livre')),
  obrigatorio boolean not null default true,
  -- Mostrada após responder (quiz).
  explicacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atividade_item_ordem_unica unique (atividade_id, ordem) deferrable initially deferred
);

create trigger atividade_item_updated_at
  before update on public.atividade_item
  for each row execute function public.definir_updated_at();

create table public.atividade_opcao (
  id uuid primary key default gen_random_uuid(),
  atividade_item_id uuid not null references public.atividade_item (id) on delete cascade,
  ordem int not null,
  texto text not null check (length(trim(texto)) > 0),
  -- Usado só em quiz.
  correta boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index atividade_opcao_item_idx on public.atividade_opcao (atividade_item_id, ordem);

create trigger atividade_opcao_updated_at
  before update on public.atividade_opcao
  for each row execute function public.definir_updated_at();

create table public.atividade_resposta (
  id uuid primary key default gen_random_uuid(),
  atividade_item_id uuid not null references public.atividade_item (id) on delete cascade,
  inscricao_id uuid not null references public.inscricao (id) on delete cascade,
  opcao_ids uuid[],
  valor int,
  texto text check (texto is null or length(texto) <= 1000),
  -- Calculado no insert para quiz.
  correta boolean,
  -- Tempo desde a publicação (quiz ao vivo).
  tempo_resposta_ms int,
  created_at timestamptz not null default now(),
  -- Uma resposta por aluno por item.
  unique (atividade_item_id, inscricao_id)
);

create index atividade_resposta_inscricao_idx on public.atividade_resposta (inscricao_id);

-- Seção 7: atividade que já recebeu respostas fica com itens e opções
-- somente leitura (o título da atividade continua editável).
create or replace function public.travar_itens_com_respostas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atividade uuid;
begin
  -- `old` não existe em INSERT e `new` não existe em DELETE.
  if tg_table_name = 'atividade_item' then
    if tg_op = 'INSERT' then
      v_atividade := new.atividade_id;
    else
      v_atividade := old.atividade_id;
    end if;
  else
    if tg_op = 'INSERT' then
      select i.atividade_id into v_atividade from public.atividade_item i where i.id = new.atividade_item_id;
    else
      select i.atividade_id into v_atividade from public.atividade_item i where i.id = old.atividade_item_id;
    end if;
  end if;

  -- Exclusão em cascata da atividade inteira continua permitida: nesse caso
  -- a atividade (ou o item pai) já não existe mais.
  if tg_op = 'DELETE' and (
    v_atividade is null
    or not exists (select 1 from public.atividade a where a.id = v_atividade)
  ) then
    return old;
  end if;

  if exists (
    select 1
    from public.atividade_resposta r
    join public.atividade_item i on i.id = r.atividade_item_id
    where i.atividade_id = v_atividade
  ) then
    raise exception 'A atividade já tem respostas: itens e opções não podem mais ser alterados.'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger atividade_item_travar
  before insert or update or delete on public.atividade_item
  for each row execute function public.travar_itens_com_respostas();

create trigger atividade_opcao_travar
  before insert or update or delete on public.atividade_opcao
  for each row execute function public.travar_itens_com_respostas();

alter table public.atividade enable row level security;
alter table public.atividade_item enable row level security;
alter table public.atividade_opcao enable row level security;
alter table public.atividade_resposta enable row level security;

-- O aluno enxerga a atividade (cabeçalho) depois de publicada.
create policy atividade_ler on public.atividade
  for select to authenticated
  using (
    public.eh_admin()
    or (status in ('publicada', 'encerrada') and turma_id in (select public.minhas_turmas()))
  );

create policy atividade_admin on public.atividade
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy atividade_item_admin on public.atividade_item
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy atividade_opcao_admin on public.atividade_opcao
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- O aluno lê só as próprias respostas e grava pela função `responder_atividade`.
create policy atividade_resposta_ler on public.atividade_resposta
  for select to authenticated
  using (
    public.eh_admin()
    or inscricao_id in (select i.id from public.inscricao i where i.perfil_id = (select auth.uid()))
  );

create policy atividade_resposta_admin_excluir on public.atividade_resposta
  for delete to authenticated
  using (public.eh_admin());
