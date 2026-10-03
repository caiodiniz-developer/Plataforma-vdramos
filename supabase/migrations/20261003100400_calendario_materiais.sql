-- Calendário e materiais: encontro, bloco do encontro e material.

create table public.encontro (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turma (id) on delete cascade,
  numero int not null check (numero > 0),
  data date not null,
  hora_inicio time not null,
  hora_fim time not null,
  titulo text not null,
  descricao text,
  local text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (turma_id, numero),
  check (hora_fim > hora_inicio)
);

create index encontro_agenda_idx on public.encontro (turma_id, data);

create trigger encontro_updated_at
  before update on public.encontro
  for each row execute function public.definir_updated_at();

create table public.bloco_encontro (
  id uuid primary key default gen_random_uuid(),
  encontro_id uuid not null references public.encontro (id) on delete cascade,
  ordem int not null,
  hora_inicio time not null,
  duracao_min int not null check (duracao_min > 0),
  tipo text not null check (tipo in ('abertura', 'teoria', 'pratica', 'perguntas', 'intervalo', 'margem')),
  titulo text not null,
  descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Deferrable para permitir reordenar os blocos numa única transação.
  constraint bloco_encontro_ordem_unica unique (encontro_id, ordem) deferrable initially deferred
);

create trigger bloco_encontro_updated_at
  before update on public.bloco_encontro
  for each row execute function public.definir_updated_at();

create table public.material (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turma (id) on delete cascade,
  -- null = material geral do curso.
  encontro_id uuid references public.encontro (id) on delete set null,
  titulo text not null,
  tipo text not null check (tipo in ('link', 'arquivo', 'video', 'slides', 'exercicio', 'outro')),
  tipo_outro text,
  url text,
  -- Caminho no bucket privado `materiais`.
  arquivo_path text,
  -- null = liberado já.
  liberado_em timestamptz,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_tipo_outro_obrigatorio
    check (tipo <> 'outro' or length(trim(coalesce(tipo_outro, ''))) > 0),
  constraint material_url_ou_arquivo
    check (url is not null or arquivo_path is not null),
  constraint material_url_http
    check (url is null or url ~* '^https?://')
);

create index material_turma_idx on public.material (turma_id, encontro_id, ordem);

create trigger material_updated_at
  before update on public.material
  for each row execute function public.definir_updated_at();

alter table public.encontro enable row level security;
alter table public.bloco_encontro enable row level security;
alter table public.material enable row level security;

create policy encontro_ler on public.encontro
  for select to authenticated
  using (public.eh_admin() or turma_id in (select public.minhas_turmas()));

create policy encontro_admin on public.encontro
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy bloco_encontro_ler on public.bloco_encontro
  for select to authenticated
  using (
    public.eh_admin()
    or exists (
      select 1 from public.encontro e
      where e.id = bloco_encontro.encontro_id and e.turma_id in (select public.minhas_turmas())
    )
  );

create policy bloco_encontro_admin on public.bloco_encontro
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- O aluno só enxerga material já liberado (liberação programada, PRD F7).
create policy material_ler on public.material
  for select to authenticated
  using (
    public.eh_admin()
    or (
      turma_id in (select public.minhas_turmas())
      and (liberado_em is null or liberado_em <= now())
    )
  );

create policy material_admin on public.material
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());
