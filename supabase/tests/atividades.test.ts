import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { aluno, como, criarBanco, criarUsuario, erroDe, inscrever, montarTurma, type TurmaDeTeste } from './ambiente'

let db: PGlite
let turma: TurmaDeTeste
let admin: string
let ana: string
let bruno: string
let carla: string // não inscrita

type Quiz = { id: string; item: string; certa: string; errada: string }

async function criarQuiz(opcoes: { tempoLimite?: number; mostrar?: string; semCorreta?: boolean } = {}): Promise<Quiz> {
  const atividade = await db.query<{ id: string }>(
    `insert into public.atividade (turma_id, tipo, titulo, mostrar_resultado, tempo_limite_s)
     values ($1, 'quiz', 'Quiz — referências', $2, $3) returning id`,
    [turma.turmaId, opcoes.mostrar ?? 'apos_encerrar', opcoes.tempoLimite ?? null],
  )
  const id = atividade.rows[0].id
  const item = await db.query<{ id: string }>(
    `insert into public.atividade_item (atividade_id, ordem, enunciado, tipo_resposta, explicacao)
     values ($1, 1, 'Qual símbolo fixa uma referência?', 'escolha_unica', 'O cifrão trava linha ou coluna.')
     returning id`,
    [id],
  )
  const certa = await db.query<{ id: string }>(
    `insert into public.atividade_opcao (atividade_item_id, ordem, texto, correta)
     values ($1, 1, '$', $2) returning id`,
    [item.rows[0].id, !opcoes.semCorreta],
  )
  const errada = await db.query<{ id: string }>(
    `insert into public.atividade_opcao (atividade_item_id, ordem, texto, correta)
     values ($1, 2, '#', false) returning id`,
    [item.rows[0].id],
  )
  return { id, item: item.rows[0].id, certa: certa.rows[0].id, errada: errada.rows[0].id }
}

const publicar = (id: string) =>
  como(db, aluno(admin), () => db.query('select public.publicar_atividade($1)', [id]))

const responder = (quem: string, atividadeId: string, respostas: unknown[]) =>
  como(db, aluno(quem), () =>
    db.query('select public.responder_atividade($1, $2::jsonb)', [atividadeId, JSON.stringify(respostas)]),
  )

type VisaoAluno = {
  respondida: boolean
  mostra_resultado: boolean
  itens: {
    explicacao: string | null
    minha_resposta: { correta: boolean | null } | null
    resultado: { respostas: number } | null
    opcoes: { id: string; texto: string; correta?: boolean; total?: number }[]
  }[]
}

const verComoAluno = (quem: string, atividadeId: string) =>
  como(db, aluno(quem), async () => {
    const { rows } = await db.query<{ v: VisaoAluno }>('select public.atividade_para_aluno($1) as v', [
      atividadeId,
    ])
    return rows[0].v
  })

beforeAll(async () => {
  db = await criarBanco()
  admin = await criarUsuario(db, 'professor@exemplo.com', 'admin')
  ana = await criarUsuario(db, 'ana@exemplo.com')
  bruno = await criarUsuario(db, 'bruno@exemplo.com')
  carla = await criarUsuario(db, 'carla@exemplo.com')
  turma = await montarTurma(db)
  await inscrever(db, turma.turmaId, ana, 'A100')
  await inscrever(db, turma.turmaId, bruno, 'A101')
})

describe('publicação', () => {
  it('bloqueia quiz sem opção correta', async () => {
    const quiz = await criarQuiz({ semCorreta: true })
    expect(await erroDe(() => publicar(quiz.id))).toMatch(/marque a opção correta/)
  })

  it('bloqueia atividade sem itens e item de escolha com menos de duas opções', async () => {
    const vazia = await db.query<{ id: string }>(
      "insert into public.atividade (turma_id, tipo, titulo) values ($1, 'enquete', 'Enquete vazia') returning id",
      [turma.turmaId],
    )
    expect(await erroDe(() => publicar(vazia.rows[0].id))).toMatch(/ao menos um item/)

    await db.query(
      `insert into public.atividade_item (atividade_id, ordem, enunciado, tipo_resposta)
       values ($1, 1, 'Prefere manhã ou noite?', 'escolha_unica')`,
      [vazia.rows[0].id],
    )
    expect(await erroDe(() => publicar(vazia.rows[0].id))).toMatch(/ao menos duas opções/)
  })

  it('pesquisa de satisfação exige alvo', async () => {
    const erro = await erroDe(() =>
      db.query(
        "insert into public.atividade (turma_id, tipo, titulo) values ($1, 'pesquisa_satisfacao', 'Sem alvo')",
        [turma.turmaId],
      ),
    )
    expect(erro).toMatch(/atividade_pesquisa_tem_alvo/)
  })

  it('aluno não publica', async () => {
    const quiz = await criarQuiz()
    const erro = await erroDe(() =>
      como(db, aluno(ana), () => db.query('select public.publicar_atividade($1)', [quiz.id])),
    )
    expect(erro).toMatch(/Somente o professor/)
  })

  it('rascunho é invisível para o aluno', async () => {
    const quiz = await criarQuiz()
    const lista = await como(db, aluno(ana), () =>
      db.query<{ id: string }>('select id from public.atividade where id = $1', [quiz.id]),
    )
    expect(lista.rows).toHaveLength(0)
    expect(await erroDe(() => verComoAluno(ana, quiz.id))).toMatch(/não encontrada/)
  })
})

