import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { aluno, como, criarBanco, criarUsuario, erroDe, inscrever, montarTurma, type TurmaDeTeste } from './ambiente'

let db: PGlite
let turma: TurmaDeTeste
let admin: string
let ana: string

beforeAll(async () => {
  db = await criarBanco()
  admin = await criarUsuario(db, 'professor@exemplo.com', 'admin')
  ana = await criarUsuario(db, 'ana@exemplo.com', 'aluno', 'Ana Souza')
  turma = await montarTurma(db)
  await inscrever(db, turma.turmaId, ana, 'A100')
})

describe('lista de IDs autorizados', () => {
  it('normaliza a matrícula e não duplica dentro da turma', async () => {
    await db.query("insert into public.aluno_autorizado (turma_id, matricula) values ($1, '  b-200 ')", [
      turma.turmaId,
    ])
    const { rows } = await db.query<{ matricula: string }>(
      "select matricula from public.aluno_autorizado where matricula like 'B-%'",
    )
    expect(rows).toEqual([{ matricula: 'B-200' }])

    const repetida = await erroDe(() =>
      db.query("insert into public.aluno_autorizado (turma_id, matricula) values ($1, 'b-200')", [turma.turmaId]),
    )
    expect(repetida).toMatch(/duplicate key/)
  })

  it('aluno nunca lê a lista de matrículas', async () => {
    const { rows } = await como(db, aluno(ana), () => db.query('select * from public.aluno_autorizado'))
    expect(rows).toHaveLength(0)
  })

  it('um ID autorizado gera no máximo uma inscrição', async () => {
    const outro = await criarUsuario(db, 'intruso@exemplo.com')
    const erro = await erroDe(() =>
      db.query(
        `insert into public.inscricao (aluno_autorizado_id, turma_id, perfil_id)
         select id, turma_id, $1 from public.aluno_autorizado where matricula = 'A100'`,
        [outro],
      ),
    )
    expect(erro).toMatch(/duplicate key/)
  })
})

describe('salvar_blocos', () => {
  const salvar = (blocos: unknown[]) =>
    como(db, aluno(admin), () =>
      db.query('select public.salvar_blocos($1, $2::jsonb)', [turma.encontroId, JSON.stringify(blocos)]),
    )

  const listar = async () =>
    (
      await db.query<{ id: string; ordem: number; hora_inicio: string; titulo: string }>(
        'select id, ordem, hora_inicio::text, titulo from public.bloco_encontro where encontro_id = $1 order by ordem',
        [turma.encontroId],
      )
    ).rows

  it('recalcula os horários pela soma das durações e preserva o id dos existentes', async () => {
    await db.query("update public.encontro set hora_inicio = '18:45', hora_fim = '22:45' where id = $1", [
      turma.encontroId,
    ])
    await salvar([
      { duracao_min: 15, tipo: 'abertura', titulo: 'Abertura' },
      { id: turma.blocoId, duracao_min: 60, tipo: 'teoria', titulo: 'Teoria' },
      { duracao_min: 15, tipo: 'intervalo', titulo: 'Intervalo' },
    ])
    const blocos = await listar()
    expect(blocos.map((b) => [b.ordem, b.hora_inicio, b.titulo])).toEqual([
      [1, '18:45:00', 'Abertura'],
      [2, '19:00:00', 'Teoria'],
      [3, '20:00:00', 'Intervalo'],
    ])
    expect(blocos[1].id).toBe(turma.blocoId)
  })

  it('reordena numa única chamada e remove os blocos que saíram da lista', async () => {
    const [abertura, teoria] = await listar()
    await salvar([
      { id: teoria.id, duracao_min: 60, tipo: 'teoria', titulo: 'Teoria' },
      { id: abertura.id, duracao_min: 15, tipo: 'abertura', titulo: 'Abertura' },
    ])
    expect((await listar()).map((b) => [b.hora_inicio, b.titulo])).toEqual([
      ['18:45:00', 'Teoria'],
      ['19:45:00', 'Abertura'],
    ])
  })

  it('aluno não salva blocos', async () => {
    const erro = await erroDe(() =>
      como(db, aluno(ana), () => db.query("select public.salvar_blocos($1, '[]'::jsonb)", [turma.encontroId])),
    )
    expect(erro).toMatch(/Somente o professor/)
  })
})

