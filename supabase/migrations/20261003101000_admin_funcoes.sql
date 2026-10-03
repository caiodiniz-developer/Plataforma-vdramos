-- Funções do painel admin: salvar blocos do encontro e duplicar turma.

-- PRD F18: salva a lista de blocos na ordem recebida e recalcula a hora de
-- início de cada um a partir do início do encontro. Blocos existentes são
-- atualizados (o id é preservado, porque perguntas e atividades apontam para
-- ele); os que não vieram na lista são removidos.
-- p_blocos: [{ "id": uuid | null, "duracao_min": int, "tipo": text, "titulo": text, "descricao": text }]
create or replace function public.salvar_blocos(p_encontro_id uuid, p_blocos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cursor time;
  v_bloco jsonb;
  v_ordem int := 0;
  v_ids uuid[] := '{}';
  v_id uuid;
begin
  if not public.eh_admin() then
    raise exception 'Somente o professor edita o calendário.' using errcode = '42501';
  end if;

  select e.hora_inicio into v_cursor from public.encontro e where e.id = p_encontro_id;
  if not found then
    raise exception 'Encontro não encontrado.' using errcode = 'P0002';
  end if;

  -- A unicidade (encontro_id, ordem) é deferida: confere só no fim da transação.
  for v_bloco in select * from jsonb_array_elements(coalesce(p_blocos, '[]'::jsonb))
  loop
    v_ordem := v_ordem + 1;
    v_id := nullif(v_bloco ->> 'id', '')::uuid;

    if v_id is not null then
      update public.bloco_encontro
      set ordem = v_ordem,
          hora_inicio = v_cursor,
          duracao_min = (v_bloco ->> 'duracao_min')::int,
          tipo = v_bloco ->> 'tipo',
          titulo = v_bloco ->> 'titulo',
          descricao = nullif(v_bloco ->> 'descricao', '')
      where id = v_id and encontro_id = p_encontro_id;
      if not found then
        raise exception 'Bloco % não pertence a este encontro.', v_id using errcode = '22023';
      end if;
    else
      insert into public.bloco_encontro (encontro_id, ordem, hora_inicio, duracao_min, tipo, titulo, descricao)
      values (
        p_encontro_id,
        v_ordem,
        v_cursor,
        (v_bloco ->> 'duracao_min')::int,
        v_bloco ->> 'tipo',
        v_bloco ->> 'titulo',
        nullif(v_bloco ->> 'descricao', '')
      )
      returning id into v_id;
    end if;

    v_ids := v_ids || v_id;
    v_cursor := v_cursor + make_interval(mins => (v_bloco ->> 'duracao_min')::int);
  end loop;

  delete from public.bloco_encontro b
  where b.encontro_id = p_encontro_id and not (b.id = any (v_ids));
end;
$$;

-- PRD F16: copia encontros, blocos, materiais e atividades (em rascunho) para
-- uma turma nova do mesmo curso. As datas são deslocadas pela diferença entre
-- o início da turma de origem e o novo início.
create or replace function public.duplicar_turma(
  p_turma_id uuid,
  p_codigo text,
  p_data_inicio date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origem public.turma;
  v_nova uuid;
  v_dias int;
  v_encontro record;
  v_novo_encontro uuid;
  v_atividade record;
  v_nova_atividade uuid;
  v_item record;
  v_novo_item uuid;
begin
  if not public.eh_admin() then
    raise exception 'Somente o professor duplica turmas.' using errcode = '42501';
  end if;

  select * into v_origem from public.turma t where t.id = p_turma_id;
  if not found then
    raise exception 'Turma não encontrada.' using errcode = 'P0002';
  end if;

  v_dias := p_data_inicio - v_origem.data_inicio;

  insert into public.turma
    (curso_id, codigo, instituicao, cidade, modalidade, data_inicio, data_fim, vagas, status, fuso)
  values (
    v_origem.curso_id, p_codigo, v_origem.instituicao, v_origem.cidade, v_origem.modalidade,
    p_data_inicio, v_origem.data_fim + v_dias, v_origem.vagas, 'planejada', v_origem.fuso
  )
  returning id into v_nova;

  -- Mapas origem → cópia, para religar materiais e atividades.
  create temporary table mapa_encontro (origem uuid primary key, copia uuid not null) on commit drop;
  create temporary table mapa_bloco (origem uuid primary key, copia uuid not null) on commit drop;

  for v_encontro in
    select * from public.encontro e where e.turma_id = p_turma_id order by e.numero
  loop
    insert into public.encontro (turma_id, numero, data, hora_inicio, hora_fim, titulo, descricao, local)
    values (
      v_nova, v_encontro.numero, v_encontro.data + v_dias, v_encontro.hora_inicio,
      v_encontro.hora_fim, v_encontro.titulo, v_encontro.descricao, v_encontro.local
    )
    returning id into v_novo_encontro;

    insert into mapa_encontro values (v_encontro.id, v_novo_encontro);

    with copiados as (
      insert into public.bloco_encontro (encontro_id, ordem, hora_inicio, duracao_min, tipo, titulo, descricao)
      select v_novo_encontro, b.ordem, b.hora_inicio, b.duracao_min, b.tipo, b.titulo, b.descricao
      from public.bloco_encontro b
      where b.encontro_id = v_encontro.id
      order by b.ordem
      returning id, ordem
    )
    insert into mapa_bloco
    select b.id, c.id
    from public.bloco_encontro b
    join copiados c on c.ordem = b.ordem
    where b.encontro_id = v_encontro.id;
  end loop;

  -- A liberação programada acompanha o deslocamento das datas.
  insert into public.material
    (turma_id, encontro_id, titulo, tipo, tipo_outro, url, arquivo_path, liberado_em, ordem)
  select
    v_nova, me.copia, m.titulo, m.tipo, m.tipo_outro, m.url, m.arquivo_path,
    m.liberado_em + make_interval(days => v_dias), m.ordem
  from public.material m
  left join mapa_encontro me on me.origem = m.encontro_id
  where m.turma_id = p_turma_id;

  for v_atividade in
    select * from public.atividade a where a.turma_id = p_turma_id order by a.created_at
  loop
    insert into public.atividade
      (turma_id, sessao_ao_vivo_id, tipo, titulo, alvo, bloco_encontro_id, status, anonima,
       mostrar_resultado, tempo_limite_s)
    values (
      v_nova,
      (
        select s2.id
        from public.sessao_ao_vivo s1
        join mapa_encontro me on me.origem = s1.encontro_id
        join public.sessao_ao_vivo s2 on s2.encontro_id = me.copia
        where s1.id = v_atividade.sessao_ao_vivo_id
      ),
      v_atividade.tipo, v_atividade.titulo, v_atividade.alvo,
      (select mb.copia from mapa_bloco mb where mb.origem = v_atividade.bloco_encontro_id),
      'rascunho', v_atividade.anonima, v_atividade.mostrar_resultado, v_atividade.tempo_limite_s
    )
    returning id into v_nova_atividade;

    for v_item in
      select * from public.atividade_item i where i.atividade_id = v_atividade.id order by i.ordem
    loop
      insert into public.atividade_item (atividade_id, ordem, enunciado, tipo_resposta, obrigatorio, explicacao)
      values (
        v_nova_atividade, v_item.ordem, v_item.enunciado, v_item.tipo_resposta,
        v_item.obrigatorio, v_item.explicacao
      )
      returning id into v_novo_item;

      insert into public.atividade_opcao (atividade_item_id, ordem, texto, correta)
      select v_novo_item, o.ordem, o.texto, o.correta
      from public.atividade_opcao o
      where o.atividade_item_id = v_item.id;
    end loop;
  end loop;

  return v_nova;
end;
$$;

-- Contadores da lista de turmas (PRD F16): autorizados, inscritos, encontros.
create view public.vw_turma_resumo
with (security_invoker = true) as
select
  t.*,
  c.nome as curso_nome,
  (select count(*) from public.aluno_autorizado a where a.turma_id = t.id) as autorizados,
  (select count(*) from public.inscricao i where i.turma_id = t.id) as inscritos,
  (select count(*) from public.encontro e where e.turma_id = t.id) as encontros
from public.turma t
join public.curso c on c.id = t.curso_id;

revoke all on public.vw_turma_resumo from anon;
revoke execute on function public.salvar_blocos(uuid, jsonb) from public, anon;
revoke execute on function public.duplicar_turma(uuid, text, date) from public, anon;
grant execute on function public.salvar_blocos(uuid, jsonb) to authenticated;
grant execute on function public.duplicar_turma(uuid, text, date) to authenticated;
