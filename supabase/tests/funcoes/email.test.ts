import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assuntoDaResposta, escapar, htmlDaResposta, htmlDoAviso, textoParaHtml } from '../../functions/_shared/mensagens'
import { carregarFuncao } from './ambiente'

type Ambiente = Awaited<ReturnType<typeof carregarFuncao>>
type Enviado = { from: string; to: string[]; subject: string; html: string; reply_to?: string; attachments?: { filename: string; content: string }[] }

const AUTORIZACAO = { autorizacao: 'Bearer token' }
// Valores de mentira: só ligam o gateway de e-mail dentro do teste.
const COM_EMAIL = { RESEND_API_KEY: 'chave' + '-de-teste', EMAIL_REMETENTE: 'Vitor Ramos <avisos@exemplo.com>' }

let enviados: Enviado[]
let statusDoProvedor: number

beforeEach(() => {
  enviados = []
  statusDoProvedor = 200
  vi.stubGlobal('fetch', async (_url: string, opcoes: { body: string }) => {
    enviados.push(JSON.parse(opcoes.body) as Enviado)
    return new Response('{}', { status: statusDoProvedor })
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('montagem das mensagens', () => {
  it('escapa o que o usuário escreveu', () => {
    expect(escapar(`<script>alert("x")</script> & 'y'`)).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;')
  })

  it('transforma vários links em âncoras e mantém as quebras de linha', () => {
    const html = textoParaHtml('Leia [a apostila](https://exemplo.com/a.pdf)\ne veja https://exemplo.com/video?x=1&y=2.')
    expect(html).toBe(
      'Leia <a href="https://exemplo.com/a.pdf">a apostila</a><br>e veja <a href="https://exemplo.com/video?x=1&amp;y=2">https://exemplo.com/video?x=1&amp;y=2</a>.',
    )
  })

  it('não cria link para esquema que não seja http ou https', () => {
    const html = textoParaHtml('[clique](javascript:alert(1)) e <b>negrito</b>')
    expect(html).not.toContain('<a ')
    expect(html).toContain('&lt;b&gt;negrito&lt;/b&gt;')
  })

  it('assunto da resposta no formato Turma - Aluno - Atividade', () => {
    expect(assuntoDaResposta({ turma: 'TURMA-001', aluno: 'Ana Souza', atividade: 'Lição 1' })).toBe('TURMA-001 - Ana Souza - Lição 1')
  })

  it('corpo da resposta traz detalhes, respostas e arquivos', () => {
    const html = htmlDaResposta({
      turma: 'TURMA-001',
      aluno: 'Ana <Souza>',
      matricula: 'A100',
      atividade: 'Lição 1',
      descricao: 'Monte a página.',
      prazo: '21/10/2026 20:14',
      enviadaEm: '20/10/2026 19:00',
      respostas: [{ ordem: 1, enunciado: 'O que é HTML?', resposta: 'Linguagem de marcação', correta: null }],
      arquivos: [
        { nome: 'projeto.zip', tamanhoBytes: 2 * 1024 * 1024, link: 'https://arquivos.teste/a', anexado: true },
        { nome: 'video.mp4', tamanhoBytes: 20 * 1024 * 1024, link: 'https://arquivos.teste/b', anexado: false },
      ],
    })
    expect(html).toContain('Ana &lt;Souza&gt; (A100)')
    expect(html).toContain('1. O que é HTML?')
    expect(html).toContain('Linguagem de marcação')
    expect(html).toContain('projeto.zip</a> — 2.0 MB (em anexo)')
    expect(html).toContain('video.mp4</a> — 20.0 MB (link válido por 7 dias)')
  })

  it('aviso diz para quem foi e como deixar de receber', () => {
    const html = htmlDoAviso({ titulo: 'Prova', texto: 'Sexta, veja https://exemplo.com', turmas: ['T1', 'T2'] }, 'https://site.exemplo')
    expect(html).toContain('as turmas T1, T2')
    expect(html).toContain('<a href="https://exemplo.com">')
    expect(html).toContain('https://site.exemplo/aluno/meus-dados')
  })
})

describe('notificar-resposta', () => {
  let amb: Ambiente
  let ids: { atividade: string; inscricao: string }

  async function preparar(env: Record<string, string> = COM_EMAIL) {
    amb = await carregarFuncao('notificar-resposta', env)
    const b = amb.banco
    const turma = b.inserir('turma', { codigo: 'TURMA-001', status: 'ativa' })
    const autorizado = b.inserir('aluno_autorizado', { turma_id: turma.id, matricula: 'A100', ativo: true })
    b.inserir('perfil', { id: 'aluna-1', nome: 'Ana Souza', email: 'aluno-x@alunos.vitorramos.invalid', papel: 'aluno' })
    b.inserir('perfil', { id: 'prof-1', nome: 'Vitor Ramos', email: 'professor@exemplo.com', papel: 'admin' })
    const inscricao = b.inserir('inscricao', { aluno_autorizado_id: autorizado.id, turma_id: turma.id, perfil_id: 'aluna-1' })
    const atividade = b.inserir('atividade', { turma_id: turma.id, titulo: 'Lição 1', descricao: 'Monte a página.', prazo_em: null })
    const item = b.inserir('atividade_item', { atividade_id: atividade.id, ordem: 1, enunciado: 'O que é HTML?' })
    b.inserir('atividade_resposta', { atividade_item_id: item.id, inscricao_id: inscricao.id, opcao_ids: null, valor: null, texto: 'Linguagem de marcação', correta: null })
    b.inserir('atividade_entrega', { atividade_id: atividade.id, inscricao_id: inscricao.id, arquivo_path: 'entregas/aluna-1/p.zip', nome_arquivo: 'projeto.zip', tamanho_bytes: 3 })
    b.arquivos.set('entregas/aluna-1/p.zip', new Uint8Array([80, 75, 3]))
    b.usuarioLogado = { id: 'aluna-1' }
    ids = { atividade: String(atividade.id), inscricao: String(inscricao.id) }
  }

  it('envia ao professor com o assunto pedido, as respostas e o arquivo em anexo', async () => {
    await preparar()
    const r = await amb.chamar({ atividade_id: ids.atividade }, AUTORIZACAO)
    expect(r.corpo).toMatchObject({ configurado: true, enviado: true })
    expect(enviados).toHaveLength(1)
    expect(enviados[0].to).toEqual(['professor@exemplo.com'])
    expect(enviados[0].subject).toBe('TURMA-001 - Ana Souza - Lição 1')
    expect(enviados[0].html).toContain('Linguagem de marcação')
    expect(enviados[0].attachments).toEqual([{ filename: 'projeto.zip', content: 'UEsD' }])
  })

  it('não repete o e-mail da mesma atividade para o mesmo aluno', async () => {
    await preparar()
    await amb.chamar({ atividade_id: ids.atividade }, AUTORIZACAO)
    const segunda = await amb.chamar({ atividade_id: ids.atividade }, AUTORIZACAO)
    expect(segunda.corpo).toMatchObject({ enviado: false, motivo: 'ja_enviado' })
    expect(enviados).toHaveLength(1)
  })

  it('se o provedor falha, libera o registro para tentar de novo', async () => {
    await preparar()
    statusDoProvedor = 500
    const r = await amb.chamar({ atividade_id: ids.atividade }, AUTORIZACAO)
    expect(r.corpo).toMatchObject({ enviado: false, motivo: 'provedor_500' })
    expect(amb.banco.linhas('atividade_email')).toHaveLength(0)
  })

  it('sem provedor configurado, responde sem enviar nem registrar', async () => {
    await preparar({})
    const r = await amb.chamar({ atividade_id: ids.atividade }, AUTORIZACAO)
    expect(r.corpo).toEqual({ configurado: false, enviado: false })
    expect(enviados).toHaveLength(0)
    expect(amb.banco.linhas('atividade_email')).toHaveLength(0)
  })

  it('exige sessão, inscrição na turma e que o aluno tenha respondido', async () => {
    await preparar()
    amb.banco.usuarioLogado = null
    expect((await amb.chamar({ atividade_id: ids.atividade }, AUTORIZACAO)).status).toBe(401)

    amb.banco.usuarioLogado = { id: 'outra-pessoa' }
    expect((await amb.chamar({ atividade_id: ids.atividade }, AUTORIZACAO)).status).toBe(403)

    amb.banco.usuarioLogado = { id: 'aluna-1' }
    amb.banco.tabelas.atividade_resposta = []
    const semResposta = await amb.chamar({ atividade_id: ids.atividade }, AUTORIZACAO)
    expect(semResposta.status).toBe(409)
    expect(enviados).toHaveLength(0)
  })

  it('EMAIL_DO_PROFESSOR, se definido, é o destino', async () => {
    await preparar({ ...COM_EMAIL, EMAIL_DO_PROFESSOR: 'respostas@exemplo.com' })
    await amb.chamar({ atividade_id: ids.atividade }, AUTORIZACAO)
    expect(enviados[0].to).toEqual(['respostas@exemplo.com'])
  })
})

describe('enviar-aviso', () => {
  let amb: Ambiente
  const LOTE = 'lote-1'

  async function preparar(env: Record<string, string> = COM_EMAIL) {
    amb = await carregarFuncao('enviar-aviso', env)
    const b = amb.banco
    b.inserir('perfil', { id: 'prof-1', nome: 'Vitor Ramos', email: 'professor@exemplo.com', papel: 'admin' })
    b.inserir('perfil', { id: 'aluna-1', nome: 'Ana', email: 'x@alunos.vitorramos.invalid', papel: 'aluno' })
    const t1 = b.inserir('turma', { codigo: 'T1' })
    const t2 = b.inserir('turma', { codigo: 'T2' })
    const t3 = b.inserir('turma', { codigo: 'T3' })
    b.inserir('aviso', { turma_id: t1.id, titulo: 'Prova', texto: 'Sexta. https://exemplo.com', lote_id: LOTE })
    b.inserir('aviso', { turma_id: t2.id, titulo: 'Prova', texto: 'Sexta. https://exemplo.com', lote_id: LOTE })
    // A visão já traz só quem consentiu e informou e-mail (regra testada no banco).
    b.inserir('vw_emails_comunicacao', { turma_id: t1.id, email: 'Ana@Exemplo.com' })
    b.inserir('vw_emails_comunicacao', { turma_id: t2.id, email: 'ana@exemplo.com' }) // a mesma pessoa em duas turmas
    b.inserir('vw_emails_comunicacao', { turma_id: t2.id, email: 'bruno@exemplo.com' })
    b.inserir('vw_emails_comunicacao', { turma_id: t3.id, email: 'fora@exemplo.com' })
    b.usuarioLogado = { id: 'prof-1' }
  }

  it('envia um e-mail por aluno das turmas do aviso, sem repetir nem expor os demais', async () => {
    await preparar()
    const r = await amb.chamar({ lote_id: LOTE }, AUTORIZACAO)
    expect(r.corpo).toEqual({ configurado: true, destinatarios: 2, enviados: 2 })
    expect(enviados.map((e) => e.to)).toEqual([['ana@exemplo.com'], ['bruno@exemplo.com']])
    expect(enviados[0].subject).toBe('Prova')
    expect(enviados[0].html).toContain('as turmas T1, T2')
    expect(enviados[0].html).toContain('<a href="https://exemplo.com">')
    expect(enviados[0].reply_to).toBe('professor@exemplo.com')
  })

  it('aviso para todos alcança todas as turmas', async () => {
    await preparar()
    amb.banco.inserir('aviso', { turma_id: null, titulo: 'Geral', texto: 'Para todos.', lote_id: 'lote-2' })
    const r = await amb.chamar({ lote_id: 'lote-2' }, AUTORIZACAO)
    expect(r.corpo).toMatchObject({ destinatarios: 3, enviados: 3 })
    expect(enviados[0].html).toContain('todos os alunos')
  })

  it('só o professor envia', async () => {
    await preparar()
    amb.banco.usuarioLogado = { id: 'aluna-1' }
    expect((await amb.chamar({ lote_id: LOTE }, AUTORIZACAO)).status).toBe(403)
    amb.banco.usuarioLogado = null
    expect((await amb.chamar({ lote_id: LOTE }, AUTORIZACAO)).status).toBe(401)
    expect(enviados).toHaveLength(0)
  })

  it('sem provedor configurado, informa quantos receberiam e não envia', async () => {
    await preparar({})
    const r = await amb.chamar({ lote_id: LOTE }, AUTORIZACAO)
    expect(r.corpo).toEqual({ configurado: false, destinatarios: 2, enviados: 0 })
    expect(enviados).toHaveLength(0)
  })

  it('lote inexistente devolve 404', async () => {
    await preparar()
    expect((await amb.chamar({ lote_id: 'nao-existe' }, AUTORIZACAO)).status).toBe(404)
  })
})