describe('gabarito protegido', () => {
  let quiz: Quiz

  beforeAll(async () => {
    quiz = await criarQuiz()
    await publicar(quiz.id)
  })

  it('aluno não lê itens nem opções direto nas tabelas', async () => {
    const itens = await como(db, aluno(ana), () => db.query('select * from public.atividade_item'))
    const opcoes = await como(db, aluno(ana), () => db.query('select * from public.atividade_opcao'))
    expect(itens.rows).toHaveLength(0)
    expect(opcoes.rows).toHaveLength(0)
  })

  it('antes de responder, a visão do aluno não traz correta nem explicação', async () => {
    const visao = await verComoAluno(ana, quiz.id)
    expect(visao.respondida).toBe(false)
    expect(visao.itens[0].explicacao).toBeNull()
    expect(visao.itens[0].opcoes.map((o) => Object.keys(o).sort())).toEqual([
      ['id', 'ordem', 'texto'],
      ['id', 'ordem', 'texto'],
    ])
  })

  it('depois de responder, mostra acerto e explicação só para quem respondeu', async () => {
    await responder(ana, quiz.id, [{ item_id: quiz.item, opcao_ids: [quiz.certa] }])
    const deAna = await verComoAluno(ana, quiz.id)
    expect(deAna.respondida).toBe(true)
    expect(deAna.itens[0].minha_resposta?.correta).toBe(true)
    expect(deAna.itens[0].explicacao).toBe('O cifrão trava linha ou coluna.')
    expect(deAna.itens[0].opcoes.find((o) => o.id === quiz.certa)?.correta).toBe(true)

    const deBruno = await verComoAluno(bruno, quiz.id)
    expect(deBruno.itens[0].explicacao).toBeNull()
    expect(deBruno.itens[0].opcoes[0].correta).toBeUndefined()
  })

  it('resposta errada é marcada como incorreta no servidor', async () => {
    await responder(bruno, quiz.id, [{ item_id: quiz.item, opcao_ids: [quiz.errada] }])
    const { rows } = await db.query<{ correta: boolean }>(
      'select correta from public.atividade_resposta order by created_at',
    )
    expect(rows.map((r) => r.correta)).toEqual([true, false])
  })

  it('não aceita responder duas vezes', async () => {
    const erro = await erroDe(() => responder(ana, quiz.id, [{ item_id: quiz.item, opcao_ids: [quiz.errada] }]))
    expect(erro).toMatch(/já respondeu/)
  })

  it('aluno lê só as próprias respostas e não grava direto na tabela', async () => {
    const { rows } = await como(db, aluno(ana), () => db.query('select id from public.atividade_resposta'))
    expect(rows).toHaveLength(1)

    const erro = await erroDe(() =>
      como(db, aluno(ana), () =>
        db.query(
          `insert into public.atividade_resposta (atividade_item_id, inscricao_id, correta)
           select $1, id, true from public.inscricao limit 1`,
          [quiz.item],
        ),
      ),
    )
    expect(erro).toMatch(/row-level security/)
  })

  it('resultado agregado só aparece depois de encerrar (apos_encerrar)', async () => {
    expect((await verComoAluno(ana, quiz.id)).mostra_resultado).toBe(false)
    await como(db, aluno(admin), () => db.query('select public.encerrar_atividade($1)', [quiz.id]))
    const visao = await verComoAluno(ana, quiz.id)
    expect(visao.mostra_resultado).toBe(true)
    expect(visao.itens[0].resultado?.respostas).toBe(2)
    expect(visao.itens[0].opcoes.map((o) => o.total)).toEqual([1, 1])
  })

  it('itens e opções ficam travados depois das respostas', async () => {
    const editar = await erroDe(() =>
      db.query("update public.atividade_opcao set texto = 'outro' where id = $1", [quiz.certa]),
    )
    const incluir = await erroDe(() =>
      db.query(
        "insert into public.atividade_item (atividade_id, ordem, enunciado, tipo_resposta) values ($1, 2, 'Novo', 'texto_livre')",
        [quiz.id],
      ),
    )
    expect(editar).toMatch(/já tem respostas/)
    expect(incluir).toMatch(/já tem respostas/)
    // O título continua editável e a atividade inteira ainda pode ser apagada.
    await db.query("update public.atividade set titulo = 'Quiz revisado' where id = $1", [quiz.id])
    await db.query('delete from public.atividade where id = $1', [quiz.id])
  })
})