describe('duplicar_turma', () => {
  it('copia encontros, blocos, materiais e atividades em rascunho, deslocando as datas', async () => {
    await db.query(
      `insert into public.material (turma_id, encontro_id, titulo, tipo, url)
       values ($1, $2, 'Planilha base', 'link', 'https://exemplo.com/base.xlsx'),
              ($1, null, 'Apostila', 'link', 'https://exemplo.com/apostila.pdf')`,
      [turma.turmaId, turma.encontroId],
    )
    const atividade = await db.query<{ id: string }>(
      `insert into public.atividade (turma_id, sessao_ao_vivo_id, bloco_encontro_id, tipo, titulo, alvo, status)
       values ($1, $2, $3, 'pesquisa_satisfacao', 'Satisfação — teoria', 'teoria', 'encerrada') returning id`,
      [turma.turmaId, turma.sessaoId, turma.blocoId],
    )
    await db.query(
      `insert into public.atividade_item (atividade_id, ordem, enunciado, tipo_resposta)
       values ($1, 1, 'Clareza', 'escala_1_5')`,
      [atividade.rows[0].id],
    )

    const { rows } = await como(db, aluno(admin), () =>
      db.query<{ id: string }>(
        "select public.duplicar_turma($1, 'TESTE-CPS-2702', (current_date + 120)) as id",
        [turma.turmaId],
      ),
    )
    const nova = rows[0].id

    const resumo = await db.query<{
      status: string
      encontros: number
      blocos: number
      materiais: number
      materiais_do_encontro: number
      atividades_rascunho: number
      itens: number
      autorizados: number
      dias: number
    }>(
      `select
         t.status,
         (select count(*)::int from public.encontro e where e.turma_id = t.id) as encontros,
         (select count(*)::int from public.bloco_encontro b join public.encontro e on e.id = b.encontro_id
           where e.turma_id = t.id) as blocos,
         (select count(*)::int from public.material m where m.turma_id = t.id) as materiais,
         (select count(*)::int from public.material m join public.encontro e on e.id = m.encontro_id
           where m.turma_id = t.id and e.turma_id = t.id) as materiais_do_encontro,
         (select count(*)::int from public.atividade a where a.turma_id = t.id and a.status = 'rascunho') as atividades_rascunho,
         (select count(*)::int from public.atividade_item i join public.atividade a on a.id = i.atividade_id
           where a.turma_id = t.id) as itens,
         (select count(*)::int from public.aluno_autorizado a where a.turma_id = t.id) as autorizados,
         (select (e.data - current_date)::int from public.encontro e where e.turma_id = t.id limit 1) as dias
       from public.turma t where t.id = $1`,
      [nova],
    )
    expect(resumo.rows[0]).toMatchObject({
      status: 'planejada',
      encontros: 1,
      blocos: 2,
      materiais: 2,
      materiais_do_encontro: 1,
      atividades_rascunho: 1,
      itens: 1,
      // A lista de alunos não é copiada.
      autorizados: 0,
    })
    expect(resumo.rows[0].dias).toBeGreaterThanOrEqual(119)

    // A atividade copiada aponta para a sessão e o bloco da turma nova.
    const ligacoes = await db.query<{ sessao_ok: boolean; bloco_ok: boolean }>(
      `select
         public.turma_da_sessao(a.sessao_ao_vivo_id) = a.turma_id as sessao_ok,
         exists (select 1 from public.bloco_encontro b join public.encontro e on e.id = b.encontro_id
                 where b.id = a.bloco_encontro_id and e.turma_id = a.turma_id) as bloco_ok
       from public.atividade a where a.turma_id = $1`,
      [nova],
    )
    expect(ligacoes.rows[0]).toEqual({ sessao_ok: true, bloco_ok: true })
  })

  it('a turma nova, ainda planejada, não aparece em contadores errados', async () => {
    const { rows } = await como(db, aluno(admin), () =>
      db.query<{ codigo: string; autorizados: number; inscritos: number; encontros: number }>(
        `select codigo, autorizados::int, inscritos::int, encontros::int
         from public.vw_turma_resumo order by codigo`,
      ),
    )
    expect(rows).toEqual([
      { codigo: 'TESTE-CPS-2610', autorizados: 2, inscritos: 1, encontros: 1 },
      { codigo: 'TESTE-CPS-2702', autorizados: 0, inscritos: 0, encontros: 1 },
    ])
  })
})

