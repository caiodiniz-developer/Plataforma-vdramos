-- Funções da sala ao vivo chamadas pelo aluno (RPC). Todas validam a
-- inscrição, o status da sessão e as regras do PRD no servidor.

-- Contexto da sessão para o usuário logado; falha se ele não puder interagir.
create or replace function public.contexto_da_sessao(p_sessao_id uuid)
returns table (
  turma_id uuid,
  encontro_id uuid,
  inscricao_id uuid,
  fuso text,
  permite_anonimo boolean,
  chat_ativo boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sessao public.sessao_ao_vivo;
  v_turma public.turma;
  v_inscricao uuid;
begin
  select * into v_sessao from public.sessao_ao_vivo s where s.id = p_sessao_id;
  if not found then
    raise exception 'Sessão não encontrada.' using errcode = 'P0002';
  end if;

  select t.* into v_turma
  from public.turma t
  join public.encontro e on e.turma_id = t.id
  where e.id = v_sessao.encontro_id;

  v_inscricao := public.minha_inscricao(v_turma.id);
  if v_inscricao is null then
    raise exception 'Você não está inscrito nesta turma.' using errcode = '42501';
  end if;

  -- Sessão encerrada ou turma encerrada: sala somente leitura.
  if v_sessao.status <> 'aberta' or v_turma.status <> 'ativa' then
    raise exception 'A sessão está encerrada.' using errcode = 'P0001';
  end if;

  return query
    select v_turma.id, v_sessao.encontro_id, v_inscricao, v_turma.fuso,
           v_sessao.permite_anonimo, v_sessao.chat_ativo;
end;
$$;

revoke execute on function public.contexto_da_sessao(uuid) from public, anon, authenticated;

-- PRD F10: envia uma pergunta e marca o bloco em andamento no fuso da turma.
create or replace function public.enviar_pergunta(
  p_sessao_id uuid,
  p_texto text,
  p_destino text,
  p_anonima boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_agora timestamp;
  v_bloco uuid;
  v_nome text;
  v_pergunta uuid;
begin
  select * into v_ctx from public.contexto_da_sessao(p_sessao_id);

  if p_destino not in ('turma', 'professor') then
    raise exception 'Destino inválido.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_texto, ''))) not between 3 and 500 then
    raise exception 'A pergunta precisa ter de 3 a 500 caracteres.' using errcode = '22023';
  end if;
  if p_anonima and not v_ctx.permite_anonimo then
    raise exception 'Esta sessão não aceita perguntas anônimas.' using errcode = 'P0001';
  end if;

  v_agora := now() at time zone v_ctx.fuso;

  select b.id into v_bloco
  from public.bloco_encontro b
  join public.encontro e on e.id = b.encontro_id
  where b.encontro_id = v_ctx.encontro_id
    and e.data = v_agora::date
    and v_agora::time >= b.hora_inicio
    and v_agora::time < b.hora_inicio + make_interval(mins => b.duracao_min)
  order by b.ordem
  limit 1;

  if not p_anonima then
    select p.nome into v_nome from public.perfil p where p.id = (select auth.uid());
  end if;

  insert into public.pergunta (sessao_ao_vivo_id, bloco_encontro_id, texto, destino, anonima, autor_nome)
  values (p_sessao_id, v_bloco, trim(p_texto), p_destino, coalesce(p_anonima, false), v_nome)
  returning id into v_pergunta;

  insert into public.pergunta_autoria (pergunta_id, inscricao_id)
  values (v_pergunta, v_ctx.inscricao_id);

  return v_pergunta;
end;
$$;

-- PRD F11: voto em pergunta do mural, como alternância. Retorna true quando
-- o voto ficou registrado e false quando foi retirado.
create or replace function public.alternar_voto(p_pergunta_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pergunta public.pergunta;
  v_ctx record;
  v_removidos int;
begin
  select * into v_pergunta from public.pergunta p where p.id = p_pergunta_id for update;
  if not found or v_pergunta.destino <> 'turma' or v_pergunta.status = 'oculta' then
    raise exception 'Pergunta não encontrada.' using errcode = 'P0002';
  end if;

  select * into v_ctx from public.contexto_da_sessao(v_pergunta.sessao_ao_vivo_id);

  delete from public.pergunta_voto v
  where v.pergunta_id = p_pergunta_id and v.inscricao_id = v_ctx.inscricao_id;
  get diagnostics v_removidos = row_count;

  if v_removidos > 0 then
    update public.pergunta set votos = greatest(votos - 1, 0) where id = p_pergunta_id;
    return false;
  end if;

  insert into public.pergunta_voto (pergunta_id, inscricao_id)
  values (p_pergunta_id, v_ctx.inscricao_id);
  update public.pergunta set votos = votos + 1 where id = p_pergunta_id;
  return true;
end;
$$;

-- PRD F12: mensagem da turma. Texto que é só uma URL vira tipo 'link';
-- limite de uma mensagem a cada 5 s por aluno.
create or replace function public.enviar_mensagem(p_sessao_id uuid, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_texto text := trim(coalesce(p_texto, ''));
  v_ultima timestamptz;
  v_mensagem uuid;
begin
  select * into v_ctx from public.contexto_da_sessao(p_sessao_id);

  if not v_ctx.chat_ativo then
    raise exception 'As mensagens estão desativadas nesta sessão.' using errcode = 'P0001';
  end if;
  if length(v_texto) not between 1 and 1000 then
    raise exception 'A mensagem precisa ter de 1 a 1000 caracteres.' using errcode = '22023';
  end if;

  select max(m.created_at) into v_ultima
  from public.mensagem m
  where m.sessao_ao_vivo_id = p_sessao_id and m.perfil_id = (select auth.uid());

  if v_ultima is not null and v_ultima > now() - interval '5 seconds' then
    raise exception 'Aguarde alguns segundos para enviar outra mensagem.' using errcode = 'P0001';
  end if;

  insert into public.mensagem (sessao_ao_vivo_id, perfil_id, tipo, texto)
  values (
    p_sessao_id,
    (select auth.uid()),
    case when v_texto ~* '^https?://[^[:space:]<>"'']+$' then 'link' else 'texto' end,
    v_texto
  )
  returning id into v_mensagem;

  return v_mensagem;
end;
$$;

revoke execute on function public.enviar_pergunta(uuid, text, text, boolean) from public, anon;
revoke execute on function public.alternar_voto(uuid) from public, anon;
revoke execute on function public.enviar_mensagem(uuid, text) from public, anon;
grant execute on function public.enviar_pergunta(uuid, text, text, boolean) to authenticated;
grant execute on function public.alternar_voto(uuid) to authenticated;
grant execute on function public.enviar_mensagem(uuid, text) to authenticated;
