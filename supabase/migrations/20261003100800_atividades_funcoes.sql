-- Funções das atividades: publicar, encerrar, responder e ler como aluno.

-- PRD F19 e seção 7: o que impede publicar. Lista vazia = pode publicar.
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
    if v_atividade.tipo = 'quiz' then
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

create or replace function public.publicar_atividade(p_atividade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atividade public.atividade;
  v_problemas text[];
begin
  if not public.eh_admin() then
    raise exception 'Somente o professor publica atividades.' using errcode = '42501';
  end if;

  select * into v_atividade from public.atividade a where a.id = p_atividade_id for update;
  if not found then
    raise exception 'Atividade não encontrada.' using errcode = 'P0002';
  end if;
  if v_atividade.status = 'publicada' then
    return;
  end if;

  v_problemas := public.problemas_da_atividade(p_atividade_id);
  if array_length(v_problemas, 1) > 0 then
    raise exception '%', array_to_string(v_problemas, ' ') using errcode = 'P0001';
  end if;

  -- Atividade ligada a uma sessão só pode ir ao ar com a sessão aberta.
  if v_atividade.sessao_ao_vivo_id is not null and not exists (
    select 1 from public.sessao_ao_vivo s
    where s.id = v_atividade.sessao_ao_vivo_id and s.status = 'aberta'
  ) then
    raise exception 'Abra a sessão ao vivo antes de publicar esta atividade.' using errcode = 'P0001';
  end if;

  update public.atividade
  set status = 'publicada', publicada_em = now(), encerrada_em = null
  where id = p_atividade_id;
end;
$$;

create or replace function public.encerrar_atividade(p_atividade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then
    raise exception 'Somente o professor encerra atividades.' using errcode = '42501';
  end if;

  update public.atividade
  set status = 'encerrada', encerrada_em = now()
  where id = p_atividade_id and status = 'publicada';
end;
$$;

create or replace function public.abrir_sessao(p_sessao_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then
    raise exception 'Somente o professor abre a sessão.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.turma t
    where t.id = public.turma_da_sessao(p_sessao_id) and t.status = 'ativa'
  ) then
    raise exception 'A turma precisa estar ativa para abrir a sessão.' using errcode = 'P0001';
  end if;

  update public.sessao_ao_vivo
  set status = 'aberta', aberta_em = coalesce(aberta_em, now()), encerrada_em = null
  where id = p_sessao_id;
end;
$$;

-- Fluxo "Aula ao vivo", passo 7: encerrar a sessão encerra as atividades
-- publicadas nela e deixa a sala somente leitura.
create or replace function public.encerrar_sessao(p_sessao_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then
    raise exception 'Somente o professor encerra a sessão.' using errcode = '42501';
  end if;

  update public.atividade
  set status = 'encerrada', encerrada_em = now()
  where sessao_ao_vivo_id = p_sessao_id and status = 'publicada';

  update public.sessao_ao_vivo
  set status = 'encerrada', encerrada_em = now()
  where id = p_sessao_id and status = 'aberta';
end;
$$;

-- PRD F13: grava todas as respostas da atividade numa transação.
-- p_respostas: [{ "item_id": uuid, "opcao_ids": [uuid], "valor": int, "texto": text }]
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
        if v_atividade.tipo = 'quiz' then
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

-- O que o aluno vê de uma atividade: itens e opções sem gabarito, as próprias
-- respostas, a correção dos itens já respondidos (quiz) e, quando a regra
-- `mostrar_resultado` permite, o resultado agregado da turma.
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
                 when v_atividade.tipo = 'quiz' and (r.id is not null or v_atividade.status = 'encerrada')
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
          when v_atividade.tipo = 'quiz' and (r.id is not null or v_atividade.status = 'encerrada')
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
    'respondida', v_respondeu,
    'mostra_resultado', v_ve_resultado,
    'itens', v_itens
  );
end;
$$;

revoke execute on function public.problemas_da_atividade(uuid) from public, anon;
revoke execute on function public.publicar_atividade(uuid) from public, anon;
revoke execute on function public.encerrar_atividade(uuid) from public, anon;
revoke execute on function public.abrir_sessao(uuid) from public, anon;
revoke execute on function public.encerrar_sessao(uuid) from public, anon;
revoke execute on function public.responder_atividade(uuid, jsonb) from public, anon;
revoke execute on function public.atividade_para_aluno(uuid) from public, anon;
grant execute on function public.problemas_da_atividade(uuid) to authenticated;
grant execute on function public.publicar_atividade(uuid) to authenticated;
grant execute on function public.encerrar_atividade(uuid) to authenticated;
grant execute on function public.abrir_sessao(uuid) to authenticated;
grant execute on function public.encerrar_sessao(uuid) to authenticated;
grant execute on function public.responder_atividade(uuid, jsonb) to authenticated;
grant execute on function public.atividade_para_aluno(uuid) to authenticated;
