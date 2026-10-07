import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { aluno, como, criarBanco, criarUsuario, erroDe, inscrever, montarTurma, type TurmaDeTeste } from './ambiente'

let db: PGlite
let turmaA: TurmaDeTeste
let turmaB: TurmaDeTeste
let admin: string
let ana: string // turma A
let bruno: string // turma A
let carla: string // turma B
let inscAna: string
let inscBruno: string
let inscCarla: string

const linhas = async <T>(quem: string, sql: string, params: unknown[] = []) =>
  (await como(db, aluno(quem), () => db.query<T>(sql, params))).rows

const notificacoesDe = (quem: string) =>
  linhas<{ tipo: string; titulo: string; link: string }>(
    quem,
    'select tipo, titulo, link from public.notificacao order by created_at, titulo',
  )

async function criarConteudo(turmaId: string | null, titulo: string, extras: Record<string, unknown> = {}) {
  const dados = { tipo: 'aula_extra', publicado: true, publicado_em: null, ...extras }
  const { rows } = await db.query<{ id: string }>(
    `insert into public.conteudo (turma_id, tipo, titulo, publicado, publicado_em)
     values ($1, $2, $3, $4, $5) returning id`,
    [turmaId, dados.tipo, titulo, dados.publicado, dados.publicado_em],
  )
  return rows[0].id
}

beforeAll(async () => {
  db = await criarBanco()
  admin = await criarUsuario(db, 'professor@exemplo.com', 'admin', 'Vitor Ramos')
  ana = await criarUsuario(db, 'ana@exemplo.com', 'aluno', 'Ana Souza')
  bruno = await criarUsuario(db, 'bruno@exemplo.com', 'aluno', 'Bruno Lima')
  carla = await criarUsuario(db, 'carla@exemplo.com', 'aluno', 'Carla Dias')
  turmaA = await montarTurma(db, 'TURMA-001')
  turmaB = await montarTurma(db, 'TURMA-002')
  inscAna = await inscrever(db, turmaA.turmaId, ana, 'A100')
  inscBruno = await inscrever(db, turmaA.turmaId, bruno, 'A101')
  inscCarla = await inscrever(db, turmaB.turmaId, carla, 'B100')
})

