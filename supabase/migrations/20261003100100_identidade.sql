-- Identidade e LGPD: perfil e consentimento.

create table public.perfil (
  id uuid primary key references auth.users (id) on delete cascade,
  papel text not null default 'aluno' check (papel in ('admin', 'aluno')),
  nome text not null check (length(trim(nome)) > 0),
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.perfil is 'Usuário do Supabase Auth com o papel de acesso (admin ou aluno).';

create trigger perfil_updated_at
  before update on public.perfil
  for each row execute function public.definir_updated_at();

-- Append-only: o estado vigente é o registro mais recente por perfil + finalidade.
create table public.consentimento (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfil (id) on delete cascade,
  finalidade text not null check (finalidade in ('comunicacao_professor', 'uso_dados_pedagogicos')),
  concedido boolean not null,
  versao_termo text not null,
  origem text not null check (origem in ('cadastro', 'area_aluno', 'admin')),
  created_at timestamptz not null default now()
);

comment on table public.consentimento is
  'Histórico de consentimentos (LGPD). Nunca é atualizado: cada mudança é um novo registro.';

create index consentimento_vigente_idx
  on public.consentimento (perfil_id, finalidade, created_at desc);

-- Papel do usuário logado. Security definer para poder ser usada dentro das
-- políticas de RLS sem recursão na própria tabela perfil.
create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfil p
    where p.id = (select auth.uid()) and p.papel = 'admin'
  );
$$;

comment on function public.eh_admin() is 'true quando o usuário logado tem perfil.papel = admin.';

-- Ninguém promove a si mesmo: papel e e-mail só mudam pelo admin ou pelo servidor.
create or replace function public.proteger_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.eh_admin() then
    if new.papel is distinct from old.papel or new.email is distinct from old.email then
      raise exception 'Somente o professor pode alterar papel ou e-mail.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger perfil_proteger
  before update on public.perfil
  for each row execute function public.proteger_perfil();

alter table public.perfil enable row level security;
alter table public.consentimento enable row level security;

create policy perfil_ler_proprio on public.perfil
  for select to authenticated
  using (id = (select auth.uid()) or public.eh_admin());

create policy perfil_atualizar_proprio on public.perfil
  for update to authenticated
  using (id = (select auth.uid()) or public.eh_admin())
  with check (id = (select auth.uid()) or public.eh_admin());

create policy perfil_admin_inserir on public.perfil
  for insert to authenticated
  with check (public.eh_admin());

create policy perfil_admin_excluir on public.perfil
  for delete to authenticated
  using (public.eh_admin());

create policy consentimento_ler on public.consentimento
  for select to authenticated
  using (perfil_id = (select auth.uid()) or public.eh_admin());

-- O aluno só registra consentimento próprio, pela área do aluno.
create policy consentimento_inserir_proprio on public.consentimento
  for insert to authenticated
  with check (
    (perfil_id = (select auth.uid()) and origem = 'area_aluno')
    or (public.eh_admin() and origem = 'admin')
  );
