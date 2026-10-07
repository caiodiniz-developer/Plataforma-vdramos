-- Correção: `pergunta.votos` ficava inflado quando um voto sumia em cascata
-- (aluno que excluiu a conta, ID autorizado removido, retenção de 24 meses).
-- A função `alternar_voto` ajustava o contador por conta própria, então só
-- enxergava os votos tirados por ela.
--
-- Agora quem mantém o contador é um gatilho em `pergunta_voto`: qualquer
-- inserção ou remoção de voto, por qualquer caminho, atualiza a pergunta.

create or replace function public.contar_voto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.pergunta set votos = votos + 1 where id = new.pergunta_id;
    return new;
  end if;

  -- Se a própria pergunta está sendo apagada, não há o que atualizar.
  update public.pergunta set votos = greatest(votos - 1, 0) where id = old.pergunta_id;
  return old;
end;
$$;

create trigger pergunta_voto_contar
  after insert or delete on public.pergunta_voto
  for each row execute function public.contar_voto();

-- `alternar_voto` deixa de mexer no contador (o gatilho faz isso).
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
    return false;
  end if;

  insert into public.pergunta_voto (pergunta_id, inscricao_id)
  values (p_pergunta_id, v_ctx.inscricao_id);
  return true;
end;
$$;

-- Acerta contadores que já estejam fora de sincronia.
update public.pergunta p
set votos = c.total
from (
  select p2.id, (select count(*) from public.pergunta_voto v where v.pergunta_id = p2.id) as total
  from public.pergunta p2
) c
where c.id = p.id and p.votos <> c.total;
