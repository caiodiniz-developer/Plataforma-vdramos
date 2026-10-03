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

export type TurmaDeTeste = {
  cursoId: string
  turmaId: string
  encontroId: string
  sessaoId: string
  blocoId: string
}

/**
 * Curso + turma ativa com um encontro hoje (no fuso da turma) e um bloco de
 * teoria que cobre o dia inteiro, para os testes não dependerem do relógio.
 */
export async function montarTurma(db: PGlite, codigo = 'TESTE-CPS-2610'): Promise<TurmaDeTeste> {
  const curso = await db.query<{ id: string }>(
    `insert into public.curso (nome, carga_horaria_h, objetivo, ementa_md)
     values ('Excel Básico com IA Generativa', 20, 'Objetivo', '# Ementa') returning id`,
  )
  const cursoId = curso.rows[0].id
  const turma = await db.query<{ id: string }>(
    `insert into public.turma (curso_id, codigo, instituicao, cidade, modalidade, data_inicio, data_fim, vagas, status)
     values ($1, $2, 'SENAI', 'Campinas', 'presencial', current_date, current_date + 14, 20, 'ativa') returning id`,
    [cursoId, codigo],
  )
  const turmaId = turma.rows[0].id
  const encontro = await db.query<{ id: string }>(
    `insert into public.encontro (turma_id, numero, data, hora_inicio, hora_fim, titulo)
     values ($1, 1, (now() at time zone 'America/Sao_Paulo')::date, '00:00', '23:59', 'SA1') returning id`,
    [turmaId],
  )
  const encontroId = encontro.rows[0].id
  const bloco = await db.query<{ id: string }>(
    `insert into public.bloco_encontro (encontro_id, ordem, hora_inicio, duracao_min, tipo, titulo)
     values ($1, 1, '00:00', 1439, 'teoria', 'Teoria do dia') returning id`,
    [encontroId],
  )
  const sessao = await db.query<{ id: string }>(
    'select id from public.sessao_ao_vivo where encontro_id = $1',
    [encontroId],
  )
  return { cursoId, turmaId, encontroId, sessaoId: sessao.rows[0].id, blocoId: bloco.rows[0].id }
}

/** Autoriza a matrícula e inscreve o perfil na turma. Retorna o id da inscrição. */
export async function inscrever(
  db: PGlite,
  turmaId: string,
  perfilId: string,
  matricula: string,
): Promise<string> {
  const autorizado = await db.query<{ id: string }>(
    'insert into public.aluno_autorizado (turma_id, matricula) values ($1, $2) returning id',
    [turmaId, matricula],
  )
  const inscricao = await db.query<{ id: string }>(
    `insert into public.inscricao (aluno_autorizado_id, turma_id, perfil_id)
     values ($1, $2, $3) returning id`,
    [autorizado.rows[0].id, turmaId, perfilId],
  )
  return inscricao.rows[0].id
}

export const aluno = (id: string): Ator => ({ papel: 'authenticated', id })
