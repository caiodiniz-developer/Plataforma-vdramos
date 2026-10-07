import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { aluno, como, criarBanco, criarUsuario, erroDe, inscrever, montarTurma, type TurmaDeTeste } from './ambiente'

let db: PGlite
let turmaA: TurmaDeTeste
let turmaB: TurmaDeTeste
let ana: string // inscrita só na turma A
let bruno: string // inscrito só na turma B

/** Quantas linhas de cada tabela o ator enxerga. */
async function contagens(ator: Parameters<typeof como>[1], tabelas: string[]) {
  const resultado: Record<string, number> = {}
  for (const tabela of tabelas) {
    const { rows } = await como(db, ator, () => db.query<{ n: number }>(`select count(*)::int as n from public.${tabela}`))
    resultado[tabela] = rows[0].n
  }
  return resultado
}

beforeAll(async () => {
  db = await criarBanco()
  ana = await criarUsuario(db, 'ana@exemplo.com')
  bruno = await criarUsuario(db, 'bruno@exemplo.com')
  turmaA = await montarTurma(db, 'TURMA-A-2610')
  turmaB = await montarTurma(db, 'TURMA-B-2610')
  await inscrever(db, turmaA.turmaId, ana, 'A100')
  await inscrever(db, turmaB.turmaId, bruno, 'B100')

  for (const t of [turmaA, turmaB]) {
    await db.query(
      `insert into public.capacidade (curso_id, codigo, tipo, descricao) values ($1, 'CT1', 'tecnica', 'Estruturar dados')`,
      [t.cursoId],
    )
    await db.query(
      `insert into public.material (turma_id, titulo, tipo, url) values ($1, 'Apostila', 'link', 'https://exemplo.com/a')`,
      [t.turmaId],
    )
    await db.query(
      `insert into public.atividade (turma_id, tipo, titulo, status) values ($1, 'enquete', 'Enquete', 'publicada')`,
      [t.turmaId],
    )
  }
  await db.query(
    `insert into public.perfil_publico (nome_exibicao, titulo, bio, email_contato, linkedin_url)
     values ('Vitor Ramos', 'Dados · IA · Educação', 'Bio', 'contato@exemplo.com', 'https://www.linkedin.com/')`,
  )
  await db.query(
    `insert into public.experiencia (tipo, organizacao, cargo, data_inicio, publicado) values
       ('profissional', 'Org publicada', 'Cargo', '2022-01-01', true),
       ('docencia', 'Org em rascunho', 'Cargo', '2023-01-01', false)`,
  )
  await db.query(
    `insert into public.contato_mensagem (nome, email, assunto, mensagem)
     values ('Visitante', 'v@exemplo.com', 'palestra', 'Mensagem de teste com tamanho suficiente.')`,
  )
})

const TABELAS_DA_TURMA = [
  'turma',
  'curso',
  'capacidade',
  'encontro',
  'bloco_encontro',
  'material',
  'sessao_ao_vivo',
  'atividade',
  'inscricao',
]