describe('validação das respostas', () => {
  it('rejeita depois do tempo limite', async () => {
    const quiz = await criarQuiz({ tempoLimite: 30 })
    await publicar(quiz.id)
    await db.query("update public.atividade set publicada_em = now() - interval '1 minute' where id = $1", [
      quiz.id,
    ])
    const erro = await erroDe(() => responder(ana, quiz.id, [{ item_id: quiz.item, opcao_ids: [quiz.certa] }]))
    expect(erro).toMatch(/Tempo encerrado/)
  })

  it('rejeita atividade encerrada, item obrigatório vazio e opção de outro item', async () => {
    const quiz = await criarQuiz()
    const outro = await criarQuiz()
    await publicar(quiz.id)

    expect(await erroDe(() => responder(ana, quiz.id, []))).toMatch(/resposta obrigatória/)
    expect(await erroDe(() => responder(ana, quiz.id, [{ item_id: quiz.item, opcao_ids: [outro.certa] }]))).toMatch(
      /opção inválida/,
    )
    expect(
      await erroDe(() => responder(ana, quiz.id, [{ item_id: quiz.item, opcao_ids: [quiz.certa, quiz.errada] }])),
    ).toMatch(/única opção/)

    await como(db, aluno(admin), () => db.query('select public.encerrar_atividade($1)', [quiz.id]))
    expect(await erroDe(() => responder(ana, quiz.id, [{ item_id: quiz.item, opcao_ids: [quiz.certa] }]))).toMatch(
      /Tempo encerrado/,
    )
  })

  it('quem não é da turma não responde nem vê', async () => {
    const quiz = await criarQuiz()
    await publicar(quiz.id)
    expect(await erroDe(() => responder(carla, quiz.id, [{ item_id: quiz.item, opcao_ids: [quiz.certa] }]))).toMatch(
      /não está inscrito/,
    )
    expect(await erroDe(() => verComoAluno(carla, quiz.id))).toMatch(/não está inscrito/)
  })

  it('pesquisa valida a faixa da escala e aceita texto livre opcional em branco', async () => {
    const pesquisa = await db.query<{ id: string }>(
      `insert into public.atividade (turma_id, tipo, titulo, alvo, anonima, mostrar_resultado)
       values ($1, 'pesquisa_satisfacao', 'Satisfação — teoria', 'teoria', true, 'apos_responder') returning id`,
      [turma.turmaId],
    )
    const id = pesquisa.rows[0].id
    const escala = await db.query<{ id: string }>(
      `insert into public.atividade_item (atividade_id, ordem, enunciado, tipo_resposta)
       values ($1, 1, 'Clareza', 'escala_1_5') returning id`,
      [id],
    )
    const livre = await db.query<{ id: string }>(
      `insert into public.atividade_item (atividade_id, ordem, enunciado, tipo_resposta, obrigatorio)
       values ($1, 2, 'O que melhorar?', 'texto_livre', false) returning id`,
      [id],
    )
    await publicar(id)

    expect(await erroDe(() => responder(ana, id, [{ item_id: escala.rows[0].id, valor: 6 }]))).toMatch(/1 a 5/)
    await responder(ana, id, [
      { item_id: escala.rows[0].id, valor: 4 },
      { item_id: livre.rows[0].id, texto: '   ' },
    ])
    const { rows } = await db.query<{ valor: number }>(
      `select r.valor from public.atividade_resposta r
       join public.atividade_item i on i.id = r.atividade_item_id where i.atividade_id = $1`,
      [id],
    )
    expect(rows).toEqual([{ valor: 4 }])

    // apos_responder: Ana já vê o agregado; Bruno ainda não.
    expect((await verComoAluno(ana, id)).mostra_resultado).toBe(true)
    expect((await verComoAluno(bruno, id)).mostra_resultado).toBe(false)
  })
})

describe('sessão ao vivo', () => {
  it('atividade ligada à sessão só publica com a sessão aberta e encerra junto com ela', async () => {
    const quiz = await criarQuiz()
    await db.query('update public.atividade set sessao_ao_vivo_id = $1 where id = $2', [turma.sessaoId, quiz.id])

    expect(await erroDe(() => publicar(quiz.id))).toMatch(/Abra a sessão/)

    await como(db, aluno(admin), () => db.query('select public.abrir_sessao($1)', [turma.sessaoId]))
    await publicar(quiz.id)
    await responder(ana, quiz.id, [{ item_id: quiz.item, opcao_ids: [quiz.certa] }])

    const tempo = await db.query<{ tempo_resposta_ms: number | null }>(
      'select tempo_resposta_ms from public.atividade_resposta where atividade_item_id = $1',
      [quiz.item],
    )
    expect(tempo.rows[0].tempo_resposta_ms).not.toBeNull()

    await como(db, aluno(admin), () => db.query('select public.encerrar_sessao($1)', [turma.sessaoId]))
    const { rows } = await db.query<{ a: string; s: string }>(
      `select a.status as a, s.status as s from public.atividade a
       join public.sessao_ao_vivo s on s.id = a.sessao_ao_vivo_id where a.id = $1`,
      [quiz.id],
    )
    expect(rows[0]).toEqual({ a: 'encerrada', s: 'encerrada' })
  })

  it('aluno não abre nem encerra sessão', async () => {
    const erro = await erroDe(() =>
      como(db, aluno(ana), () => db.query('select public.abrir_sessao($1)', [turma.sessaoId])),
    )
    expect(erro).toMatch(/Somente o professor/)
  })
})
