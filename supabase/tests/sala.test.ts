import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { aluno, como, criarBanco, criarUsuario, erroDe, inscrever, montarTurma, type TurmaDeTeste } from './ambiente'

let db: PGlite
let turma: TurmaDeTeste
let admin: string
let ana: string
let bruno: string
let carla: string // não inscrita

async function abrirSessao() {
  await db.query("update public.sessao_ao_vivo set status = 'aberta', aberta_em = now() where id = $1", [
    turma.sessaoId,
  ])
}

function perguntar(quem: string, texto: string, destino: 'turma' | 'professor', anonima = false) {
  return como(db, aluno(quem), async () => {
    const { rows } = await db.query<{ id: string }>(
      'select public.enviar_pergunta($1, $2, $3, $4) as id',
      [turma.sessaoId, texto, destino, anonima],
    )
    return rows[0].id
  })
}

beforeAll(async () => {
  db = await criarBanco()
  admin = await criarUsuario(db, 'professor@exemplo.com', 'admin', 'Vitor Ramos')
  ana = await criarUsuario(db, 'ana@exemplo.com', 'aluno', 'Ana Souza')
  bruno = await criarUsuario(db, 'bruno@exemplo.com', 'aluno', 'Bruno Lima')
  carla = await criarUsuario(db, 'carla@exemplo.com', 'aluno', 'Carla Dias')
  turma = await montarTurma(db)
  await inscrever(db, turma.turmaId, ana, 'A100')
  await inscrever(db, turma.turmaId, bruno, 'A101')
})

describe('sessão', () => {
  it('nasce agendada junto com o encontro', async () => {
    const { rows } = await db.query<{ status: string }>(
      'select status from public.sessao_ao_vivo where id = $1',
      [turma.sessaoId],
    )
    expect(rows[0].status).toBe('agendada')
  })

  it('não aceita pergunta antes de ser aberta', async () => {
    expect(await erroDe(() => perguntar(ana, 'Posso enviar agora?', 'turma'))).toMatch(/encerrada/)
  })

  it('aluno inscrito vê a sessão; quem não é da turma não vê', async () => {
    const daTurma = await como(db, aluno(ana), () => db.query('select id from public.sessao_ao_vivo'))
    const deFora = await como(db, aluno(carla), () => db.query('select id from public.sessao_ao_vivo'))
    expect(daTurma.rows).toHaveLength(1)
    expect(deFora.rows).toHaveLength(0)
  })
})

