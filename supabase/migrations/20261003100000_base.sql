-- Base: funções utilitárias usadas por todas as tabelas.
-- Convenções (PRD, seção 2): snake_case em português sem acento, PK uuid,
-- created_at em tudo, updated_at nas tabelas editáveis, RLS em todas.

create or replace function public.definir_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.definir_updated_at() is
  'Trigger before update: mantém updated_at nas tabelas editáveis.';
