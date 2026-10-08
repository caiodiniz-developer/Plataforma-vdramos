-- Ajustes pedidos pelo professor (guia de 08/10/2026):
--   1. aluno em mais de uma turma (pelo professor e pelo próprio aluno);
--   2. questões nascem ocultas, com liberação individual e em lote;
--   3. entrega de arquivos nas atividades;
--   4. aviso para várias turmas de uma vez;
--   5. e-mail de contato opcional do aluno, para comunicações consentidas.
-- Tudo aqui é aditivo: nada do que já existe muda de formato.

-- ---------------------------------------------------------------------------
-- E-mail de contato do aluno (opcional)
-- ---------------------------------------------------------------------------

-- `perfil.email` do aluno é o endereço interno da conta e não recebe nada.
-- O de contato é o que o aluno informa, se quiser, para receber comunicações.
alter table public.perfil
  add column email_contato text
    check (email_contato is null or email_contato ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

comment on column public.perfil.email_contato is
  'E-mail informado pelo aluno. Só é usado para envio com o consentimento comunicacao_professor vigente.';

-- Lista de envio: quem consentiu e informou um e-mail de contato.
create or replace view public.vw_emails_comunicacao
with (security_invoker = true) as
select i.turma_id, p.nome, p.email_contato as email, c.created_at as consentiu_em
from public.inscricao i
join public.perfil p on p.id = i.perfil_id
join public.aluno_autorizado a on a.id = i.aluno_autorizado_id
join lateral (
  select c.concedido, c.created_at
  from public.consentimento c
  where c.perfil_id = p.id and c.finalidade = 'comunicacao_professor'
  order by c.created_at desc
  limit 1
) c on c.concedido
where p.email_contato is not null and a.ativo;

-- ---------------------------------------------------------------------------
-- Aluno em mais de uma turma
-- ---------------------------------------------------------------------------

-- Liga a pessoa de `p_perfil_id` (pode ser nulo: ID ainda sem conta) à turma,
-- com a matrícula informada. Reaproveita o ID se ele já estiver cadastrado na
-- turma e livre; recusa se já for de outra pessoa.
create or replace function public.vincular_a_turma(
  p_turma_id uuid,
  p_matricula text,
  p_nome text,
  p_perfil_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autorizado uuid;
  v_dono uuid;
begin
  if p_perfil_id is not null and exists (
    select 1 from public.inscricao i where i.turma_id = p_turma_id and i.perfil_id = p_perfil_id
  ) then
    raise exception 'Este aluno já está nesta turma.' using errcode = 'P0001';
  end if;

  select a.id, i.perfil_id into v_autorizado, v_dono
  from public.aluno_autorizado a
  left join public.inscricao i on i.aluno_autorizado_id = a.id
  where a.turma_id = p_turma_id and a.matricula = upper(trim(p_matricula));

  if v_autorizado is not null and v_dono is not null then
    raise exception 'Este ID já está em uso nesta turma. Fale com o professor.' using errcode = 'P0001';
  end if;

  if v_autorizado is null then
    insert into public.aluno_autorizado (turma_id, matricula, nome_referencia)
    values (p_turma_id, upper(trim(p_matricula)), p_nome)
    returning id into v_autorizado;
  end if;

  if p_perfil_id is not null then
    insert into public.inscricao (aluno_autorizado_id, turma_id, perfil_id)
    values (v_autorizado, p_turma_id, p_perfil_id);
  end if;

  return v_autorizado;
end;
$$;

revoke execute on function public.vincular_a_turma(uuid, text, text, uuid) from public, anon, authenticated;

-- Professor: coloca um aluno já cadastrado em outra turma. Com conta, é a
-- mesma conta (mesma senha) nas duas; o aluno troca de turma no menu.
create or replace function public.matricular_em_turma(p_aluno_autorizado_id uuid, p_turma_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origem record;
begin
  if not public.eh_admin() then
    raise exception 'Somente o professor matricula alunos.' using errcode = '42501';
  end if;

  select a.matricula, coalesce(p.nome, a.nome_referencia) as nome, i.perfil_id
  into v_origem
  from public.aluno_autorizado a
  left join public.inscricao i on i.aluno_autorizado_id = a.id
  left join public.perfil p on p.id = i.perfil_id
  where a.id = p_aluno_autorizado_id;
  if not found then
    raise exception 'Aluno não encontrado.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.turma t where t.id = p_turma_id) then
    raise exception 'Turma não encontrada.' using errcode = 'P0001';
  end if;
  if v_origem.perfil_id is null and exists (
    select 1 from public.aluno_autorizado a
    where a.turma_id = p_turma_id and a.matricula = v_origem.matricula
  ) then
    raise exception 'Este aluno já está nesta turma.' using errcode = 'P0001';
  end if;

  return public.vincular_a_turma(p_turma_id, v_origem.matricula, v_origem.nome, v_origem.perfil_id);
end;
$$;

-- Aluno: entra em outra turma com o ID da turma (o mesmo que o professor
-- passa em sala). Só vale para turma ativa e para quem não está bloqueado.
create or replace function public.entrar_na_turma(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_turma uuid;
  v_eu record;
begin
  select a.matricula, p.nome into v_eu
  from public.inscricao i
  join public.aluno_autorizado a on a.id = i.aluno_autorizado_id
  join public.perfil p on p.id = i.perfil_id
  where i.perfil_id = v_uid and a.ativo
  order by i.created_at
  limit 1;
  if not found then
    raise exception 'Você não tem acesso a este conteúdo.' using errcode = '42501';
  end if;

  select t.id into v_turma
  from public.turma t
  where t.codigo = upper(trim(p_codigo)) and t.status = 'ativa';
  if v_turma is null then
    raise exception 'Não encontramos uma turma ativa com este ID. Confira com o professor.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.inscricao i where i.turma_id = v_turma and i.perfil_id = v_uid) then
    raise exception 'Você já está nesta turma.' using errcode = 'P0001';
  end if;

  perform public.vincular_a_turma(v_turma, v_eu.matricula, v_eu.nome, v_uid);
  return v_turma;
end;
$$;

-- Aluno: sai de uma turma. Não dá para sair da última (a conta ficaria sem
-- turma); o que ele enviou naquela turma é apagado junto com a inscrição.
create or replace function public.sair_da_turma(p_turma_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not exists (select 1 from public.inscricao i where i.turma_id = p_turma_id and i.perfil_id = v_uid) then
    raise exception 'Você não está nesta turma.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.inscricao i where i.perfil_id = v_uid) <= 1 then
    raise exception 'Você precisa continuar em ao menos uma turma.' using errcode = 'P0001';
  end if;

  -- O ID sai da lista da turma junto: a inscrição vai em cascata.
  delete from public.aluno_autorizado a
  using public.inscricao i
  where i.aluno_autorizado_id = a.id and i.turma_id = p_turma_id and i.perfil_id = v_uid;
end;
$$;

revoke execute on function public.matricular_em_turma(uuid, uuid) from public, anon;
revoke execute on function public.entrar_na_turma(text) from public, anon;
revoke execute on function public.sair_da_turma(uuid) from public, anon;
grant execute on function public.matricular_em_turma(uuid, uuid) to authenticated;
grant execute on function public.entrar_na_turma(text) to authenticated;
grant execute on function public.sair_da_turma(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Questões e atividades: liberar e ocultar
-- ---------------------------------------------------------------------------

-- A notificação sai só na primeira liberação: ocultar e liberar de novo não
-- avisa a turma outra vez.
create or replace function public.notificar_atividade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'publicada' and old.status is distinct from 'publicada'
     and old.publicada_em is null
     and new.sessao_ao_vivo_id is null and new.tipo in ('licao', 'quiz', 'questao') then
    perform public.notificar_turma(
      new.turma_id,
      'atividade',
      case new.tipo when 'questao' then 'Nova questão: ' else 'Nova atividade: ' end || new.titulo,
      case new.tipo when 'questao' then '/aluno/questoes' else '/aluno/atividades' end
    );
  end if;
  return new;
end;
$$;

-- Libera (publica) ou oculta (volta a rascunho) várias de uma vez. As que não
-- podem ser liberadas (sem gabarito, por exemplo) ficam como estão e voltam
-- na lista de puladas, com o motivo.
create or replace function public.definir_visibilidade(p_ids uuid[], p_visivel boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_titulo text;
  v_alteradas int := 0;
  v_puladas jsonb := '[]'::jsonb;
begin
  if not public.eh_admin() then
    raise exception 'Somente o professor libera atividades.' using errcode = '42501';
  end if;

  foreach v_id in array coalesce(p_ids, '{}') loop
    select a.titulo into v_titulo from public.atividade a where a.id = v_id and a.sessao_ao_vivo_id is null;
    continue when not found;

    if p_visivel then
      begin
        if exists (select 1 from public.atividade a where a.id = v_id and a.status <> 'publicada') then
          perform public.publicar_atividade(v_id);
          v_alteradas := v_alteradas + 1;
        end if;
      exception when sqlstate 'P0001' then
        v_puladas := v_puladas || jsonb_build_object('titulo', v_titulo, 'motivo', sqlerrm);
      end;
    else
      update public.atividade set status = 'rascunho', encerrada_em = null
      where id = v_id and status <> 'rascunho';
      if found then
        v_alteradas := v_alteradas + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('alteradas', v_alteradas, 'puladas', v_puladas);
end;
$$;

revoke execute on function public.definir_visibilidade(uuid[], boolean) from public, anon;
grant execute on function public.definir_visibilidade(uuid[], boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Entrega de arquivos nas atividades
-- ---------------------------------------------------------------------------

alter table public.atividade
  add column aceita_arquivo boolean not null default false;

comment on column public.atividade.aceita_arquivo is
  'O aluno pode anexar arquivos (zip ou avulsos) à resposta.';

create table public.atividade_entrega (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividade (id) on delete cascade,
  inscricao_id uuid not null references public.inscricao (id) on delete cascade,
  -- Caminho no bucket privado `materiais`, dentro de entregas/<id do usuário>/.
  arquivo_path text not null unique,
  nome_arquivo text not null check (length(trim(nome_arquivo)) between 1 and 200),
  tamanho_bytes bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 26214400),
  created_at timestamptz not null default now()
);

create index atividade_entrega_atividade_idx on public.atividade_entrega (atividade_id, inscricao_id);

alter table public.atividade_entrega enable row level security;

create policy atividade_entrega_ler on public.atividade_entrega
  for select to authenticated
  using (public.eh_admin() or inscricao_id in (select public.minhas_inscricoes()));

create policy atividade_entrega_admin on public.atividade_entrega
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- O aluno registra a entrega por função: ela confere a turma, se a atividade
-- aceita arquivo, se está aberta, o prazo, a pasta do arquivo e o limite.
create or replace function public.registrar_entrega(
  p_atividade_id uuid,
  p_arquivo_path text,
  p_nome_arquivo text,
  p_tamanho_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atividade public.atividade;
  v_inscricao uuid;
  v_id uuid;
begin
  select * into v_atividade from public.atividade a where a.id = p_atividade_id;
  if not found then
    raise exception 'Atividade não encontrada.' using errcode = 'P0001';
  end if;

  v_inscricao := public.minha_inscricao(v_atividade.turma_id);
  if v_inscricao is null or v_inscricao not in (select public.minhas_inscricoes()) then
    raise exception 'Você não tem acesso a este conteúdo.' using errcode = '42501';
  end if;
  if not v_atividade.aceita_arquivo then
    raise exception 'Esta atividade não recebe arquivos.' using errcode = 'P0001';
  end if;
  if v_atividade.status <> 'publicada' then
    raise exception 'Esta atividade não está aberta.' using errcode = 'P0001';
  end if;
  if v_atividade.prazo_em is not null and v_atividade.prazo_em < now() then
    raise exception 'O prazo desta atividade já terminou.' using errcode = 'P0001';
  end if;
  if p_arquivo_path not like 'entregas/' || (select auth.uid())::text || '/%' then
    raise exception 'Arquivo fora da sua pasta.' using errcode = '42501';
  end if;
  if (select count(*) from public.atividade_entrega e
      where e.atividade_id = p_atividade_id and e.inscricao_id = v_inscricao) >= 5 then
    raise exception 'O limite é de 5 arquivos por atividade. Junte os arquivos em um .zip.' using errcode = 'P0001';
  end if;

  insert into public.atividade_entrega (atividade_id, inscricao_id, arquivo_path, nome_arquivo, tamanho_bytes)
  values (p_atividade_id, v_inscricao, p_arquivo_path, trim(p_nome_arquivo), p_tamanho_bytes)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.registrar_entrega(uuid, text, text, bigint) from public, anon;
grant execute on function public.registrar_entrega(uuid, text, text, bigint) to authenticated;

-- Arquivos: o aluno envia e lê só dentro da própria pasta de entregas. O
-- professor já lê tudo do bucket pela política `materiais_admin`.
create policy materiais_entrega_enviar on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materiais'
    and (storage.foldername(name))[1] = 'entregas'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy materiais_entrega_ler on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materiais'
    and (storage.foldername(name))[1] = 'entregas'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- Registro de que o e-mail da resposta já foi enviado ao professor, para não
-- repetir. Só a service role (Edge Function) acessa.
create table public.atividade_email (
  atividade_id uuid not null references public.atividade (id) on delete cascade,
  inscricao_id uuid not null references public.inscricao (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (atividade_id, inscricao_id)
);

alter table public.atividade_email enable row level security;

-- ---------------------------------------------------------------------------
-- Aviso para várias turmas
-- ---------------------------------------------------------------------------

-- Um aviso enviado para N turmas vira N linhas com o mesmo lote: o aluno vê
-- o da turma dele; o professor vê e apaga o lote como um aviso só.
alter table public.aviso
  add column lote_id uuid not null default gen_random_uuid();

create index aviso_lote_idx on public.aviso (lote_id);

-- ---------------------------------------------------------------------------
-- Painel do professor
-- ---------------------------------------------------------------------------

-- A lista de alunos passa a mostrar o e-mail de contato e se há consentimento
-- de comunicação vigente. Colunas novas no fim: as antigas não mudam.
create or replace view public.vw_aluno
with (security_invoker = true) as
select
  aa.id as aluno_autorizado_id,
  aa.turma_id,
  t.codigo as turma_codigo,
  aa.matricula,
  aa.ativo,
  coalesce(p.nome, aa.nome_referencia) as nome,
  i.id as inscricao_id,
  i.perfil_id,
  i.created_at as cadastrado_em,
  i.ultimo_acesso_em,
  case when i.id is null then 'sem_conta' when aa.ativo then 'ativo' else 'bloqueado' end as situacao,
  (select count(*) from public.conteudo_acesso ca where ca.inscricao_id = i.id) as conteudos_acessados,
  (
    select count(distinct it.atividade_id)
    from public.atividade_resposta ar
    join public.atividade_item it on it.id = ar.atividade_item_id
    join public.atividade a on a.id = it.atividade_id
    where ar.inscricao_id = i.id and a.tipo in ('licao', 'quiz')
  ) as atividades_realizadas,
  (select count(*) from public.atividade_resposta ar where ar.inscricao_id = i.id and ar.correta is not null) as questoes_respondidas,
  (select count(*) from public.atividade_resposta ar where ar.inscricao_id = i.id and ar.correta) as questoes_corretas,
  (select count(*) from public.duvida d where d.inscricao_id = i.id) as duvidas,
  (select count(*) from public.feedback f where f.inscricao_id = i.id) as feedbacks,
  p.email_contato,
  coalesce((
    select c.concedido
    from public.consentimento c
    where c.perfil_id = p.id and c.finalidade = 'comunicacao_professor'
    order by c.created_at desc
    limit 1
  ), false) as aceita_comunicacao
from public.aluno_autorizado aa
join public.turma t on t.id = aa.turma_id
left join public.inscricao i on i.aluno_autorizado_id = aa.id
left join public.perfil p on p.id = i.perfil_id;