describe('conteúdos', () => {
  let daTurmaA: string
  let daTurmaB: string
  let paraTodos: string
  let rascunho: string
  let agendado: string

  beforeAll(async () => {
    daTurmaA = await criarConteudo(turmaA.turmaId, 'Introdução ao Desenvolvimento Web')
    daTurmaB = await criarConteudo(turmaB.turmaId, 'Conteúdo só da turma 002')
    paraTodos = await criarConteudo(null, 'Guia de estudos', { tipo: 'texto' })
    rascunho = await criarConteudo(turmaA.turmaId, 'Ainda em rascunho', { publicado: false })
    agendado = await criarConteudo(turmaA.turmaId, 'Publicação programada', {
      publicado_em: new Date(Date.now() + 86_400_000).toISOString(),
    })
  })

  it('o aluno vê só o publicado da turma dele e o que vale para todas', async () => {
    const titulos = (await linhas<{ titulo: string }>(ana, 'select titulo from public.conteudo order by titulo')).map(
      (c) => c.titulo,
    )
    expect(titulos).toEqual(['Guia de estudos', 'Introdução ao Desenvolvimento Web'])

    const daCarla = (await linhas<{ titulo: string }>(carla, 'select titulo from public.conteudo order by titulo')).map(
      (c) => c.titulo,
    )
    expect(daCarla).toEqual(['Conteúdo só da turma 002', 'Guia de estudos'])
  })

  it('publicar sem data preenche a data de publicação', async () => {
    const { rows } = await db.query<{ ok: boolean }>(
      'select publicado_em is not null as ok from public.conteudo where id = $1',
      [daTurmaA],
    )
    expect(rows[0].ok).toBe(true)
  })

  it('o aluno não cria, não edita e não apaga conteúdo', async () => {
    const criar = await erroDe(() =>
      como(db, aluno(ana), () =>
        db.query("insert into public.conteudo (turma_id, tipo, titulo, publicado) values ($1, 'aula', 'Do aluno', true)", [
          turmaA.turmaId,
        ]),
      ),
    )
    expect(criar).toMatch(/row-level security/)
    const editar = await como(db, aluno(ana), () => db.query("update public.conteudo set titulo = 'Invadido'"))
    const apagar = await como(db, aluno(ana), () => db.query('delete from public.conteudo'))
    expect(editar.affectedRows).toBe(0)
    expect(apagar.affectedRows).toBe(0)
  })

  it('publicar notifica os alunos da turma certa, uma vez', async () => {
    expect((await notificacoesDe(ana)).map((n) => n.titulo)).toEqual([
      'Nova aula extra: Introdução ao Desenvolvimento Web',
      'Novo conteúdo: Guia de estudos',
      // O conteúdo programado notifica ao ser publicado, mesmo com data futura.
      'Nova aula extra: Publicação programada',
    ])
    expect((await notificacoesDe(carla)).map((n) => n.titulo)).toEqual([
      'Nova aula extra: Conteúdo só da turma 002',
      'Novo conteúdo: Guia de estudos',
    ])

    // Publicar o rascunho notifica; salvar de novo já publicado não repete.
    await db.query('update public.conteudo set publicado = true where id = $1', [rascunho])
    await db.query("update public.conteudo set titulo = 'Agora publicado' where id = $1", [rascunho])
    const depois = (await notificacoesDe(bruno)).filter((n) => n.titulo.includes('Ainda em rascunho'))
    expect(depois).toHaveLength(1)
    expect(depois[0].link).toBe(`/aluno/conteudos/${rascunho}`)
  })

  it('registra o acesso e não deixa acessar conteúdo de outra turma, rascunho ou programado', async () => {
    await como(db, aluno(ana), () => db.query('select public.registrar_acesso($1)', [daTurmaA]))
    await como(db, aluno(ana), () => db.query('select public.registrar_acesso($1)', [daTurmaA]))
    await como(db, aluno(ana), () => db.query('select public.registrar_acesso($1)', [paraTodos]))
    const acessos = await linhas<{ conteudo_id: string }>(ana, 'select conteudo_id from public.conteudo_acesso')
    expect(acessos).toHaveLength(2)

    const outraTurma = await erroDe(() =>
      como(db, aluno(ana), () => db.query('select public.registrar_acesso($1)', [daTurmaB])),
    )
    const programado = await erroDe(() =>
      como(db, aluno(ana), () => db.query('select public.registrar_acesso($1)', [agendado])),
    )
    expect(outraTurma).toMatch(/não tem acesso/)
    expect(programado).toMatch(/não encontrado/)
    // Cada aluno enxerga só os próprios acessos.
    expect(await linhas(bruno, 'select 1 from public.conteudo_acesso')).toHaveLength(0)
  })
})