describe('isolamento entre turmas', () => {
  it('a aluna enxerga exatamente uma turma, com tudo o que a tela dela consulta', async () => {
    expect(await contagens(aluno(ana), TABELAS_DA_TURMA)).toEqual({
      turma: 1,
      curso: 1,
      capacidade: 1,
      encontro: 1,
      bloco_encontro: 1,
      material: 1,
      sessao_ao_vivo: 1,
      atividade: 1,
      inscricao: 1,
    })
  })

  it('o que ela enxerga é da turma dela, não da outra', async () => {
    const { rows } = await como(db, aluno(ana), () =>
      db.query<{ codigo: string }>('select codigo from public.turma'),
    )
    expect(rows).toEqual([{ codigo: 'TURMA-A-2610' }])

    const encontros = await como(db, aluno(ana), () =>
      db.query<{ turma_id: string }>('select turma_id from public.encontro'),
    )
    expect(encontros.rows).toEqual([{ turma_id: turmaA.turmaId }])

    const outro = await como(db, aluno(bruno), () => db.query<{ codigo: string }>('select codigo from public.turma'))
    expect(outro.rows).toEqual([{ codigo: 'TURMA-B-2610' }])
  })

  it('não consegue agir na sala de outra turma', async () => {
    await db.query("update public.sessao_ao_vivo set status = 'aberta', aberta_em = now()")
    const erro = await erroDe(() =>
      como(db, aluno(ana), () =>
        db.query("select public.enviar_pergunta($1, 'Entrei na turma errada?', 'turma', false)", [turmaB.sessaoId]),
      ),
    )
    expect(erro).toMatch(/não está inscrito/)
  })

  it('não altera calendário, materiais, turma nem atividades', async () => {
    const tentativas = [
      "update public.turma set status = 'encerrada'",
      "update public.encontro set titulo = 'Invadido'",
      'delete from public.bloco_encontro',
      "update public.material set titulo = 'Invadido'",
      "update public.atividade set status = 'encerrada'",
      "update public.sessao_ao_vivo set status = 'encerrada'",
      "update public.curso set nome = 'Invadido'",
    ]
    for (const sql of tentativas) {
      const r = await como(db, aluno(ana), () => db.query(sql))
      expect(r.affectedRows, sql).toBe(0)
    }

    const inserir = await erroDe(() =>
      como(db, aluno(ana), () =>
        db.query(
          `insert into public.material (turma_id, titulo, tipo, url) values ($1, 'Meu material', 'link', 'https://exemplo.com')`,
          [turmaA.turmaId],
        ),
      ),
    )
    expect(inserir).toMatch(/row-level security/)
  })

  it('não se inscreve sozinha em outra turma', async () => {
    const erro = await erroDe(() =>
      como(db, aluno(ana), () =>
        db.query(
          `insert into public.aluno_autorizado (turma_id, matricula) values ($1, 'A100')`,
          [turmaB.turmaId],
        ),
      ),
    )
    expect(erro).toMatch(/row-level security/)
  })
})

describe('visitante sem login', () => {
  it('lê só o perfil público e as experiências publicadas', async () => {
    expect(await contagens({ papel: 'anon' }, ['perfil_publico', 'experiencia', ...TABELAS_DA_TURMA])).toEqual({
      perfil_publico: 1,
      experiencia: 1,
      turma: 0,
      curso: 0,
      capacidade: 0,
      encontro: 0,
      bloco_encontro: 0,
      material: 0,
      sessao_ao_vivo: 0,
      atividade: 0,
      inscricao: 0,
    })
  })

  it('não lê as mensagens de contato (insert only)', async () => {
    expect(await contagens({ papel: 'anon' }, ['contato_mensagem'])).toEqual({ contato_mensagem: 0 })
    expect(await contagens(aluno(ana), ['contato_mensagem'])).toEqual({ contato_mensagem: 0 })
  })

  it('não altera a landing', async () => {
    const perfil = await como(db, { papel: 'anon' }, () => db.query("update public.perfil_publico set bio = 'Invadido'"))
    const experiencia = await como(db, { papel: 'anon' }, () => db.query('delete from public.experiencia'))
    expect(perfil.affectedRows).toBe(0)
    expect(experiencia.affectedRows).toBe(0)
  })

  it('não chama as funções da sala nem as do professor', async () => {
    const chamadas = [
      `select public.enviar_pergunta('${turmaA.sessaoId}', 'Pergunta anônima de fora', 'turma', false)`,
      `select public.enviar_mensagem('${turmaA.sessaoId}', 'oi')`,
      `select public.abrir_sessao('${turmaA.sessaoId}')`,
      `select public.duplicar_turma('${turmaA.turmaId}', 'COPIA-0001', current_date)`,
      `select public.aplicar_retencao()`,
    ]
    for (const sql of chamadas) {
      const erro = await erroDe(() => como(db, { papel: 'anon' }, () => db.query(sql)))
      expect(erro, sql).toMatch(/permission denied/)
    }
  })
})

describe('perfil público', () => {
  it('aceita só uma linha', async () => {
    const erro = await erroDe(() =>
      db.query(
        `insert into public.perfil_publico (nome_exibicao, titulo, bio, email_contato, linkedin_url)
         values ('Outro', 'Título', 'Bio', 'x@exemplo.com', 'https://exemplo.com')`,
      ),
    )
    expect(erro).toMatch(/duplicate key/)
  })
})
