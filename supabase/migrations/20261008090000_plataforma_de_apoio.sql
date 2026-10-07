-- Plataforma de apoio aos alunos do SENAI (mudança de escopo registrada no PRD).
--
-- As aulas acontecem presencialmente; a plataforma é o ambiente complementar:
-- conteúdos e aulas extras, questões, atividades, dúvidas, mensagens para o
-- professor, feedback, avisos, notificações e acompanhamento de progresso.
--
-- O que foi REAPROVEITADO do modelo existente:
--   turma, aluno_autorizado (a lista de IDs é o cadastro de alunos; `ativo`
--   é o bloqueio), inscricao, perfil, e todo o motor de atividade
--   (atividade, atividade_item, atividade_opcao, atividade_resposta e as
--   funções responder_atividade / atividade_para_aluno).
-- O que é NOVO: conteudo, conteudo_acesso, duvida, mensagem_privada,
--   feedback, aviso, notificacao, e as visões de progresso e de atividade
--   recente.

-- ---------------------------------------------------------------------------
-- Conteúdos (aulas, aulas extras, textos, vídeos, links e arquivos)
-- ---------------------------------------------------------------------------

create table public.conteudo (
  id uuid primary key default gen_random_uuid(),
  -- null = vale para todas as turmas.
  turma_id uuid references public.turma (id) on delete cascade,
  tipo text not null check (tipo in ('aula', 'aula_extra', 'texto', 'video', 'link', 'arquivo')),
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,
  -- Corpo do conteúdo em markdown.
  corpo_md text,
  -- Caminhos no bucket privado `materiais`.
  capa_path text,
  arquivo_path text,
  video_url text check (video_url is null or video_url ~* '^https?://'),
  link_url text check (link_url is null or link_url ~* '^https?://'),
  publicado boolean not null default false,
  -- Data de publicação; no futuro = publicação programada.
  publicado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conteudo_turma_idx on public.conteudo (turma_id, publicado, publicado_em desc);

create trigger conteudo_updated_at
  before update on public.conteudo
  for each row execute function public.definir_updated_at();

-- Ao publicar sem data, a data de publicação é agora.
create or replace function public.datar_publicacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.publicado and new.publicado_em is null then
    new.publicado_em = now();
  end if;
  return new;
end;
$$;

create trigger conteudo_datar
  before insert or update on public.conteudo
  for each row execute function public.datar_publicacao();

-- Primeiro e último acesso de cada aluno a cada conteúdo (progresso).
create table public.conteudo_acesso (
  conteudo_id uuid not null references public.conteudo (id) on delete cascade,
  inscricao_id uuid not null references public.inscricao (id) on delete cascade,
  primeiro_em timestamptz not null default now(),
  ultimo_em timestamptz not null default now(),
  primary key (conteudo_id, inscricao_id)
);

create index conteudo_acesso_inscricao_idx on public.conteudo_acesso (inscricao_id, ultimo_em desc);

-- ---------------------------------------------------------------------------
-- Atividades: questões avulsas, lições com prazo, e vínculo com conteúdo
-- ---------------------------------------------------------------------------

alter table public.atividade drop constraint atividade_tipo_check;
alter table public.atividade
  add constraint atividade_tipo_check
  check (tipo in ('quiz', 'pesquisa_satisfacao', 'enquete', 'questao', 'licao'));

alter table public.atividade
  add column descricao text,
  add column instrucoes_md text,
  add column prazo_em timestamptz,
  add column arquivo_path text,
  add column conteudo_id uuid references public.conteudo (id) on delete set null,
  add column dificuldade text check (dificuldade in ('facil', 'medio', 'dificil')),
  add column categoria text;

comment on column public.atividade.tipo is
  'quiz/enquete/pesquisa_satisfacao: como antes. questao: uma pergunta avulsa de prática, com correção na hora. licao: atividade com instruções, prazo opcional e itens.';

-- As funções de atividade passam a tratar os tipos novos: questão avulsa e
-- lição também têm correção (quando o item tem gabarito), e a lição respeita
-- o prazo. O restante do corpo é o mesmo da migration 20261003100800.

create or replace function public.problemas_da_atividade(p_atividade_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_atividade public.atividade;
  v_problemas text[] := '{}';
  v_item record;
begin
  select * into v_atividade from public.atividade a where a.id = p_atividade_id;
  if not found then
    return array['Atividade não encontrada.'];
  end if;

  if not exists (select 1 from public.atividade_item i where i.atividade_id = p_atividade_id) then
    v_problemas := v_problemas || 'Adicione ao menos um item.';
  end if;

  for v_item in
    select
      i.ordem,
      i.tipo_resposta,
      count(o.id) as opcoes,
      count(o.id) filter (where o.correta) as corretas
    from public.atividade_item i
    left join public.atividade_opcao o on o.atividade_item_id = i.id
    where i.atividade_id = p_atividade_id
      and i.tipo_resposta in ('escolha_unica', 'escolha_multipla')
    group by i.id, i.ordem, i.tipo_resposta
    order by i.ordem
  loop
    if v_item.opcoes < 2 then
      v_problemas := v_problemas || format('Item %s: inclua ao menos duas opções.', v_item.ordem);
    end if;
    if v_atividade.tipo in ('quiz', 'questao') then
      if v_item.corretas = 0 then
        v_problemas := v_problemas || format('Item %s: marque a opção correta.', v_item.ordem);
      elsif v_item.tipo_resposta = 'escolha_unica' and v_item.corretas > 1 then
        v_problemas := v_problemas
          || format('Item %s: escolha única aceita só uma opção correta.', v_item.ordem);
      end if;
    end if;
  end loop;

  return v_problemas;
end;
$$;

create or replace function public.responder_atividade(p_atividade_id uuid, p_respostas jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atividade public.atividade;
  v_inscricao uuid;
  v_item public.atividade_item;
  v_resposta jsonb;
  v_opcoes uuid[];
  v_valor int;
  v_texto text;
  v_correta boolean;
  v_tempo int;
begin
  select * into v_atividade from public.atividade a where a.id = p_atividade_id;
  if not found then
    raise exception 'Atividade não encontrada.' using errcode = 'P0002';
  end if;

  v_inscricao := public.minha_inscricao(v_atividade.turma_id);
  if v_inscricao is null then
    raise exception 'Você não está inscrito nesta turma.' using errcode = '42501';
  end if;

  if v_atividade.status <> 'publicada'
     or not exists (select 1 from public.turma t where t.id = v_atividade.turma_id and t.status = 'ativa')
     or (
       v_atividade.tempo_limite_s is not null
       -- 2 s de tolerância para a latência entre o clique e a chegada ao servidor.
       and now() > v_atividade.publicada_em + make_interval(secs => v_atividade.tempo_limite_s + 2)
     )
  then
    raise exception 'Tempo encerrado.' using errcode = 'P0001';
  end if;

  if v_atividade.prazo_em is not null and now() > v_atividade.prazo_em then
    raise exception 'O prazo desta atividade terminou.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.atividade_resposta r
    join public.atividade_item i on i.id = r.atividade_item_id
    where i.atividade_id = p_atividade_id and r.inscricao_id = v_inscricao
  ) then
    raise exception 'Você já respondeu esta atividade.' using errcode = '23505';
  end if;

  if v_atividade.sessao_ao_vivo_id is not null and v_atividade.publicada_em is not null then
    v_tempo := (extract(epoch from now() - v_atividade.publicada_em) * 1000)::int;
  end if;

  for v_item in
    select * from public.atividade_item i where i.atividade_id = p_atividade_id order by i.ordem
  loop
    select r into v_resposta
    from jsonb_array_elements(coalesce(p_respostas, '[]'::jsonb)) r
    where (r ->> 'item_id')::uuid = v_item.id
    limit 1;

    v_opcoes := null;
    v_valor := null;
    v_texto := null;
    v_correta := null;

    if v_resposta is not null then
      if jsonb_typeof(v_resposta -> 'opcao_ids') = 'array' then
        select array_agg(distinct x::uuid) into v_opcoes
        from jsonb_array_elements_text(v_resposta -> 'opcao_ids') x;
      end if;
      v_valor := (v_resposta ->> 'valor')::int;
      v_texto := nullif(trim(coalesce(v_resposta ->> 'texto', '')), '');
    end if;

    if v_item.tipo_resposta in ('escolha_unica', 'escolha_multipla') then
      v_valor := null;
      v_texto := null;
      if v_opcoes is not null then
        if v_item.tipo_resposta = 'escolha_unica' and array_length(v_opcoes, 1) <> 1 then
          raise exception 'Item %: escolha uma única opção.', v_item.ordem using errcode = '22023';
        end if;
        if exists (
          select 1 from unnest(v_opcoes) escolhida
          where not exists (
            select 1 from public.atividade_opcao o
            where o.id = escolhida and o.atividade_item_id = v_item.id
          )
        ) then
          raise exception 'Item %: opção inválida.', v_item.ordem using errcode = '22023';
        end if;
        -- Corrige quando o item tem gabarito (quiz, questão avulsa ou lição com resposta certa).
        if v_atividade.tipo in ('quiz', 'questao', 'licao') and exists (
          select 1 from public.atividade_opcao oc where oc.atividade_item_id = v_item.id and oc.correta
        ) then
          -- Acerto: o conjunto marcado é exatamente o conjunto de opções corretas.
          select coalesce(array_agg(o.id order by o.id), '{}') = (select array_agg(e order by e) from unnest(v_opcoes) e)
          into v_correta
          from public.atividade_opcao o
          where o.atividade_item_id = v_item.id and o.correta;
        end if;
      end if;
    elsif v_item.tipo_resposta = 'escala_1_5' then
      v_opcoes := null;
      v_texto := null;
      if v_valor is not null and v_valor not between 1 and 5 then
        raise exception 'Item %: a nota vai de 1 a 5.', v_item.ordem using errcode = '22023';
      end if;
    elsif v_item.tipo_resposta = 'nps_0_10' then
      v_opcoes := null;
      v_texto := null;
      if v_valor is not null and v_valor not between 0 and 10 then
        raise exception 'Item %: a nota vai de 0 a 10.', v_item.ordem using errcode = '22023';
      end if;
    else
      v_opcoes := null;
      v_valor := null;
      if length(coalesce(v_texto, '')) > 1000 then
        raise exception 'Item %: o texto passa de 1000 caracteres.', v_item.ordem using errcode = '22023';
      end if;
    end if;

    if v_opcoes is null and v_valor is null and v_texto is null then
      if v_item.obrigatorio then
        raise exception 'Item %: resposta obrigatória.', v_item.ordem using errcode = '22023';
      end if;
      continue;
    end if;

    insert into public.atividade_resposta
      (atividade_item_id, inscricao_id, opcao_ids, valor, texto, correta, tempo_resposta_ms)
    values (v_item.id, v_inscricao, v_opcoes, v_valor, v_texto, v_correta, v_tempo);
  end loop;
end;
$$;

create or replace function public.atividade_para_aluno(p_atividade_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_atividade public.atividade;
  v_inscricao uuid;
  v_respondeu boolean;
  v_ve_resultado boolean;
  v_itens jsonb;
begin
  select * into v_atividade from public.atividade a where a.id = p_atividade_id;
  if not found or v_atividade.status = 'rascunho' then
    raise exception 'Atividade não encontrada.' using errcode = 'P0002';
  end if;

  v_inscricao := public.minha_inscricao(v_atividade.turma_id);
  if v_inscricao is null
     or not (v_atividade.turma_id in (select public.minhas_turmas())) then
    raise exception 'Você não está inscrito nesta turma.' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.atividade_resposta r
    join public.atividade_item i on i.id = r.atividade_item_id
    where i.atividade_id = p_atividade_id and r.inscricao_id = v_inscricao
  ) into v_respondeu;

  v_ve_resultado := case v_atividade.mostrar_resultado
    when 'nunca' then false
    when 'apos_responder' then v_respondeu or v_atividade.status = 'encerrada'
    else v_atividade.status = 'encerrada'
  end;

  select coalesce(jsonb_agg(item order by ordem), '[]'::jsonb) into v_itens
  from (
    select
      i.ordem,
      jsonb_build_object(
        'id', i.id,
        'ordem', i.ordem,
        'enunciado', i.enunciado,
        'tipo_resposta', i.tipo_resposta,
        'obrigatorio', i.obrigatorio,
        'opcoes', (
          select coalesce(jsonb_agg(
            jsonb_build_object('id', o.id, 'ordem', o.ordem, 'texto', o.texto)
            || case
                 when v_atividade.tipo in ('quiz', 'questao', 'licao') and (r.id is not null or v_atividade.status = 'encerrada')
                   then jsonb_build_object('correta', o.correta)
                 else '{}'::jsonb
               end
            || case
                 when v_ve_resultado then jsonb_build_object('total', (
                   select count(*) from public.atividade_resposta ar
                   where ar.atividade_item_id = i.id and o.id = any (ar.opcao_ids)
                 ))
                 else '{}'::jsonb
               end
            order by o.ordem
          ), '[]'::jsonb)
          from public.atividade_opcao o
          where o.atividade_item_id = i.id
        ),
        'minha_resposta', case
          when r.id is null then null
          else jsonb_build_object(
            'opcao_ids', r.opcao_ids, 'valor', r.valor, 'texto', r.texto, 'correta', r.correta
          )
        end,
        'explicacao', case
          when v_atividade.tipo in ('quiz', 'questao', 'licao') and (r.id is not null or v_atividade.status = 'encerrada')
            then i.explicacao
          else null
        end,
        'resultado', case
          when v_ve_resultado then (
            select jsonb_build_object(
              'respostas', count(*),
              'media', round(avg(ar.valor)::numeric, 1)
            )
            from public.atividade_resposta ar
            where ar.atividade_item_id = i.id
          )
          else null
        end
      ) as item
    from public.atividade_item i
    left join public.atividade_resposta r
      on r.atividade_item_id = i.id and r.inscricao_id = v_inscricao
    where i.atividade_id = p_atividade_id
  ) itens;

  return jsonb_build_object(
    'id', v_atividade.id,
    'tipo', v_atividade.tipo,
    'titulo', v_atividade.titulo,
    'status', v_atividade.status,
    'anonima', v_atividade.anonima,
    'tempo_limite_s', v_atividade.tempo_limite_s,
    'publicada_em', v_atividade.publicada_em,
    'sessao_ao_vivo_id', v_atividade.sessao_ao_vivo_id,
    'descricao', v_atividade.descricao,
    'instrucoes_md', v_atividade.instrucoes_md,
    'prazo_em', v_atividade.prazo_em,
    'arquivo_path', v_atividade.arquivo_path,
    'dificuldade', v_atividade.dificuldade,
    'categoria', v_atividade.categoria,
    'respondida', v_respondeu,
    'mostra_resultado', v_ve_resultado,
    'itens', v_itens
  );
end;
$$;

-- A retenção deixa de limpar a tabela de cadastro pendente, que não existe mais.
create or replace function public.aplicar_retencao()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turmas uuid[];
begin
  select coalesce(array_agg(t.id), '{}') into v_turmas
  from public.turma t
  where t.status = 'encerrada'
    and t.data_fim < (current_date - interval '24 months')
    and exists (select 1 from public.aluno_autorizado a where a.turma_id = t.id);

  if array_length(v_turmas, 1) is null then
    return 0;
  end if;

  delete from public.pergunta p
  where public.turma_da_sessao(p.sessao_ao_vivo_id) = any (v_turmas);

  delete from public.mensagem m
  where public.turma_da_sessao(m.sessao_ao_vivo_id) = any (v_turmas);

  -- Remover a lista de IDs apaga em cascata inscrições, votos e respostas.
  delete from public.aluno_autorizado a where a.turma_id = any (v_turmas);

  -- Perfis de aluno que ficaram sem nenhuma inscrição deixam de ter motivo
  -- para existir. A conta no Auth é removida pela Edge Function de retenção.
  delete from public.perfil p
  where p.papel = 'aluno'
    and not exists (select 1 from public.inscricao i where i.perfil_id = p.id);

  delete from public.limite_tentativa where created_at < now() - interval '1 day';

  return array_length(v_turmas, 1);
end;
$$;


-- ---------------------------------------------------------------------------
-- Dúvidas (aluno → professor), mensagens privadas, feedback e avisos
-- ---------------------------------------------------------------------------

create table public.duvida (
  id uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null references public.inscricao (id) on delete cascade,
  turma_id uuid not null references public.turma (id) on delete cascade,
  titulo text not null check (length(trim(titulo)) between 3 and 120),
  pergunta text not null check (length(trim(pergunta)) between 3 and 2000),
  conteudo_id uuid references public.conteudo (id) on delete set null,
  categoria text,
  -- Caminho no bucket `materiais`, dentro de duvidas/<id do usuário>/.
  anexo_path text,
  status text not null default 'aberta' check (status in ('aberta', 'respondida', 'arquivada')),
  resposta text,
  respondida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index duvida_caixa_idx on public.duvida (status, created_at desc);
create index duvida_inscricao_idx on public.duvida (inscricao_id, created_at desc);

create trigger duvida_updated_at
  before update on public.duvida
  for each row execute function public.definir_updated_at();

-- Conversa privada entre um aluno e o professor (uma por inscrição).
create table public.mensagem_privada (
  id uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null references public.inscricao (id) on delete cascade,
  autor text not null check (autor in ('aluno', 'professor')),
  texto text not null check (length(trim(texto)) between 1 and 2000),
  -- Quando o destinatário leu (o professor, se o autor é o aluno, e vice-versa).
  lida_em timestamptz,
  created_at timestamptz not null default now()
);

create index mensagem_privada_conversa_idx on public.mensagem_privada (inscricao_id, created_at);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null references public.inscricao (id) on delete cascade,
  turma_id uuid not null references public.turma (id) on delete cascade,
  tipo text not null check (tipo in ('dificuldade', 'sugestao', 'problema', 'avaliacao_aula', 'comentario')),
  texto text not null check (length(trim(texto)) between 3 and 2000),
  conteudo_id uuid references public.conteudo (id) on delete set null,
  lido boolean not null default false,
  created_at timestamptz not null default now()
);

create index feedback_caixa_idx on public.feedback (lido, created_at desc);

create table public.aviso (
  id uuid primary key default gen_random_uuid(),
  -- null = todos os alunos.
  turma_id uuid references public.turma (id) on delete cascade,
  titulo text not null check (length(trim(titulo)) > 0),
  texto text not null check (length(trim(texto)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index aviso_turma_idx on public.aviso (turma_id, created_at desc);

create trigger aviso_updated_at
  before update on public.aviso
  for each row execute function public.definir_updated_at();

create table public.notificacao (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfil (id) on delete cascade,
  tipo text not null check (tipo in ('conteudo', 'atividade', 'aviso', 'duvida', 'mensagem')),
  titulo text not null,
  -- Rota do app para onde a notificação leva.
  link text,
  lida_em timestamptz,
  created_at timestamptz not null default now()
);

create index notificacao_caixa_idx on public.notificacao (perfil_id, lida_em, created_at desc);

-- ---------------------------------------------------------------------------
-- Funções de apoio
-- ---------------------------------------------------------------------------

-- Inscrições ativas do usuário logado (ID não bloqueado).
create or replace function public.minhas_inscricoes()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select i.id
  from public.inscricao i
  join public.aluno_autorizado a on a.id = i.aluno_autorizado_id
  where i.perfil_id = (select auth.uid()) and a.ativo;
$$;

-- Notifica todos os alunos ativos de uma turma (ou de todas, com turma nula).
create or replace function public.notificar_turma(p_turma_id uuid, p_tipo text, p_titulo text, p_link text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notificacao (perfil_id, tipo, titulo, link)
  select distinct i.perfil_id, p_tipo, p_titulo, p_link
  from public.inscricao i
  join public.aluno_autorizado a on a.id = i.aluno_autorizado_id
  where a.ativo and (p_turma_id is null or i.turma_id = p_turma_id);
$$;

revoke execute on function public.notificar_turma(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.notificar_conteudo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.publicado and (tg_op = 'INSERT' or not old.publicado) then
    perform public.notificar_turma(
      new.turma_id,
      'conteudo',
      case new.tipo when 'aula_extra' then 'Nova aula extra: ' when 'aula' then 'Nova aula: ' else 'Novo conteúdo: ' end
        || new.titulo,
      '/aluno/conteudos/' || new.id
    );
  end if;
  return new;
end;
$$;

create trigger conteudo_notificar
  after insert or update of publicado on public.conteudo
  for each row execute function public.notificar_conteudo();

create or replace function public.notificar_atividade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Só atividades fora da sala ao vivo: as da aula já aparecem na própria sala.
  if new.status = 'publicada' and old.status is distinct from 'publicada'
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

create trigger atividade_notificar
  after update of status on public.atividade
  for each row execute function public.notificar_atividade();

create or replace function public.notificar_aviso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notificar_turma(new.turma_id, 'aviso', 'Aviso: ' || new.titulo, '/aluno/avisos');
  return new;
end;
$$;

create trigger aviso_notificar
  after insert on public.aviso
  for each row execute function public.notificar_aviso();

create or replace function public.notificar_resposta_da_duvida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'respondida' and old.status is distinct from 'respondida' then
    insert into public.notificacao (perfil_id, tipo, titulo, link)
    select i.perfil_id, 'duvida', 'O professor respondeu: ' || new.titulo, '/aluno/duvidas'
    from public.inscricao i where i.id = new.inscricao_id;
  end if;
  return new;
end;
$$;

create trigger duvida_notificar
  after update of status on public.duvida
  for each row execute function public.notificar_resposta_da_duvida();

create or replace function public.notificar_mensagem_do_professor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.autor = 'professor' then
    insert into public.notificacao (perfil_id, tipo, titulo, link)
    select i.perfil_id, 'mensagem', 'Nova mensagem do professor', '/aluno/mensagens'
    from public.inscricao i where i.id = new.inscricao_id;
  end if;
  return new;
end;
$$;

create trigger mensagem_privada_notificar
  after insert on public.mensagem_privada
  for each row execute function public.notificar_mensagem_do_professor();

-- O aluno não escolhe status nem resposta da própria dúvida; o professor não
-- reescreve a pergunta. Quem responde marca a data.
create or replace function public.proteger_duvida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not public.eh_admin() then
      new.status = 'aberta';
      new.resposta = null;
      new.respondida_em = null;
    end if;
    return new;
  end if;

  if new.status = 'respondida' and old.status is distinct from 'respondida' then
    if length(trim(coalesce(new.resposta, ''))) = 0 then
      raise exception 'Escreva a resposta antes de marcar como respondida.' using errcode = 'P0001';
    end if;
    new.respondida_em = now();
  end if;
  return new;
end;
$$;

create trigger duvida_proteger
  before insert or update on public.duvida
  for each row execute function public.proteger_duvida();

-- Registra o acesso do aluno a um conteúdo (PRD: progresso).
create or replace function public.registrar_acesso(p_conteudo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conteudo public.conteudo;
  v_inscricao uuid;
begin
  select * into v_conteudo from public.conteudo c where c.id = p_conteudo_id;
  if not found or not v_conteudo.publicado or v_conteudo.publicado_em > now() then
    raise exception 'Conteúdo não encontrado.' using errcode = 'P0002';
  end if;

  select i.id into v_inscricao
  from public.inscricao i
  join public.aluno_autorizado a on a.id = i.aluno_autorizado_id
  where i.perfil_id = (select auth.uid()) and a.ativo
    and (v_conteudo.turma_id is null or i.turma_id = v_conteudo.turma_id)
    and i.turma_id in (select public.minhas_turmas())
  order by i.created_at
  limit 1;
  if v_inscricao is null then
    raise exception 'Você não tem acesso a este conteúdo.' using errcode = '42501';
  end if;

  insert into public.conteudo_acesso (conteudo_id, inscricao_id)
  values (p_conteudo_id, v_inscricao)
  on conflict (conteudo_id, inscricao_id) do update set ultimo_em = now();
end;
$$;

-- Atividades da turma com a situação do aluno logado (pendente ou concluída).
create or replace function public.minhas_atividades(p_turma_id uuid)
returns table (
  id uuid,
  tipo text,
  titulo text,
  descricao text,
  status text,
  prazo_em timestamptz,
  dificuldade text,
  categoria text,
  conteudo_id uuid,
  publicada_em timestamptz,
  itens int,
  respondida boolean,
  acertos int,
  respondida_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id, a.tipo, a.titulo, a.descricao, a.status, a.prazo_em, a.dificuldade, a.categoria,
    a.conteudo_id, a.publicada_em,
    (select count(*)::int from public.atividade_item i where i.atividade_id = a.id),
    r.total > 0,
    r.acertos,
    r.quando
  from public.atividade a
  cross join lateral (
    select count(*)::int as total, count(*) filter (where ar.correta)::int as acertos, max(ar.created_at) as quando
    from public.atividade_resposta ar
    join public.atividade_item it on it.id = ar.atividade_item_id
    where it.atividade_id = a.id and ar.inscricao_id = public.minha_inscricao(p_turma_id)
  ) r
  where a.turma_id = p_turma_id
    and a.turma_id in (select public.minhas_turmas())
    and public.minha_inscricao(p_turma_id) is not null
    and a.status in ('publicada', 'encerrada')
    and a.sessao_ao_vivo_id is null
    and a.tipo in ('licao', 'quiz', 'questao')
  order by a.publicada_em desc nulls last;
$$;

-- Números do painel do aluno.
create or replace function public.meu_progresso(p_turma_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with eu as (select public.minha_inscricao(p_turma_id) as inscricao),
  respostas as (
    select a.id as atividade_id, a.tipo, ar.correta, it.tipo_resposta
    from eu
    join public.atividade_resposta ar on ar.inscricao_id = eu.inscricao
    join public.atividade_item it on it.id = ar.atividade_item_id
    join public.atividade a on a.id = it.atividade_id
    where a.turma_id = p_turma_id
  )
  select jsonb_build_object(
    'atividades_realizadas', (select count(distinct atividade_id) from respostas where tipo in ('licao', 'quiz')),
    'atividades_disponiveis', (
      select count(*) from public.atividade a, eu
      where eu.inscricao is not null and a.turma_id = p_turma_id and a.sessao_ao_vivo_id is null
        and a.status in ('publicada', 'encerrada') and a.tipo in ('licao', 'quiz')
    ),
    'questoes_respondidas', (select count(*) from respostas where correta is not null),
    'questoes_corretas', (select count(*) from respostas where correta),
    'conteudos_acessados', (select count(*) from public.conteudo_acesso ca, eu where ca.inscricao_id = eu.inscricao),
    'conteudos_disponiveis', (
      select count(*) from public.conteudo c, eu
      where eu.inscricao is not null and c.publicado and c.publicado_em <= now()
        and (c.turma_id is null or c.turma_id = p_turma_id)
    ),
    'duvidas_abertas', (select count(*) from public.duvida d, eu where d.inscricao_id = eu.inscricao and d.status = 'aberta'),
    'duvidas_respondidas', (select count(*) from public.duvida d, eu where d.inscricao_id = eu.inscricao and d.status = 'respondida')
  );
$$;

revoke execute on function public.minhas_inscricoes() from public, anon;
revoke execute on function public.registrar_acesso(uuid) from public, anon;
revoke execute on function public.minhas_atividades(uuid) from public, anon;
revoke execute on function public.meu_progresso(uuid) from public, anon;
grant execute on function public.minhas_inscricoes() to authenticated;
grant execute on function public.registrar_acesso(uuid) to authenticated;
grant execute on function public.minhas_atividades(uuid) to authenticated;
grant execute on function public.meu_progresso(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.conteudo enable row level security;
alter table public.conteudo_acesso enable row level security;
alter table public.duvida enable row level security;
alter table public.mensagem_privada enable row level security;
alter table public.feedback enable row level security;
alter table public.aviso enable row level security;
alter table public.notificacao enable row level security;

-- Conteúdo: o aluno lê o que está publicado para a turma dele (ou para todas).
create policy conteudo_ler on public.conteudo
  for select to authenticated
  using (
    public.eh_admin()
    or (
      publicado and publicado_em <= now()
      and exists (select 1 from public.minhas_turmas())
      and (turma_id is null or turma_id in (select public.minhas_turmas()))
    )
  );

create policy conteudo_admin on public.conteudo
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- Acessos: o aluno vê os próprios; a escrita passa por `registrar_acesso`.
create policy conteudo_acesso_ler on public.conteudo_acesso
  for select to authenticated
  using (public.eh_admin() or inscricao_id in (select public.minhas_inscricoes()));

-- Dúvida: o aluno cria e lê só as próprias; o professor lê e responde todas.
create policy duvida_ler on public.duvida
  for select to authenticated
  using (public.eh_admin() or inscricao_id in (select public.minhas_inscricoes()));

create policy duvida_criar on public.duvida
  for insert to authenticated
  with check (inscricao_id = public.minha_inscricao(turma_id) and turma_id in (select public.minhas_turmas()));

create policy duvida_admin_atualizar on public.duvida
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy duvida_admin_excluir on public.duvida
  for delete to authenticated
  using (public.eh_admin());

-- Mensagem privada: cada aluno só enxerga a própria conversa com o professor.
create policy mensagem_privada_ler on public.mensagem_privada
  for select to authenticated
  using (public.eh_admin() or inscricao_id in (select public.minhas_inscricoes()));

create policy mensagem_privada_aluno_enviar on public.mensagem_privada
  for insert to authenticated
  with check (autor = 'aluno' and lida_em is null and inscricao_id in (select public.minhas_inscricoes()));

create policy mensagem_privada_professor_enviar on public.mensagem_privada
  for insert to authenticated
  with check (public.eh_admin() and autor = 'professor');

create policy mensagem_privada_admin_atualizar on public.mensagem_privada
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- Feedback: o aluno envia e relê os próprios; só o professor vê todos.
create policy feedback_ler on public.feedback
  for select to authenticated
  using (public.eh_admin() or inscricao_id in (select public.minhas_inscricoes()));

create policy feedback_criar on public.feedback
  for insert to authenticated
  with check (lido = false and inscricao_id = public.minha_inscricao(turma_id) and turma_id in (select public.minhas_turmas()));

create policy feedback_admin_atualizar on public.feedback
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy feedback_admin_excluir on public.feedback
  for delete to authenticated
  using (public.eh_admin());

-- Aviso: para todos os alunos (turma nula) ou para a turma do aluno.
create policy aviso_ler on public.aviso
  for select to authenticated
  using (
    public.eh_admin()
    or (
      exists (select 1 from public.minhas_turmas())
      and (turma_id is null or turma_id in (select public.minhas_turmas()))
    )
  );

create policy aviso_admin on public.aviso
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- Notificação: cada pessoa lê e marca como lidas só as próprias.
create policy notificacao_ler on public.notificacao
  for select to authenticated
  using (perfil_id = (select auth.uid()));

create policy notificacao_marcar on public.notificacao
  for update to authenticated
  using (perfil_id = (select auth.uid()))
  with check (perfil_id = (select auth.uid()));

-- O aluno marca como lidas as mensagens que o professor mandou para ele.
create or replace function public.marcar_mensagens_lidas()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.mensagem_privada
  set lida_em = now()
  where autor = 'professor' and lida_em is null
    and inscricao_id in (select public.minhas_inscricoes());
$$;

revoke execute on function public.marcar_mensagens_lidas() from public, anon;
grant execute on function public.marcar_mensagens_lidas() to authenticated;

-- Arquivos: capa e arquivo de conteúdo e de atividade seguem a RLS da tabela;
-- o anexo da dúvida fica numa pasta do próprio aluno.
create policy materiais_conteudo_ler on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materiais'
    and (
      exists (select 1 from public.conteudo c where c.arquivo_path = objects.name or c.capa_path = objects.name)
      or exists (select 1 from public.atividade a where a.arquivo_path = objects.name)
      or exists (select 1 from public.duvida d where d.anexo_path = objects.name)
    )
  );

create policy materiais_anexo_da_duvida on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materiais'
    and (storage.foldername(name))[1] = 'duvidas'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Visões do painel do professor (security_invoker: só o admin vê tudo)
-- ---------------------------------------------------------------------------

-- Lista de alunos: cada ID autorizado, com a conta (se já criada) e o progresso.
create view public.vw_aluno
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
  (select count(*) from public.feedback f where f.inscricao_id = i.id) as feedbacks
from public.aluno_autorizado aa
join public.turma t on t.id = aa.turma_id
left join public.inscricao i on i.aluno_autorizado_id = aa.id
left join public.perfil p on p.id = i.perfil_id;

-- Atividade recente dos alunos, para o painel.
create view public.vw_atividade_recente
with (security_invoker = true) as
select ca.ultimo_em as quando, 'conteudo' as tipo, p.nome as aluno, i.turma_id,
       'acessou ' || c.titulo as descricao
from public.conteudo_acesso ca
join public.conteudo c on c.id = ca.conteudo_id
join public.inscricao i on i.id = ca.inscricao_id
join public.perfil p on p.id = i.perfil_id
union all
select d.created_at, 'duvida', p.nome, d.turma_id, 'enviou uma dúvida: ' || d.titulo
from public.duvida d
join public.inscricao i on i.id = d.inscricao_id
join public.perfil p on p.id = i.perfil_id
union all
select f.created_at, 'feedback', p.nome, f.turma_id, 'enviou um feedback'
from public.feedback f
join public.inscricao i on i.id = f.inscricao_id
join public.perfil p on p.id = i.perfil_id
union all
select m.created_at, 'mensagem', p.nome, i.turma_id, 'enviou uma mensagem'
from public.mensagem_privada m
join public.inscricao i on i.id = m.inscricao_id
join public.perfil p on p.id = i.perfil_id
where m.autor = 'aluno'
union all
select r.quando, 'atividade', p.nome, a.turma_id,
       case a.tipo when 'questao' then 'respondeu a questão ' else 'respondeu a atividade ' end || a.titulo
from (
  select it.atividade_id, ar.inscricao_id, max(ar.created_at) as quando
  from public.atividade_resposta ar
  join public.atividade_item it on it.id = ar.atividade_item_id
  group by it.atividade_id, ar.inscricao_id
) r
join public.atividade a on a.id = r.atividade_id and not a.anonima
join public.inscricao i on i.id = r.inscricao_id
join public.perfil p on p.id = i.perfil_id;

revoke all on public.vw_aluno from anon;
revoke all on public.vw_atividade_recente from anon;

-- O cadastro por código de e-mail saiu de cena (o aluno agora cria uma senha).
drop table if exists public.cadastro_pendente;

-- Realtime: a caixa do professor e a do aluno atualizam sozinhas.
alter publication supabase_realtime add table public.notificacao;
alter publication supabase_realtime add table public.duvida;
alter publication supabase_realtime add table public.mensagem_privada;