describe('dúvidas', () => {
  let duvida: string

  it('o aluno envia a dúvida e ela nasce aberta, sem resposta', async () => {
    const criada = await linhas<{ id: string; status: string; resposta: string | null }>(
      ana,
      `insert into public.duvida (inscricao_id, turma_id, titulo, pergunta, status, resposta)
       values ($1, $2, 'Diferença entre let e const', 'Quando usar cada um?', 'respondida', 'resposta forjada')
       returning id, status, resposta`,
      [inscAna, turmaA.turmaId],
    )
    duvida = criada[0].id
    // O aluno não escolhe o status nem escreve a resposta.
    expect(criada[0]).toMatchObject({ status: 'aberta', resposta: null })
  })

  it('ninguém envia dúvida em nome de outro aluno nem em turma alheia', async () => {
    const emNomeDeOutro = await erroDe(() =>
      linhas(
        bruno,
        "insert into public.duvida (inscricao_id, turma_id, titulo, pergunta) values ($1, $2, 'Título', 'Pergunta')",
        [inscAna, turmaA.turmaId],
      ),
    )
    const turmaAlheia = await erroDe(() =>
      linhas(
        carla,
        "insert into public.duvida (inscricao_id, turma_id, titulo, pergunta) values ($1, $2, 'Título', 'Pergunta')",
        [inscCarla, turmaA.turmaId],
      ),
    )
    expect(emNomeDeOutro).toMatch(/row-level security/)
    expect(turmaAlheia).toMatch(/row-level security/)
  })

  it('só o autor e o professor leem a dúvida', async () => {
    expect(await linhas(ana, 'select id from public.duvida')).toHaveLength(1)
    expect(await linhas(bruno, 'select id from public.duvida')).toHaveLength(0)
    expect(await linhas(carla, 'select id from public.duvida')).toHaveLength(0)
    expect(await linhas(admin, 'select id from public.duvida')).toHaveLength(1)
  })

  it('o aluno não edita nem responde a própria dúvida', async () => {
    const r = await como(db, aluno(ana), () =>
      db.query("update public.duvida set status = 'respondida', resposta = 'eu mesma'"),
    )
    expect(r.affectedRows).toBe(0)
  })

  it('o professor não marca como respondida sem escrever a resposta', async () => {
    const erro = await erroDe(() =>
      linhas(admin, "update public.duvida set status = 'respondida' where id = $1", [duvida]),
    )
    expect(erro).toMatch(/Escreva a resposta/)
  })

  it('responder grava a data e notifica só o autor', async () => {
    await linhas(admin, "update public.duvida set status = 'respondida', resposta = 'Use const por padrão.' where id = $1", [
      duvida,
    ])
    const [atual] = await linhas<{ resposta: string; tem_data: boolean }>(
      ana,
      'select resposta, respondida_em is not null as tem_data from public.duvida',
    )
    expect(atual).toEqual({ resposta: 'Use const por padrão.', tem_data: true })

    const daAna = (await notificacoesDe(ana)).filter((n) => n.tipo === 'duvida')
    expect(daAna).toEqual([
      { tipo: 'duvida', titulo: 'O professor respondeu: Diferença entre let e const', link: '/aluno/duvidas' },
    ])
    expect((await notificacoesDe(bruno)).filter((n) => n.tipo === 'duvida')).toHaveLength(0)
  })
})

describe('mensagens privadas', () => {
  it('cada aluno só vê a própria conversa com o professor', async () => {
    await linhas(ana, "insert into public.mensagem_privada (inscricao_id, autor, texto) values ($1, 'aluno', 'Posso entregar amanhã?')", [
      inscAna,
    ])
    await linhas(bruno, "insert into public.mensagem_privada (inscricao_id, autor, texto) values ($1, 'aluno', 'Não entendi a aula 2.')", [
      inscBruno,
    ])
    await linhas(admin, "insert into public.mensagem_privada (inscricao_id, autor, texto) values ($1, 'professor', 'Pode, sim.')", [
      inscAna,
    ])

    expect((await linhas<{ texto: string }>(ana, 'select texto from public.mensagem_privada order by created_at')).map((m) => m.texto)).toEqual([
      'Posso entregar amanhã?',
      'Pode, sim.',
    ])
    expect(await linhas(bruno, 'select 1 from public.mensagem_privada')).toHaveLength(1)
    expect(await linhas(carla, 'select 1 from public.mensagem_privada')).toHaveLength(0)
    expect(await linhas(admin, 'select 1 from public.mensagem_privada')).toHaveLength(3)
  })

  it('o aluno não escreve na conversa de outro nem se passa pelo professor', async () => {
    const naConversaAlheia = await erroDe(() =>
      linhas(bruno, "insert into public.mensagem_privada (inscricao_id, autor, texto) values ($1, 'aluno', 'oi')", [inscAna]),
    )
    const comoProfessor = await erroDe(() =>
      linhas(ana, "insert into public.mensagem_privada (inscricao_id, autor, texto) values ($1, 'professor', 'nota 10')", [
        inscAna,
      ]),
    )
    expect(naConversaAlheia).toMatch(/row-level security/)
    expect(comoProfessor).toMatch(/row-level security/)
  })

  it('a resposta do professor notifica o aluno, e ele marca como lida', async () => {
    expect((await notificacoesDe(ana)).filter((n) => n.tipo === 'mensagem')).toHaveLength(1)
    expect((await notificacoesDe(bruno)).filter((n) => n.tipo === 'mensagem')).toHaveLength(0)

    await como(db, aluno(ana), () => db.query('select public.marcar_mensagens_lidas()'))
    const { rows } = await db.query<{ lidas: number }>(
      "select count(*)::int as lidas from public.mensagem_privada where autor = 'professor' and lida_em is not null",
    )
    expect(rows[0].lidas).toBe(1)
    // O aluno não altera mensagens direto na tabela.
    const r = await como(db, aluno(ana), () => db.query("update public.mensagem_privada set texto = 'editada'"))
    expect(r.affectedRows).toBe(0)
  })
})

