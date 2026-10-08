import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { aluno, como, criarBanco, criarUsuario, erroDe, inscrever, montarTurma, type TurmaDeTeste } from './ambiente'

let db: PGlite
let turmaA: TurmaDeTeste
let turmaB: TurmaDeTeste
let turmaC: TurmaDeTeste
let admin: string
let ana: string // turma A
let bruno: string // turma A
let carla: string // turma B

const um = async <T>(quem: string, sql: string, params: unknown[] = []) =>
  (await como(db, aluno(quem), () => db.query<T>(sql, params))).rows[0]
const linhas = async <T>(quem: string, sql: string, params: unknown[] = []) =>
  (await como(db, aluno(quem), () => db.query<T>(sql, params))).rows

async function criarQuestao(turmaId: string, titulo: string, comGabarito = true) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.atividade (turma_id, tipo, titulo, mostrar_resultado) values ($1, 'questao', $2, 'apos_responder') returning id`,
    [turmaId, titulo],
  )
  const item = await db.query<{ id: string }>(
    `insert into public.atividade_item (atividade_id, ordem, enunciado, tipo_resposta) values ($1, 1, 'Quanto é 1 + 1?', 'escolha_unica') returning id`,
    [rows[0].id],
  )
  await db.query(
    `insert into public.atividade_opcao (atividade_item_id, ordem, texto, correta) values ($1, 1, '2', $2), ($1, 2, '3', false)`,
    [item.rows[0].id, comGabarito],
  )
  return rows[0].id
}

beforeAll(async () => {
  db = await criarBanco()
  admin = await criarUsuario(db, 'professor@exemplo.com', 'admin', 'Vitor Ramos')
  ana = await criarUsuario(db, 'ana@exemplo.com', 'aluno', 'Ana Souza')
  bruno = await criarUsuario(db, 'bruno@exemplo.com', 'aluno', 'Bruno Lima')
  carla = await criarUsuario(db, 'carla@exemplo.com', 'aluno', 'Carla Dias')
  turmaA = await montarTurma(db, 'TURMA-00A')
  turmaB = await montarTurma(db, 'TURMA-00B')
  turmaC = await montarTurma(db, 'TURMA-00C')
  await inscrever(db, turmaA.turmaId, ana, 'A100')
  await inscrever(db, turmaA.turmaId, bruno, 'A101')
  await inscrever(db, turmaB.turmaId, carla, 'B100')
})

describe('aluno em mais de uma turma', () => {
  it('o professor matricula um aluno com conta em outra turma, com a mesma conta', async () => {
    const { aluno_autorizado_id: origem } = await um<{ aluno_autorizado_id: string }>(
      admin,
      `select aluno_autorizado_id from public.vw_aluno where matricula = 'A100'`,
    )
    await um(admin, 'select public.matricular_em_turma($1, $2)', [origem, turmaB.turmaId])

    const turmas = await linhas<{ turma_codigo: string; perfil_id: string }>(
      admin,
      `select turma_codigo, perfil_id from public.vw_aluno where matricula = 'A100' order by turma_codigo`,
    )
    expect(turmas.map((t) => t.turma_codigo)).toEqual(['TURMA-00A', 'TURMA-00B'])
    expect(new Set(turmas.map((t) => t.perfil_id))).toEqual(new Set([ana]))
    // A aluna passa a enxergar as duas turmas.
    expect(await linhas(ana, 'select id from public.turma')).toHaveLength(2)

    const repetido = await erroDe(() => um(admin, 'select public.matricular_em_turma($1, $2)', [origem, turmaB.turmaId]))
    expect(repetido).toMatch(/já está nesta turma/)
  })

  it('ID ainda sem conta também pode ser colocado em outra turma', async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.aluno_autorizado (turma_id, matricula, nome_referencia) values ($1, 'A200', 'Dani Reis') returning id`,
      [turmaA.turmaId],
    )
    await um(admin, 'select public.matricular_em_turma($1, $2)', [rows[0].id, turmaB.turmaId])
    const copia = await um<{ nome: string; situacao: string }>(
      admin,
      `select nome, situacao from public.vw_aluno where matricula = 'A200' and turma_id = $1`,
      [turmaB.turmaId],
    )
    expect(copia).toEqual({ nome: 'Dani Reis', situacao: 'sem_conta' })
  })

  it('só o professor matricula', async () => {
    const { aluno_autorizado_id: origem } = await um<{ aluno_autorizado_id: string }>(
      admin,
      `select aluno_autorizado_id from public.vw_aluno where matricula = 'A101'`,
    )
    expect(await erroDe(() => um(bruno, 'select public.matricular_em_turma($1, $2)', [origem, turmaB.turmaId]))).toMatch(
      /Somente o professor/,
    )
  })

  it('o aluno entra em outra turma com o ID da turma e sai dela', async () => {
    await um(bruno, `select public.entrar_na_turma(' turma-00c ')`)
    const minhas = await linhas<{ codigo: string }>(bruno, 'select codigo from public.turma order by codigo')
    expect(minhas.map((t) => t.codigo)).toEqual(['TURMA-00A', 'TURMA-00C'])
    // Leva a mesma matrícula para a turma nova.
    const naC = await um<{ matricula: string }>(admin, `select matricula from public.vw_aluno where perfil_id = $1 and turma_id = $2`, [
      bruno,
      turmaC.turmaId,
    ])
    expect(naC.matricula).toBe('A101')

    expect(await erroDe(() => um(bruno, `select public.entrar_na_turma('TURMA-00C')`))).toMatch(/já está nesta turma/)
    expect(await erroDe(() => um(bruno, `select public.entrar_na_turma('NAO-EXISTE')`))).toMatch(/Não encontramos uma turma ativa/)

    await um(bruno, 'select public.sair_da_turma($1)', [turmaC.turmaId])
    expect(await linhas(bruno, 'select id from public.turma')).toHaveLength(1)
    // Da última turma não dá para sair.
    expect(await erroDe(() => um(bruno, 'select public.sair_da_turma($1)', [turmaA.turmaId]))).toMatch(/ao menos uma turma/)
  })

  it('turma encerrada e ID já usado por outra pessoa são recusados', async () => {
    await db.query(`update public.turma set status = 'encerrada' where id = $1`, [turmaC.turmaId])
    expect(await erroDe(() => um(carla, `select public.entrar_na_turma('TURMA-00C')`))).toMatch(/Não encontramos uma turma ativa/)
    await db.query(`update public.turma set status = 'ativa' where id = $1`, [turmaC.turmaId])

    // Outra pessoa já usa a matrícula B100 na turma C.
    const outra = await criarUsuario(db, 'eva@exemplo.com', 'aluno', 'Eva Pires')
    await inscrever(db, turmaC.turmaId, outra, 'B100')
    expect(await erroDe(() => um(carla, `select public.entrar_na_turma('TURMA-00C')`))).toMatch(/já está em uso nesta turma/)
  })

  it('aluno bloqueado não entra em turma nova', async () => {
    await db.query(`update public.aluno_autorizado set ativo = false where matricula = 'B100' and turma_id = $1`, [turmaB.turmaId])
    expect(await erroDe(() => um(carla, `select public.entrar_na_turma('TURMA-00A')`))).toMatch(/não tem acesso/)
    await db.query(`update public.aluno_autorizado set ativo = true where matricula = 'B100' and turma_id = $1`, [turmaB.turmaId])
  })
})