describe('materiais', () => {
  it('aluno só vê material já liberado', async () => {
    await db.query(
      `insert into public.material (turma_id, titulo, tipo, url, liberado_em)
       values ($1, 'Gabarito', 'link', 'https://exemplo.com/gabarito', now() + interval '2 days')`,
      [turma.turmaId],
    )
    const { rows } = await como(db, aluno(ana), () =>
      db.query<{ titulo: string }>('select titulo from public.material order by titulo'),
    )
    expect(rows.map((r) => r.titulo)).toEqual(['Apostila', 'Planilha base'])
  })

  it('material precisa de link ou arquivo, e de texto quando o tipo é "outro"', async () => {
    const semDestino = await erroDe(() =>
      db.query("insert into public.material (turma_id, titulo, tipo) values ($1, 'Vazio', 'link')", [turma.turmaId]),
    )
    const outroSemTexto = await erroDe(() =>
      db.query(
        "insert into public.material (turma_id, titulo, tipo, url) values ($1, 'Outro', 'outro', 'https://exemplo.com')",
        [turma.turmaId],
      ),
    )
    expect(semDestino).toMatch(/material_url_ou_arquivo/)
    expect(outroSemTexto).toMatch(/material_tipo_outro_obrigatorio/)
  })
})

describe('relatórios', () => {
  it('aluno não lê as views de relatório', async () => {
    const participacao = await como(db, aluno(ana), () => db.query('select * from public.vw_participacao_aluno'))
    const emails = await como(db, aluno(ana), () => db.query('select * from public.vw_emails_comunicacao'))
    // A aluna enxerga no máximo a própria linha, nunca a dos colegas.
    expect(participacao.rows.length).toBeLessThanOrEqual(1)
    expect(emails.rows.length).toBeLessThanOrEqual(1)
  })

  it('lista de e-mails segue o consentimento vigente e a revogação vale na hora', async () => {
    const emails = () =>
      como(db, aluno(admin), () =>
        db.query<{ email: string }>('select email from public.vw_emails_comunicacao where turma_id = $1', [
          turma.turmaId,
        ]),
      )
    expect((await emails()).rows).toHaveLength(0)

    await db.query(
      `insert into public.consentimento (perfil_id, finalidade, concedido, versao_termo, origem, created_at)
       values ($1, 'comunicacao_professor', true, '2026-10-v1', 'cadastro', now() - interval '1 day')`,
      [ana],
    )
    // Consentiu, mas sem e-mail de contato não há para onde enviar.
    expect((await emails()).rows).toHaveLength(0)
    await db.query("update public.perfil set email_contato = 'ana.contato@exemplo.com' where id = $1", [ana])
    expect((await emails()).rows).toEqual([{ email: 'ana.contato@exemplo.com' }])

    await db.query(
      `insert into public.consentimento (perfil_id, finalidade, concedido, versao_termo, origem)
       values ($1, 'comunicacao_professor', false, '2026-10-v1', 'area_aluno')`,
      [ana],
    )
    expect((await emails()).rows).toHaveLength(0)
  })

  it('satisfação por bloco e exportação com hash em atividade anônima', async () => {
    const pesquisa = await db.query<{ id: string }>(
      `insert into public.atividade (turma_id, bloco_encontro_id, tipo, titulo, alvo, anonima, status)
       values ($1, $2, 'pesquisa_satisfacao', 'Satisfação — teoria (anônima)', 'teoria', true, 'publicada')
       returning id`,
      [turma.turmaId, turma.blocoId],
    )
    const item = await db.query<{ id: string }>(
      `insert into public.atividade_item (atividade_id, ordem, enunciado, tipo_resposta)
       values ($1, 1, 'Clareza', 'escala_1_5') returning id`,
      [pesquisa.rows[0].id],
    )
    await como(db, aluno(ana), () =>
      db.query('select public.responder_atividade($1, $2::jsonb)', [
        pesquisa.rows[0].id,
        JSON.stringify([{ item_id: item.rows[0].id, valor: 4 }]),
      ]),
    )

    const satisfacao = await como(db, aluno(admin), () =>
      db.query<{ tipo_bloco: string; media: string; respostas: number }>(
        'select tipo_bloco, media::text, respostas::int from public.vw_satisfacao_por_bloco where turma_id = $1',
        [turma.turmaId],
      ),
    )
    expect(satisfacao.rows).toEqual([{ tipo_bloco: 'teoria', media: '4.0', respostas: 1 }])

    const exportacao = await como(db, aluno(admin), () =>
      db.query<{ aluno: string; valor: number }>(
        'select aluno, valor from public.vw_exportacao_respostas where atividade_id = $1',
        [pesquisa.rows[0].id],
      ),
    )
    expect(exportacao.rows[0].valor).toBe(4)
    expect(exportacao.rows[0].aluno).toMatch(/^[0-9a-f]{12}$/)
    expect(exportacao.rows[0].aluno).not.toContain('Ana')
  })
})

