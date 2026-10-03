-- Cursos e turmas: curso, capacidade, turma, lista de IDs autorizados e inscrição.

create table public.curso (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo_formacao text,
  carga_horaria_h int not null check (carga_horaria_h > 0),
  objetivo text not null,
  ementa_md text not null,
  publico_alvo text,
  pre_requisitos text,
  criterios_avaliacao_md text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger curso_updated_at
  before update on public.curso
  for each row execute function public.definir_updated_at();

create table public.capacidade (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.curso (id) on delete cascade,
  codigo text not null,
  tipo text not null check (tipo in ('tecnica', 'socioemocional')),
  descricao text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curso_id, codigo)
);

create trigger capacidade_updated_at
  before update on public.capacidade
  for each row execute function public.definir_updated_at();

create table public.turma (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.curso (id) on delete restrict,
  codigo text not null unique check (codigo ~ '^[A-Z0-9-]{4,20}$'),
  instituicao text not null,
  cidade text not null,
  modalidade text not null check (modalidade in ('presencial', 'online', 'hibrido')),
  data_inicio date not null,
  data_fim date not null,
  vagas int check (vagas > 0),
  status text not null default 'planejada' check (status in ('planejada', 'ativa', 'encerrada')),
  fuso text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_fim >= data_inicio)
);

create index turma_curso_idx on public.turma (curso_id);

create trigger turma_updated_at
  before update on public.turma
  for each row execute function public.definir_updated_at();

-- Lista de IDs válidos de cada turma, cadastrada pelo professor.
create table public.aluno_autorizado (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turma (id) on delete cascade,
  matricula text not null check (matricula = upper(trim(matricula)) and length(matricula) between 1 and 40),
  nome_referencia text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (turma_id, matricula)
);

create trigger aluno_autorizado_updated_at
  before update on public.aluno_autorizado
  for each row execute function public.definir_updated_at();

-- Normaliza a matrícula na entrada (trim + upper), como pede o PRD.
create or replace function public.normalizar_matricula()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.matricula = upper(trim(new.matricula));
  return new;
end;
$$;

create trigger aluno_autorizado_normalizar
  before insert or update of matricula on public.aluno_autorizado
  for each row execute function public.normalizar_matricula();

create table public.inscricao (
  id uuid primary key default gen_random_uuid(),
  -- Um ID autorizado gera no máximo uma inscrição.
  aluno_autorizado_id uuid not null unique references public.aluno_autorizado (id) on delete cascade,
  -- Redundante com aluno_autorizado.turma_id, para simplificar a RLS.
  turma_id uuid not null references public.turma (id) on delete cascade,
  perfil_id uuid not null references public.perfil (id) on delete cascade,
  ultimo_acesso_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (turma_id, perfil_id)
);

create index inscricao_perfil_idx on public.inscricao (perfil_id);

create trigger inscricao_updated_at
  before update on public.inscricao
  for each row execute function public.definir_updated_at();

-- A turma da inscrição tem de ser a mesma do ID autorizado.
create or replace function public.conferir_turma_da_inscricao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.aluno_autorizado a
    where a.id = new.aluno_autorizado_id and a.turma_id = new.turma_id
  ) then
    raise exception 'A inscrição precisa ser da mesma turma do ID autorizado.';
  end if;
  return new;
end;
$$;

create trigger inscricao_conferir_turma
  before insert or update on public.inscricao
  for each row execute function public.conferir_turma_da_inscricao();

-- ---------------------------------------------------------------------------
-- Funções de apoio à RLS (security definer para não recair nas políticas)
-- ---------------------------------------------------------------------------

-- Turmas em que o usuário logado está inscrito com ID ainda ativo.
-- ID desativado (ativo = false) some daqui: as próximas leituras do aluno
-- voltam vazias e o app encerra a sessão (PRD, seção 7 — Acesso).
create or replace function public.minhas_turmas()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select i.turma_id
  from public.inscricao i
  join public.aluno_autorizado a on a.id = i.aluno_autorizado_id
  join public.turma t on t.id = i.turma_id
  where i.perfil_id = (select auth.uid())
    and a.ativo
    and t.status in ('ativa', 'encerrada');
$$;

-- Inscrição do usuário logado numa turma (null se não inscrito ou inativo).
create or replace function public.minha_inscricao(p_turma_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select i.id
  from public.inscricao i
  join public.aluno_autorizado a on a.id = i.aluno_autorizado_id
  where i.perfil_id = (select auth.uid())
    and i.turma_id = p_turma_id
    and a.ativo;
$$;

alter table public.curso enable row level security;
alter table public.capacidade enable row level security;
alter table public.turma enable row level security;
alter table public.aluno_autorizado enable row level security;
alter table public.inscricao enable row level security;

create policy curso_ler on public.curso
  for select to authenticated
  using (
    public.eh_admin()
    or exists (
      select 1 from public.turma t
      where t.curso_id = curso.id and t.id in (select public.minhas_turmas())
    )
  );

create policy curso_admin on public.curso
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy capacidade_ler on public.capacidade
  for select to authenticated
  using (
    public.eh_admin()
    or exists (
      select 1 from public.turma t
      where t.curso_id = capacidade.curso_id and t.id in (select public.minhas_turmas())
    )
  );

create policy capacidade_admin on public.capacidade
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy turma_ler on public.turma
  for select to authenticated
  using (public.eh_admin() or id in (select public.minhas_turmas()));

create policy turma_admin on public.turma
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- A lista de IDs é só do professor: o aluno nunca lê matrículas, nem a própria
-- (a validação acontece na Edge Function `acesso-aluno`).
create policy aluno_autorizado_admin on public.aluno_autorizado
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy inscricao_ler on public.inscricao
  for select to authenticated
  using (public.eh_admin() or perfil_id = (select auth.uid()));

-- Inscrições nascem na Edge Function (service role); o admin pode ajustar.
create policy inscricao_admin on public.inscricao
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());