describe('liberar e ocultar questões', () => {
  it('a questão nasce oculta e o aluno só vê depois de liberada', async () => {
    const id = await criarQuestao(turmaA.turmaId, 'Soma simples')
    expect(await linhas(bruno, 'select id from public.atividade where id = $1', [id])).toHaveLength(0)

    const resultado = await um<{ r: { alteradas: number; puladas: unknown[] } }>(
      admin,
      'select public.definir_visibilidade($1, true) as r',
      [[id]],
    )
    expect(resultado.r).toEqual({ alteradas: 1, puladas: [] })
    expect(await linhas(bruno, 'select id from public.atividade where id = $1', [id])).toHaveLength(1)

    await um(admin, 'select public.definir_visibilidade($1, false)', [[id]])
    expect(await linhas(bruno, 'select id from public.atividade where id = $1', [id])).toHaveLength(0)
  })

  it('avisa a turma só na primeira liberação', async () => {
    const id = await criarQuestao(turmaA.turmaId, 'Notifica uma vez')
    const avisos = () => linhas(bruno, `select id from public.notificacao where titulo = 'Nova questão: Notifica uma vez'`)
    await um(admin, 'select public.definir_visibilidade($1, true)', [[id]])
    await um(admin, 'select public.definir_visibilidade($1, false)', [[id]])
    await um(admin, 'select public.definir_visibilidade($1, true)', [[id]])
    expect(await avisos()).toHaveLength(1)
  })

  it('em lote, a que não tem gabarito fica oculta e volta com o motivo', async () => {
    const boa = await criarQuestao(turmaA.turmaId, 'Com gabarito')
    const ruim = await criarQuestao(turmaA.turmaId, 'Sem gabarito', false)
    const { r } = await um<{ r: { alteradas: number; puladas: { titulo: string; motivo: string }[] } }>(
      admin,
      'select public.definir_visibilidade($1, true) as r',
      [[boa, ruim]],
    )
    expect(r.alteradas).toBe(1)
    expect(r.puladas).toEqual([{ titulo: 'Sem gabarito', motivo: 'Item 1: marque a opção correta.' }])
    const status = await linhas<{ titulo: string; status: string }>(
      admin,
      'select titulo, status from public.atividade where id = any($1) order by titulo',
      [[boa, ruim]],
    )
    expect(status).toEqual([
      { titulo: 'Com gabarito', status: 'publicada' },
      { titulo: 'Sem gabarito', status: 'rascunho' },
    ])
  })

  it('aluno não libera nem oculta', async () => {
    const id = await criarQuestao(turmaA.turmaId, 'Protegida')
    expect(await erroDe(() => um(bruno, 'select public.definir_visibilidade($1, true)', [[id]]))).toMatch(/Somente o professor/)
  })
})