describe('limites e retenção', () => {
  it('conta tentativas por IP dentro da janela', async () => {
    const tentar = async () =>
      (
        await db.query<{ ok: boolean }>(
          "select public.dentro_do_limite('contato', 'hash-ip', 3, interval '1 hour') as ok",
        )
      ).rows[0].ok
    expect([await tentar(), await tentar(), await tentar(), await tentar()]).toEqual([true, true, true, false])

    // Tentativas antigas saem da janela.
    await db.query("update public.limite_tentativa set created_at = now() - interval '2 hours'")
    expect(await tentar()).toBe(true)
  })

  it('aluno não lê nem chama a infraestrutura de limite', async () => {
    const ler = await erroDe(() => como(db, aluno(ana), () => db.query('select * from public.limite_tentativa')))
    const chamar = await erroDe(() =>
      como(db, aluno(ana), () =>
        db.query("select public.dentro_do_limite('contato', 'x', 3, interval '1 hour')"),
      ),
    )
    expect(ler).toMatch(/permission denied/)
    expect(chamar).toMatch(/permission denied/)
  })

  it('apaga dados pessoais 24 meses depois do fim da turma e mantém a estrutura', async () => {
    expect((await db.query<{ n: number }>('select public.aplicar_retencao() as n')).rows[0].n).toBe(0)

    await db.query(
      `update public.turma set status = 'encerrada',
         data_inicio = current_date - interval '26 months', data_fim = current_date - interval '25 months'
       where id = $1`,
      [turma.turmaId],
    )
    expect((await db.query<{ n: number }>('select public.aplicar_retencao() as n')).rows[0].n).toBe(1)

    const { rows } = await db.query<{ inscricoes: number; perfis_aluno: number; encontros: number; admins: number }>(
      `select
         (select count(*)::int from public.inscricao where turma_id = $1) as inscricoes,
         (select count(*)::int from public.perfil where email = 'ana@exemplo.com') as perfis_aluno,
         (select count(*)::int from public.encontro where turma_id = $1) as encontros,
         (select count(*)::int from public.perfil where papel = 'admin') as admins`,
      [turma.turmaId],
    )
    expect(rows[0]).toEqual({ inscricoes: 0, perfis_aluno: 0, encontros: 1, admins: 1 })
  })
})