describe('feedback e avisos', () => {
  it('o feedback do aluno só é lido por ele e pelo professor', async () => {
    await linhas(
      ana,
      "insert into public.feedback (inscricao_id, turma_id, tipo, texto) values ($1, $2, 'dificuldade', 'Tive dificuldade com funções.')",
      [inscAna, turmaA.turmaId],
    )
    expect(await linhas(ana, 'select 1 from public.feedback')).toHaveLength(1)
    expect(await linhas(bruno, 'select 1 from public.feedback')).toHaveLength(0)
    expect(await linhas(admin, 'select 1 from public.feedback')).toHaveLength(1)

    const jaLido = await erroDe(() =>
      linhas(
        ana,
        "insert into public.feedback (inscricao_id, turma_id, tipo, texto, lido) values ($1, $2, 'sugestao', 'Mais exercícios.', true)",
        [inscAna, turmaA.turmaId],
      ),
    )
    expect(jaLido).toMatch(/row-level security/)
  })

  it('aviso para uma turma chega só nela; aviso geral chega a todos', async () => {
    await linhas(admin, "insert into public.aviso (turma_id, titulo, texto) values ($1, 'Revisão', 'Revisem o conteúdo para a próxima aula.')", [
      turmaA.turmaId,
    ])
    await linhas(admin, "insert into public.aviso (turma_id, titulo, texto) values (null, 'Recesso', 'Não haverá aula na sexta.')")

    expect((await linhas<{ titulo: string }>(ana, 'select titulo from public.aviso order by titulo')).map((a) => a.titulo)).toEqual([
      'Recesso',
      'Revisão',
    ])
    expect((await linhas<{ titulo: string }>(carla, 'select titulo from public.aviso')).map((a) => a.titulo)).toEqual(['Recesso'])
    expect((await notificacoesDe(carla)).filter((n) => n.tipo === 'aviso').map((n) => n.titulo)).toEqual(['Aviso: Recesso'])

    const doAluno = await erroDe(() =>
      linhas(ana, "insert into public.aviso (turma_id, titulo, texto) values (null, 'Falso', 'Aviso falso')"),
    )
    expect(doAluno).toMatch(/row-level security/)
  })

  it('cada pessoa lê e marca só as próprias notificações', async () => {
    const antes = (await notificacoesDe(bruno)).length
    const r = await como(db, aluno(ana), () => db.query('update public.notificacao set lida_em = now()'))
    expect(r.affectedRows).toBeGreaterThan(0)
    const { rows } = await db.query<{ n: number }>(
      'select count(*)::int as n from public.notificacao where perfil_id = $1 and lida_em is not null',
      [bruno],
    )
    expect(rows[0].n).toBe(0)
    expect((await notificacoesDe(bruno)).length).toBe(antes)
    // Ninguém cria notificação para outra pessoa.
    const forjar = await erroDe(() =>
      linhas(ana, "insert into public.notificacao (perfil_id, tipo, titulo) values ($1, 'aviso', 'Forjada')", [bruno]),
    )
    expect(forjar).toMatch(/row-level security/)
  })
})