describe('entrega de arquivos', () => {
  let atividade: string
  const pasta = (quem: string, nome = 'trabalho.zip') => `entregas/${quem}/${nome}`
  const entregar = (quem: string, caminho: string, tamanho = 1024) =>
    um(quem, 'select public.registrar_entrega($1, $2, $3, $4)', [atividade, caminho, 'trabalho.zip', tamanho])

  beforeAll(async () => {
    atividade = await criarQuestao(turmaA.turmaId, 'Entrega do projeto')
    await db.query(`update public.atividade set tipo = 'licao', aceita_arquivo = true where id = $1`, [atividade])
    await um(admin, 'select public.definir_visibilidade($1, true)', [[atividade]])
  })

  it('o aluno da turma registra a entrega e só ele e o professor veem', async () => {
    await entregar(bruno, pasta(bruno))
    expect(await linhas(bruno, 'select id from public.atividade_entrega')).toHaveLength(1)
    expect(await linhas(admin, 'select id from public.atividade_entrega')).toHaveLength(1)
    // Ana é da mesma turma, mas não vê o arquivo do colega.
    expect(await linhas(ana, 'select id from public.atividade_entrega')).toHaveLength(0)
  })

  it('recusa arquivo fora da pasta do aluno, de outra turma e acima do limite', async () => {
    expect(await erroDe(() => entregar(bruno, pasta(ana)))).toMatch(/fora da sua pasta/)
    expect(await erroDe(() => entregar(carla, pasta(carla)))).toMatch(/não tem acesso/)
    expect(await erroDe(() => entregar(bruno, pasta(bruno, 'grande.zip'), 30 * 1024 * 1024))).toMatch(/atividade_entrega_tamanho_bytes_check/)
  })

  it('não aceita entrega em atividade que não recebe arquivo, encerrada ou fora do prazo', async () => {
    await db.query('update public.atividade set aceita_arquivo = false where id = $1', [atividade])
    expect(await erroDe(() => entregar(bruno, pasta(bruno, 'b.zip')))).toMatch(/não recebe arquivos/)
    await db.query(`update public.atividade set aceita_arquivo = true, prazo_em = now() - interval '1 hour' where id = $1`, [atividade])
    expect(await erroDe(() => entregar(bruno, pasta(bruno, 'c.zip')))).toMatch(/prazo desta atividade já terminou/)
    await db.query(`update public.atividade set prazo_em = null, status = 'encerrada' where id = $1`, [atividade])
    expect(await erroDe(() => entregar(bruno, pasta(bruno, 'd.zip')))).toMatch(/não está aberta/)
    await db.query(`update public.atividade set status = 'publicada' where id = $1`, [atividade])
  })

  it('limita a 5 arquivos por atividade', async () => {
    for (const n of [2, 3, 4, 5]) await entregar(bruno, pasta(bruno, `parte-${n}.zip`))
    expect(await erroDe(() => entregar(bruno, pasta(bruno, 'parte-6.zip')))).toMatch(/limite é de 5 arquivos/)
  })

  it('aluno não grava direto na tabela nem lê o registro de e-mails', async () => {
    const direto = await erroDe(() =>
      um(bruno, `insert into public.atividade_entrega (atividade_id, inscricao_id, arquivo_path, nome_arquivo, tamanho_bytes)
                 select $1, public.minha_inscricao($2), $3, 'x.zip', 10`, [atividade, turmaA.turmaId, pasta(bruno, 'direto.zip')]),
    )
    expect(direto).toMatch(/row-level security/)
    expect(await linhas(bruno, 'select * from public.atividade_email')).toHaveLength(0)
    expect(await linhas(admin, 'select * from public.atividade_email')).toHaveLength(0)
  })
})

