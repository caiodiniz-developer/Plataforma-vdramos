import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'

/**
 * Banco de teste: Postgres real (PGlite, em memória) com o mínimo do Supabase
 * simulado — papéis, schema auth, auth.uid(), storage e a publicação do
 * Realtime — para rodar as migrations e exercitar as políticas de RLS.
 */
const SIMULACAO_SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  create function auth.role() returns text language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text,
    owner uuid
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1];
  $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on all tables in schema storage to anon, authenticated, service_role;

  create publication supabase_realtime;

  -- Mesmos privilégios padrão que o Supabase aplica ao schema public.
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`

const PASTA_MIGRATIONS = path.resolve(import.meta.dirname, '../migrations')

export function listarMigrations(): string[] {
  return readdirSync(PASTA_MIGRATIONS)
    .filter((arquivo) => arquivo.endsWith('.sql'))
    .sort()
}

export async function criarBanco(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SIMULACAO_SUPABASE)
  for (const arquivo of listarMigrations()) {
    try {
      await db.exec(readFileSync(path.join(PASTA_MIGRATIONS, arquivo), 'utf8'))
    } catch (erro) {
      throw new Error(`Migration ${arquivo} falhou: ${(erro as Error).message}`)
    }
  }
  return db
}

export type Ator = { papel: 'anon' } | { papel: 'authenticated'; id: string } | { papel: 'service_role' }

/**
 * Executa `acao` como um usuário do Supabase (papel + JWT simulado) e volta
 * para o superusuário no final, mesmo se a ação falhar.
 */
export async function como<T>(db: PGlite, ator: Ator, acao: () => Promise<T>): Promise<T> {
  const sub = ator.papel === 'authenticated' ? ator.id : ''
  await db.exec(`
    select set_config('request.jwt.claim.sub', '${sub}', false);
    select set_config('request.jwt.claim.role', '${ator.papel}', false);
    set role ${ator.papel};
  `)
  try {
    return await acao()
  } finally {
    await db.exec(`
      reset role;
      select set_config('request.jwt.claim.sub', '', false);
      select set_config('request.jwt.claim.role', '', false);
    `)
  }
}

export async function criarUsuario(
  db: PGlite,
  email: string,
  papel: 'admin' | 'aluno' = 'aluno',
  nome = email.split('@')[0],
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'insert into auth.users (email) values ($1) returning id',
    [email],
  )
  const id = rows[0].id
  await db.query('insert into public.perfil (id, papel, nome, email) values ($1, $2, $3, $4)', [
    id,
    papel,
    nome,
    email,
  ])
  return id
}

/** Mensagem do erro lançado por `acao`, ou null se não falhou. */
export async function erroDe(acao: () => Promise<unknown>): Promise<string | null> {
  try {
    await acao()
    return null
  } catch (erro) {
    return (erro as Error).message
  }
}