describe('questões e lições', () => {
  let questao: string
  let item: string
  let certa: string
  let errada: string

  beforeAll(async () => {
    const a = await db.query<{ id: string }>(
      `insert into public.atividade (turma_id, tipo, titulo, dificuldade, categoria, mostrar_resultado)
       values ($1, 'questao', 'O que é HTML?', 'facil', 'Web', 'apos_responder') returning id`,
      [turmaA.turmaId],
    )
    questao = a.rows[0].id
    const i = await db.query<{ id: string }>(
      `insert into public.atividade_item (atividade_id, ordem, enunciado, tipo_resposta, explicacao)
       values ($1, 1, 'O que é HTML?', 'escolha_unica', 'HTML é uma linguagem de marcação.') returning id`,
      [questao],
    )
    item = i.rows[0].id
    const o = await db.query<{ id: string; correta: boolean }>(
      `insert into public.atividade_opcao (atividade_item_id, ordem, texto, correta) values
         ($1, 1, 'Linguagem de programação', false), ($1, 2, 'Linguagem de marcação', true),
         ($1, 3, 'Banco de dados', false), ($1, 4, 'Sistema operacional', false)
       returning id, correta`,
      [item],
    )
    certa = o.rows.find((x) => x.correta)!.id
    errada = o.rows.find((x) => !x.correta)!.id
  })

  it('questão sem resposta correta não pode ser publicada', async () => {
    const semGabarito = await db.query<{ id: string }>(
      "insert into public.atividade (turma_id, tipo, titulo) values ($1, 'questao', 'Sem gabarito') returning id",
      [turmaA.turmaId],
    )
    const i = await db.query<{ id: string }>(
      "insert into public.atividade_item (atividade_id, ordem, enunciado, tipo_resposta) values ($1, 1, 'Pergunta', 'escolha_unica') returning id",
      [semGabarito.rows[0].id],
    )
    await db.query(
      "insert into public.atividade_opcao (atividade_item_id, ordem, texto) values ($1, 1, 'A'), ($1, 2, 'B')",
      [i.rows[0].id],
    )
    const erro = await erroDe(() => linhas(admin, 'select public.publicar_atividade($1)', [semGabarito.rows[0].id]))
    expect(erro).toMatch(/marque a opção correta/)
  })

  it('publicar notifica a turma; o aluno responde e vê acerto e explicação', async () => {
    await linhas(admin, 'select public.publicar_atividade($1)', [questao])
    expect((await notificacoesDe(bruno)).some((n) => n.titulo === 'Nova questão: O que é HTML?' && n.link === '/aluno/questoes')).toBe(true)
    expect((await notificacoesDe(carla)).some((n) => n.tipo === 'atividade')).toBe(false)

    await linhas(ana, 'select public.responder_atividade($1, $2::jsonb)', [
      questao,
      JSON.stringify([{ item_id: item, opcao_ids: [certa] }]),
    ])
    await linhas(bruno, 'select public.responder_atividade($1, $2::jsonb)', [
      questao,
      JSON.stringify([{ item_id: item, opcao_ids: [errada] }]),
    ])

    const [visao] = await linhas<{ v: { respondida: boolean; dificuldade: string; itens: { explicacao: string; minha_resposta: { correta: boolean } }[] } }>(
      ana,
      'select public.atividade_para_aluno($1) as v',
      [questao],
    )
    expect(visao.v.respondida).toBe(true)
    expect(visao.v.dificuldade).toBe('facil')
    expect(visao.v.itens[0].minha_resposta.correta).toBe(true)
    expect(visao.v.itens[0].explicacao).toBe('HTML é uma linguagem de marcação.')
  })

  it('lição respeita o prazo e aceita item sem gabarito (fica sem correção)', async () => {
    const licao = await db.query<{ id: string }>(
      `insert into public.atividade (turma_id, tipo, titulo, descricao, instrucoes_md, prazo_em)
       values ($1, 'licao', 'Atividade — Introdução ao JavaScript', 'Primeiros passos', 'Responda com suas palavras.', now() + interval '1 day')
       returning id`,
      [turmaA.turmaId],
    )
    const id = licao.rows[0].id
    const aberta = await db.query<{ id: string }>(
      "insert into public.atividade_item (atividade_id, ordem, enunciado, tipo_resposta) values ($1, 1, 'O que é uma variável?', 'texto_livre') returning id",
      [id],
    )
    await linhas(admin, 'select public.publicar_atividade($1)', [id])
    await linhas(ana, 'select public.responder_atividade($1, $2::jsonb)', [
      id,
      JSON.stringify([{ item_id: aberta.rows[0].id, texto: 'Um nome que guarda um valor.' }]),
    ])
    const { rows } = await db.query<{ correta: boolean | null; texto: string }>(
      'select correta, texto from public.atividade_resposta where atividade_item_id = $1',
      [aberta.rows[0].id],
    )
    expect(rows).toEqual([{ correta: null, texto: 'Um nome que guarda um valor.' }])

    await db.query("update public.atividade set prazo_em = now() - interval '1 hour' where id = $1", [id])
    const atrasado = await erroDe(() =>
      linhas(bruno, 'select public.responder_atividade($1, $2::jsonb)', [
        id,
        JSON.stringify([{ item_id: aberta.rows[0].id, texto: 'Atrasado.' }]),
      ]),
    )
    expect(atrasado).toMatch(/prazo desta atividade terminou/)
  })

  it('lista as atividades com a situação de cada aluno e não vaza para outra turma', async () => {
    type Linha = { titulo: string; tipo: string; respondida: boolean; acertos: number }
    const daAna = await linhas<Linha>(ana, 'select titulo, tipo, respondida, acertos from public.minhas_atividades($1) order by titulo', [
      turmaA.turmaId,
    ])
    expect(daAna).toEqual([
      { titulo: 'Atividade — Introdução ao JavaScript', tipo: 'licao', respondida: true, acertos: 0 },
      { titulo: 'O que é HTML?', tipo: 'questao', respondida: true, acertos: 1 },
    ])
    const doBruno = await linhas<Linha>(bruno, 'select titulo, respondida, acertos from public.minhas_atividades($1) order by titulo', [
      turmaA.turmaId,
    ])
    expect(doBruno.map((l) => [l.respondida, l.acertos])).toEqual([
      [false, 0],
      [true, 0],
    ])
    expect(await linhas(carla, 'select 1 from public.minhas_atividades($1)', [turmaA.turmaId])).toHaveLength(0)
  })

  it('o progresso do aluno soma atividades, questões, conteúdos e dúvidas', async () => {
    const [{ p }] = await linhas<{ p: Record<string, number> }>(ana, 'select public.meu_progresso($1) as p', [turmaA.turmaId])
    expect(p).toMatchObject({
      atividades_realizadas: 1,
      atividades_disponiveis: 1,
      questoes_respondidas: 1,
      questoes_corretas: 1,
      conteudos_acessados: 2,
      duvidas_abertas: 0,
      duvidas_respondidas: 1,
    })
    // Quem não é da turma recebe tudo zerado, não os números de outra pessoa.
    const [{ p: deFora }] = await linhas<{ p: Record<string, number> }>(carla, 'select public.meu_progresso($1) as p', [
      turmaA.turmaId,
    ])
    expect(deFora.questoes_respondidas).toBe(0)
    expect(deFora.conteudos_disponiveis).toBe(0)
  })
})