describe('aviso em lote e e-mail de contato', () => {
  it('um aviso para duas turmas compartilha o lote e cada aluno vê o da sua', async () => {
    await como(db, aluno(admin), () =>
      db.query(
        `with lote as (select gen_random_uuid() as id)
         insert into public.aviso (turma_id, titulo, texto, lote_id)
         select t, 'Prova na sexta', 'Tragam o notebook.', lote.id from lote, unnest($1::uuid[]) as t`,
        [[turmaA.turmaId, turmaB.turmaId]],
      ),
    )
    const doProfessor = await linhas<{ lote_id: string }>(admin, `select lote_id from public.aviso where titulo = 'Prova na sexta'`)
    expect(doProfessor).toHaveLength(2)
    expect(new Set(doProfessor.map((a) => a.lote_id)).size).toBe(1)
    expect(await linhas(bruno, `select id from public.aviso where titulo = 'Prova na sexta'`)).toHaveLength(1)
    expect(await linhas(carla, `select id from public.aviso where titulo = 'Prova na sexta'`)).toHaveLength(1)
  })

  it('o aluno grava o próprio e-mail de contato; formato inválido é recusado', async () => {
    await um(carla, `update public.perfil set email_contato = 'carla@empresa.com' where id = $1 returning id`, [carla])
    expect(await erroDe(() => um(carla, `update public.perfil set email_contato = 'sem-arroba' where id = $1`, [carla]))).toMatch(
      /perfil_email_contato_check/,
    )
    // Não mexe no e-mail de outra pessoa.
    await como(db, aluno(carla), () => db.query(`update public.perfil set email_contato = 'x@y.com' where id = $1`, [bruno]))
    expect((await um<{ email_contato: string | null }>(admin, 'select email_contato from public.perfil where id = $1', [bruno])).email_contato).toBeNull()
  })

  it('a lista de envio só traz quem consentiu e informou e-mail', async () => {
    const lista = () => linhas<{ email: string }>(admin, 'select distinct email from public.vw_emails_comunicacao order by email')
    expect(await lista()).toEqual([])

    const consentir = (quem: string, concedido: boolean) =>
      como(db, aluno(quem), () =>
        db.query(
          `insert into public.consentimento (perfil_id, finalidade, concedido, versao_termo, origem) values ($1, 'comunicacao_professor', $2, '2026-10-v1', 'area_aluno')`,
          [quem, concedido],
        ),
      )
    await consentir(carla, true)
    await consentir(bruno, true) // consentiu, mas não informou e-mail
    expect(await lista()).toEqual([{ email: 'carla@empresa.com' }])

    const painel = await um<{ email_contato: string; aceita_comunicacao: boolean }>(
      admin,
      'select email_contato, aceita_comunicacao from public.vw_aluno where perfil_id = $1 and turma_id = $2',
      [carla, turmaB.turmaId],
    )
    expect(painel).toEqual({ email_contato: 'carla@empresa.com', aceita_comunicacao: true })
  })
})