describe('perguntas', () => {
  let publica: string
  let anonima: string
  let privada: string

  beforeAll(async () => {
    await abrirSessao()
    publica = await perguntar(ana, 'Qual a diferença entre PROCV e PROCX?', 'turma')
    anonima = await perguntar(ana, 'Não entendi referência absoluta.', 'turma', true)
    privada = await perguntar(ana, 'Posso entregar a atividade depois?', 'professor')
  })

  it('grava o bloco em andamento e o nome do autor', async () => {
    const { rows } = await db.query<{ bloco_encontro_id: string; autor_nome: string }>(
      'select bloco_encontro_id, autor_nome from public.pergunta where id = $1',
      [publica],
    )
    expect(rows[0]).toEqual({ bloco_encontro_id: turma.blocoId, autor_nome: 'Ana Souza' })
  })

  it('pergunta anônima não leva nome nem autoria para o colega', async () => {
    const mural = await como(db, aluno(bruno), () =>
      db.query<{ id: string; autor_nome: string | null }>('select * from public.pergunta where id = $1', [
        anonima,
      ]),
    )
    expect(mural.rows[0].autor_nome).toBeNull()
    expect(Object.keys(mural.rows[0])).not.toContain('inscricao_id')

    const autoria = await como(db, aluno(bruno), () => db.query('select * from public.pergunta_autoria'))
    expect(autoria.rows).toHaveLength(0)
  })

  it('nem o professor vê a autoria de pergunta anônima', async () => {
    const { rows } = await como(db, aluno(admin), () =>
      db.query<{ pergunta_id: string }>('select pergunta_id from public.pergunta_autoria'),
    )
    const ids = rows.map((r) => r.pergunta_id)
    expect(ids).toContain(publica)
    expect(ids).not.toContain(anonima)
  })

  it('pergunta só para o professor não aparece para os colegas', async () => {
    const deBruno = await como(db, aluno(bruno), () => db.query<{ id: string }>('select id from public.pergunta'))
    const deAna = await como(db, aluno(ana), () => db.query<{ id: string }>('select id from public.pergunta'))
    const doAdmin = await como(db, aluno(admin), () => db.query<{ id: string }>('select id from public.pergunta'))
    expect(deBruno.rows.map((r) => r.id)).not.toContain(privada)
    expect(deAna.rows.map((r) => r.id)).toContain(privada)
    expect(doAdmin.rows.map((r) => r.id)).toContain(privada)
  })

  it('quem não é da turma não lê nem envia', async () => {
    const lidas = await como(db, aluno(carla), () => db.query('select id from public.pergunta'))
    expect(lidas.rows).toHaveLength(0)
    expect(await erroDe(() => perguntar(carla, 'Entrei sem estar inscrita?', 'turma'))).toMatch(/não está inscrito/)
  })

  it('aluno não insere nem edita pergunta direto na tabela', async () => {
    const inserir = await erroDe(() =>
      como(db, aluno(ana), () =>
        db.query(
          "insert into public.pergunta (sessao_ao_vivo_id, texto, destino) values ($1, 'direto na tabela', 'turma')",
          [turma.sessaoId],
        ),
      ),
    )
    expect(inserir).toMatch(/row-level security/)

    const editar = await como(db, aluno(ana), () =>
      db.query("update public.pergunta set status = 'respondida' where id = $1", [publica]),
    )
    expect(editar.affectedRows).toBe(0)
  })

  it('rejeita texto fora do limite e anônima quando a sessão não permite', async () => {
    expect(await erroDe(() => perguntar(ana, 'oi', 'turma'))).toMatch(/3 a 500/)
    await db.query('update public.sessao_ao_vivo set permite_anonimo = false where id = $1', [turma.sessaoId])
    expect(await erroDe(() => perguntar(ana, 'Pergunta sem nome', 'turma', true))).toMatch(/anônimas/)
    await db.query('update public.sessao_ao_vivo set permite_anonimo = true where id = $1', [turma.sessaoId])
  })

  it('voto alterna e o contador acompanha', async () => {
    const votar = (quem: string) =>
      como(db, aluno(quem), async () => {
        const { rows } = await db.query<{ v: boolean }>('select public.alternar_voto($1) as v', [publica])
        return rows[0].v
      })
    const votos = async () =>
      (await db.query<{ votos: number }>('select votos from public.pergunta where id = $1', [publica])).rows[0].votos

    expect(await votar(bruno)).toBe(true)
    expect(await votar(ana)).toBe(true)
    expect(await votos()).toBe(2)
    expect(await votar(bruno)).toBe(false)
    expect(await votos()).toBe(1)
  })

  it('não dá para votar em pergunta enviada só ao professor', async () => {
    const erro = await erroDe(() =>
      como(db, aluno(bruno), () => db.query('select public.alternar_voto($1)', [privada])),
    )
    expect(erro).toMatch(/não encontrada/)
  })

  it('pergunta ocultada some do mural e avisa a sessão', async () => {
    const antes = await db.query<{ updated_at: string }>(
      'select updated_at from public.sessao_ao_vivo where id = $1',
      [turma.sessaoId],
    )
    await como(db, aluno(admin), () =>
      db.query("update public.pergunta set status = 'oculta' where id = $1", [anonima]),
    )
    const mural = await como(db, aluno(bruno), () => db.query<{ id: string }>('select id from public.pergunta'))
    expect(mural.rows.map((r) => r.id)).not.toContain(anonima)

    const depois = await db.query<{ updated_at: string }>(
      'select updated_at from public.sessao_ao_vivo where id = $1',
      [turma.sessaoId],
    )
    expect(new Date(depois.rows[0].updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(antes.rows[0].updated_at).getTime(),
    )
  })
})

describe('mensagens', () => {
  const enviar = (quem: string, texto: string) =>
    como(db, aluno(quem), async () => {
      const { rows } = await db.query<{ id: string }>('select public.enviar_mensagem($1, $2) as id', [
        turma.sessaoId,
        texto,
      ])
      return rows[0].id
    })

  it('grava o nome do autor e marca link quando o texto é só uma URL', async () => {
    const id = await enviar(ana, 'https://exemplo.com/planilha.xlsx')
    const { rows } = await db.query<{ tipo: string; autor_nome: string }>(
      'select tipo, autor_nome from public.mensagem where id = $1',
      [id],
    )
    expect(rows[0]).toEqual({ tipo: 'link', autor_nome: 'Ana Souza' })
  })

  it('segura a segunda mensagem do mesmo aluno por 5 s', async () => {
    expect(await erroDe(() => enviar(ana, 'outra em seguida'))).toMatch(/Aguarde/)
    // Outro aluno não é afetado pelo limite da Ana.
    expect(await erroDe(() => enviar(bruno, 'bom dia, turma'))).toBeNull()
  })

  it('respeita o chat desativado', async () => {
    await db.query('update public.sessao_ao_vivo set chat_ativo = false where id = $1', [turma.sessaoId])
    await db.query("update public.mensagem set created_at = now() - interval '1 minute'")
    expect(await erroDe(() => enviar(ana, 'alguém aí?'))).toMatch(/desativadas/)
    await db.query('update public.sessao_ao_vivo set chat_ativo = true where id = $1', [turma.sessaoId])
  })

  it('mensagem removida some para os alunos e continua para o professor', async () => {
    await como(db, aluno(admin), () => db.query('update public.mensagem set removida = true'))
    const alunoVe = await como(db, aluno(bruno), () => db.query('select id from public.mensagem'))
    const adminVe = await como(db, aluno(admin), () => db.query('select id from public.mensagem'))
    expect(alunoVe.rows).toHaveLength(0)
    expect(adminVe.rows.length).toBeGreaterThan(0)
  })

  it('aluno não consegue enviar aviso direto na tabela', async () => {
    const erro = await erroDe(() =>
      como(db, aluno(ana), () =>
        db.query(
          "insert into public.mensagem (sessao_ao_vivo_id, perfil_id, tipo, texto) values ($1, $2, 'aviso', 'falso aviso')",
          [turma.sessaoId, ana],
        ),
      ),
    )
    expect(erro).toMatch(/row-level security/)
  })

  it('professor envia aviso', async () => {
    await como(db, aluno(admin), () =>
      db.query(
        "insert into public.mensagem (sessao_ao_vivo_id, perfil_id, tipo, texto) values ($1, $2, 'aviso', 'Intervalo de 15 minutos.')",
        [turma.sessaoId, admin],
      ),
    )
    const { rows } = await como(db, aluno(ana), () =>
      db.query<{ tipo: string; autor_nome: string }>('select tipo, autor_nome from public.mensagem'),
    )
    expect(rows).toEqual([{ tipo: 'aviso', autor_nome: 'Vitor Ramos' }])
  })
})

describe('acesso revogado', () => {
  it('ID desativado perde a leitura da turma e da sala na hora', async () => {
    await db.query("update public.aluno_autorizado set ativo = false where matricula = 'A101'")
    const turmas = await como(db, aluno(bruno), () => db.query('select id from public.turma'))
    const perguntas = await como(db, aluno(bruno), () => db.query('select id from public.pergunta'))
    expect(turmas.rows).toHaveLength(0)
    expect(perguntas.rows).toHaveLength(0)
    expect(await erroDe(() => perguntar(bruno, 'Ainda consigo perguntar?', 'turma'))).toMatch(/não está inscrito/)
  })

  it('função interna de contexto não é chamável pelo aluno', async () => {
    const erro = await erroDe(() =>
      como(db, aluno(ana), () => db.query('select * from public.contexto_da_sessao($1)', [turma.sessaoId])),
    )
    expect(erro).toMatch(/permission denied/)
  })
})