describe('painel do professor', () => {
  it('a lista de alunos traz situação e progresso; o aluno não a lê', async () => {
    await db.query("insert into public.aluno_autorizado (turma_id, matricula, nome_referencia) values ($1, 'A199', 'Sem Conta')", [
      turmaA.turmaId,
    ])
    type Linha = { matricula: string; nome: string; situacao: string; questoes_corretas: number; duvidas: number }
    const lista = await linhas<Linha>(
      admin,
      `select matricula, nome, situacao, questoes_corretas::int, duvidas::int
       from public.vw_aluno where turma_codigo = 'TURMA-001' order by matricula`,
    )
    expect(lista).toEqual([
      { matricula: 'A100', nome: 'Ana Souza', situacao: 'ativo', questoes_corretas: 1, duvidas: 1 },
      { matricula: 'A101', nome: 'Bruno Lima', situacao: 'ativo', questoes_corretas: 0, duvidas: 0 },
      { matricula: 'A199', nome: 'Sem Conta', situacao: 'sem_conta', questoes_corretas: 0, duvidas: 0 },
    ])
    expect(await linhas(ana, 'select 1 from public.vw_aluno')).toHaveLength(0)
  })

  it('a atividade recente descreve o que os alunos fizeram', async () => {
    const recente = await linhas<{ tipo: string; aluno: string; descricao: string }>(
      admin,
      'select tipo, aluno, descricao from public.vw_atividade_recente order by quando desc',
    )
    const descricoes = recente.map((r) => `${r.aluno} ${r.descricao}`)
    expect(descricoes).toContain('Ana Souza enviou uma dúvida: Diferença entre let e const')
    expect(descricoes).toContain('Ana Souza respondeu a questão O que é HTML?')
    expect(descricoes).toContain('Ana Souza acessou Introdução ao Desenvolvimento Web')
    expect(descricoes).toContain('Ana Souza enviou um feedback')
    expect(descricoes).toContain('Bruno Lima enviou uma mensagem')
    expect(await linhas(ana, 'select 1 from public.vw_atividade_recente')).not.toHaveLength(recente.length)
  })
})

