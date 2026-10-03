-- Infraestrutura das Edge Functions e retenção de dados (LGPD).
-- Estas tabelas não estavam na primeira versão do PRD; ver seção 3.

-- Tentativas por IP, para os limites do PRD:
--   acesso-aluno: mais de 5 combinações inválidas em 15 min → bloqueio de 15 min
--   contato: 3 envios por hora
-- O IP é guardado só como hash. Sem políticas: apenas a service role acessa.
create table public.limite_tentativa (
  id uuid primary key default gen_random_uuid(),
  acao text not null check (acao in ('acesso_aluno', 'contato')),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index limite_tentativa_idx on public.limite_tentativa (acao, ip_hash, created_at desc);

alter table public.limite_tentativa enable row level security;

-- Conta as tentativas recentes e registra a atual numa única chamada.
-- Retorna true quando a ação ainda está dentro do limite.
create or replace function public.dentro_do_limite(
  p_acao text,
  p_ip_hash text,
  p_maximo int,
  p_janela interval,
  p_registrar boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int;
begin
  select count(*) into v_total
  from public.limite_tentativa l
  where l.acao = p_acao and l.ip_hash = p_ip_hash and l.created_at > now() - p_janela;

  if v_total >= p_maximo then
    return false;
  end if;

  if p_registrar then
    insert into public.limite_tentativa (acao, ip_hash) values (p_acao, p_ip_hash);
  end if;
  return true;
end;
$$;

-- Dados do cadastro entre o envio do código e a confirmação (PRD F3).
-- A inscrição só é criada depois que o e-mail é confirmado.
create table public.cadastro_pendente (
  aluno_autorizado_id uuid primary key references public.aluno_autorizado (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  email text not null,
  quer_comunicacao boolean not null default false,
  versao_termo text not null,
  expira_em timestamptz not null default now() + interval '15 minutes',
  created_at timestamptz not null default now()
);

alter table public.cadastro_pendente enable row level security;

revoke all on public.limite_tentativa from anon, authenticated;
revoke all on public.cadastro_pendente from anon, authenticated;
revoke execute on function public.dentro_do_limite(text, text, int, interval, boolean)
  from public, anon, authenticated;

-- Retenção (assumido no PRD): 24 meses depois de `turma.data_fim`, os dados
-- pessoais da turma são apagados. Ficam a estrutura do curso (encontros,
-- blocos, materiais, atividades) para reaproveitar em turmas novas.
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
  delete from public.cadastro_pendente where expira_em < now();

  return array_length(v_turmas, 1);
end;
$$;

revoke execute on function public.aplicar_retencao() from public, anon, authenticated;

-- Job mensal, quando a extensão pg_cron estiver habilitada no projeto.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('retencao-mensal', '0 6 1 * *', 'select public.aplicar_retencao()');
  end if;
end;
$$;
