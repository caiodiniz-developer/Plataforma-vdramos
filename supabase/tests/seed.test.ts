import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { criarBanco } from './ambiente'

let db: PGlite

beforeAll(async () => {
  db = await criarBanco()
  await db.exec(readFileSync(path.resolve(import.meta.dirname, '../seed.sql'), 'utf8'))
})

describe('seed de exemplo', () => {
  it('cria a turma de referência do PRD, ativa e com 5 encontros', async () => {
    const { rows } = await db.query<{ codigo: string; status: string; encontros: number; vagas: number }>(
      `select t.codigo, t.status, t.vagas, (select count(*)::int from public.encontro e where e.turma_id = t.id) as encontros
       from public.turma t`,
    )
    expect(rows).toEqual([{ codigo: 'EXCIA-CPS-2610', status: 'ativa', vagas: 20, encontros: 5 }])
  })

  it('os blocos de cada encontro somam exatamente as 4 horas do encontro', async () => {
    const { rows } = await db.query<{ total: number }>(
      `select sum(b.duracao_min)::int as total from public.bloco_encontro b group by b.encontro_id`,
    )
    expect(rows.map((r) => r.total)).toEqual([240, 240, 240, 240, 240])
  })

  it('cada encontro tem a sua sessão agendada e as atividades nascem em rascunho', async () => {
    const sessoes = await db.query<{ n: number }>("select count(*)::int as n from public.sessao_ao_vivo where status = 'agendada'")
    const atividades = await db.query<{ status: string }>('select distinct status from public.atividade')
    expect(sessoes.rows[0].n).toBe(5)
    expect(atividades.rows).toEqual([{ status: 'rascunho' }])
  })

  it('o quiz de exemplo já passa nas regras de publicação', async () => {
    const { rows } = await db.query<{ problemas: string[] }>(
      "select public.problemas_da_atividade(id) as problemas from public.atividade where tipo = 'quiz'",
    )
    expect(rows[0].problemas).toEqual([])
  })

  it('autoriza a matrícula do aluno de exemplo e preenche o perfil público', async () => {
    const ids = await db.query<{ matricula: string }>('select matricula from public.aluno_autorizado order by matricula')
    const perfil = await db.query<{ nome_exibicao: string }>('select nome_exibicao from public.perfil_publico')
    expect(ids.rows.map((r) => r.matricula)).toEqual(['ALUNO-0001', 'ALUNO-0002', 'ALUNO-0003'])
    expect(perfil.rows).toEqual([{ nome_exibicao: 'Vitor Ramos' }])
  })
})