describe('aluno bloqueado', () => {
  it('perde a leitura de tudo e não consegue mais enviar nada', async () => {
    await db.query("update public.aluno_autorizado set ativo = false where matricula = 'A100'")

    for (const tabela of ['conteudo', 'duvida', 'mensagem_privada', 'feedback', 'aviso', 'conteudo_acesso']) {
      expect(await linhas(ana, `select 1 from public.${tabela}`), tabela).toHaveLength(0)
    }
    const duvida = await erroDe(() =>
      linhas(ana, "insert into public.duvida (inscricao_id, turma_id, titulo, pergunta) values ($1, $2, 'Bloqueada', 'Consigo enviar?')", [
        inscAna,
        turmaA.turmaId,
      ]),
    )
    const mensagem = await erroDe(() =>
      linhas(ana, "insert into public.mensagem_privada (inscricao_id, autor, texto) values ($1, 'aluno', 'oi')", [inscAna]),
    )
    expect(duvida).toMatch(/row-level security/)
    expect(mensagem).toMatch(/row-level security/)

    // Desbloquear devolve o acesso, com o histórico intacto.
    await db.query("update public.aluno_autorizado set ativo = true where matricula = 'A100'")
    expect(await linhas(ana, 'select 1 from public.duvida')).toHaveLength(1)
  })

  it('a turma A não aparece para a aluna da turma B em nenhuma tabela nova', async () => {
    for (const tabela of ['duvida', 'mensagem_privada', 'feedback', 'conteudo_acesso']) {
      expect(await linhas(carla, `select 1 from public.${tabela}`), tabela).toHaveLength(0)
    }
    expect(inscBruno).not.toBe(inscCarla)
  })
})
