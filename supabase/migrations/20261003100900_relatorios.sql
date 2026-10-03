-- Views de relatório (PRD, seção 3). Todas com security_invoker: valem as
-- políticas de quem consulta, então só o admin enxerga os dados completos.

-- Agregado por item e por opção. Itens sem opção (escala, NPS, texto) geram
-- uma linha com opcao_id nulo.
create view public.vw_resultado_atividade
with (security_invoker = true) as
select
  a.id as atividade_id,
  a.turma_id,
  a.tipo as atividade_tipo,
  a.titulo as atividade_titulo,
  a.anonima,
  i.id as atividade_item_id,
  i.ordem as item_ordem,
  i.enunciado,
  i.tipo_resposta,
  o.id as opcao_id,
  o.ordem as opcao_ordem,
  o.texto as opcao_texto,
  o.correta as opcao_correta,
  (
    select count(*) from public.atividade_resposta r
    where r.atividade_item_id = i.id and o.id = any (r.opcao_ids)
  ) as total_opcao,
  t.respostas,
  t.acertos,
  t.media,
  t.nps
from public.atividade a
join public.atividade_item i on i.atividade_id = a.id
left join public.atividade_opcao o on o.atividade_item_id = i.id
left join lateral (
  select
    count(*) as respostas,
    count(*) filter (where r.correta) as acertos,
    round(avg(r.valor)::numeric, 1) as media,
    case
      when i.tipo_resposta = 'nps_0_10' and count(r.valor) > 0 then
        round(
          100.0 * (count(*) filter (where r.valor >= 9) - count(*) filter (where r.valor <= 6))
          / count(r.valor)
        )
    end as nps
  from public.atividade_resposta r
  where r.atividade_item_id = i.id
) t on true;

-- Média de satisfação (escala 1–5) por tipo de bloco e por encontro.
-- O tipo vem do bloco avaliado; sem bloco, vale o alvo da pesquisa.
create view public.vw_satisfacao_por_bloco
with (security_invoker = true) as
select
  a.turma_id,
  e.id as encontro_id,
  e.numero as encontro_numero,
  coalesce(b.tipo, a.alvo) as tipo_bloco,
  count(r.id) as respostas,
  round(avg(r.valor)::numeric, 1) as media
from public.atividade a
join public.atividade_item i on i.atividade_id = a.id and i.tipo_resposta = 'escala_1_5'
join public.atividade_resposta r on r.atividade_item_id = i.id
left join public.bloco_encontro b on b.id = a.bloco_encontro_id
left join public.sessao_ao_vivo s on s.id = a.sessao_ao_vivo_id
join public.encontro e on e.id = coalesce(b.encontro_id, s.encontro_id)
where a.tipo = 'pesquisa_satisfacao'
  and coalesce(b.tipo, a.alvo) in ('teoria', 'pratica')
group by a.turma_id, e.id, e.numero, coalesce(b.tipo, a.alvo);

-- Participação por inscrição. Perguntas anônimas não entram na contagem: a
-- autoria delas não é visível nem para o professor.
create view public.vw_participacao_aluno
with (security_invoker = true) as
select
  i.id as inscricao_id,
  i.turma_id,
  p.nome,
  aa.matricula,
  i.ultimo_acesso_em,
  (
    select count(*) from public.pergunta_autoria pa where pa.inscricao_id = i.id
  ) as perguntas,
  (
    select count(*)
    from public.mensagem m
    where m.perfil_id = i.perfil_id
      and public.turma_da_sessao(m.sessao_ao_vivo_id) = i.turma_id
  ) as mensagens,
  (
    select count(*)
    from public.atividade_resposta r
    join public.atividade_item it on it.id = r.atividade_item_id
    join public.atividade a on a.id = it.atividade_id
    where r.inscricao_id = i.id and not a.anonima
  ) as respostas,
  (
    select count(*)
    from public.atividade_resposta r
    join public.atividade_item it on it.id = r.atividade_item_id
    join public.atividade a on a.id = it.atividade_id
    where r.inscricao_id = i.id and not a.anonima and r.correta
  ) as acertos
from public.inscricao i
join public.perfil p on p.id = i.perfil_id
join public.aluno_autorizado aa on aa.id = i.aluno_autorizado_id;

-- PRD F21: nas atividades anônimas o CSV leva este hash no lugar do nome.
-- O id da atividade entra no hash para o mesmo aluno não ser rastreável entre
-- atividades diferentes.
create or replace function public.hash_inscricao(p_inscricao_id uuid, p_atividade_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select substr(encode(sha256(convert_to(p_inscricao_id::text || ':' || p_atividade_id::text, 'UTF8')), 'hex'), 1, 12);
$$;

-- Linhas do CSV de respostas, já com nome ou hash conforme o anonimato.
create view public.vw_exportacao_respostas
with (security_invoker = true) as
select
  a.turma_id,
  a.id as atividade_id,
  a.titulo as atividade,
  a.tipo as atividade_tipo,
  it.ordem as item,
  it.enunciado,
  case when a.anonima then public.hash_inscricao(r.inscricao_id, a.id) else p.nome end as aluno,
  (
    select string_agg(o.texto, ' | ' order by o.ordem)
    from public.atividade_opcao o
    where o.id = any (r.opcao_ids)
  ) as opcoes,
  r.valor,
  r.texto,
  r.correta,
  r.tempo_resposta_ms,
  r.created_at
from public.atividade_resposta r
join public.atividade_item it on it.id = r.atividade_item_id
join public.atividade a on a.id = it.atividade_id
join public.inscricao i on i.id = r.inscricao_id
join public.perfil p on p.id = i.perfil_id;

-- Lista de e-mails com consentimento de comunicação vigente = true.
create view public.vw_emails_comunicacao
with (security_invoker = true) as
select i.turma_id, p.nome, p.email, c.created_at as consentiu_em
from public.inscricao i
join public.perfil p on p.id = i.perfil_id
join lateral (
  select c.concedido, c.created_at
  from public.consentimento c
  where c.perfil_id = p.id and c.finalidade = 'comunicacao_professor'
  order by c.created_at desc
  limit 1
) c on c.concedido;

revoke all on public.vw_resultado_atividade from anon;
revoke all on public.vw_satisfacao_por_bloco from anon;
revoke all on public.vw_participacao_aluno from anon;
revoke all on public.vw_exportacao_respostas from anon;
revoke all on public.vw_emails_comunicacao from anon;
