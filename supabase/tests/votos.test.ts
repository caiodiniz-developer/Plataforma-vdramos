import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { aluno, como, criarBanco, criarUsuario, inscrever, montarTurma, type TurmaDeTeste } from './ambiente'

let db: PGlite
let turma: TurmaDeTeste
let ana: string
let bruno: string
let carla: string
let pergunta: string

const votos = async () =>
  (await db.query<{ votos: number }>('select votos from public.pergunta where id = $1', [pergunta])).rows[0].votos

const votar = (quem: string) =>
  como(db, aluno(quem), () => db.query('select public.alternar_voto($1)', [pergunta]))

beforeAll(async () => {
  db = await criarBanco()
  ana = await criarUsuario(db, 'ana@exemplo.com')
  bruno = await criarUsuario(db, 'bruno@exemplo.com')
  carla = await criarUsuario(db, 'carla@exemplo.com')
  turma = await montarTurma(db)
  await inscrever(db, turma.turmaId, ana, 'A100')
  await inscrever(db, turma.turmaId, bruno, 'A101')
  await inscrever(db, turma.turmaId, carla, 'A102')
  await db.query("update public.sessao_ao_vivo set status = 'aberta', aberta_em = now() where id = $1", [turma.sessaoId])

  const { rows } = await como(db, aluno(ana), () =>
    db.query<{ id: string }>("select public.enviar_pergunta($1, 'Como travar só a coluna?', 'turma', false) as id", [
      turma.sessaoId,
    ]),
  )
  pergunta = rows[0].id
})

describe('contador de votos', () => {
  it('acompanha votar e retirar o voto', async () => {
    await votar(bruno)
    await votar(carla)
    expect(await votos()).toBe(2)
    await votar(carla)
    expect(await votos()).toBe(1)
    await votar(carla)
    expect(await votos()).toBe(2)
  })

  it('o contador bate sempre com as linhas de voto', async () => {
    const { rows } = await db.query<{ contador: number; linhas: number }>(
      `select p.votos as contador, (select count(*)::int from public.pergunta_voto v where v.pergunta_id = p.id) as linhas
       from public.pergunta p where p.id = $1`,
      [pergunta],
    )
    expect(rows[0].contador).toBe(rows[0].linhas)
  })

  it('baixa quando o aluno que votou é excluído (cascata)', async () => {
    // Exclusão da conta: apaga o usuário, que leva perfil, inscrição e votos.
    await db.query('delete from auth.users where id = $1', [bruno])
    expect(await votos()).toBe(1)
  })

  it('baixa quando o ID autorizado é removido da turma', async () => {
    await db.query("delete from public.aluno_autorizado where matricula = 'A102'")
    expect(await votos()).toBe(0)
  })

  it('apagar a pergunta com votos não dá erro', async () => {
    await votar(ana)
    await db.query('delete from public.pergunta where id = $1', [pergunta])
    const { rows } = await db.query('select 1 from public.pergunta_voto')
    expect(rows).toHaveLength(0)
  })
})
