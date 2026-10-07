import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { cenarioPadrao, CODIGO, QUIZ, respostasDe } from './apoio/dados'
import { ANA, sessaoDe, simularSupabase } from './apoio/supabase'

async function semViolacoesDeAcessibilidade(page: Page) {
  const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(
    resultado.violations.map((v) => ({ regra: v.id, onde: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) })),
  ).toEqual([])
}

test.describe('entrada do aluno', () => {
  test('login recorrente: IDs, código e chegada na turma', async ({ page }) => {
    const cenario = cenarioPadrao()
    const respostas = respostasDe(cenario)
    respostas.funcoes = {
      'acesso-aluno': (chamada) => {
        const corpo = chamada.corpo as { acao: string; codigo?: string }
        if (corpo.acao === 'verificar') return { etapa: 'codigo', email_mascarado: 'a•••@empresa.com' }
        if (corpo.codigo !== '123456') return { status: 401, corpo: { erro: 'Código inválido ou expirado.', codigo: 'codigo' } }
        // Código certo: a partir daqui o Auth reconhece a aluna.
        api.entrarComo(ANA)
        return { sessao: sessaoDe(ANA), codigo_turma: CODIGO }
      },
    }
    // Sem sessão inicial: ela nasce do login.
    const api = await simularSupabase(page, respostas)

    await page.goto('/aluno/entrar')
    await page.getByLabel('ID do aluno').fill('aluno-0001')
    await page.getByLabel('ID da turma').fill('excia-cps-2610')
    await page.getByRole('button', { name: 'Continuar' }).click()

    await expect(page.getByText(/a•••@empresa\.com/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Reenviar código em/ })).toBeDisabled()

    // Código errado: fica na etapa e mostra o erro do servidor.
    await page.getByRole('textbox').fill('000000')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('alert')).toContainText('Código inválido ou expirado.')

    await page.getByRole('textbox').fill('123456')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(`/aluno/turmas/${CODIGO}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Excel Básico com IA Generativa' })).toBeVisible()

    // O app normaliza os IDs antes de enviar.
    const [verificar] = api.enviadas('acesso-aluno')
    expect(verificar.corpo).toMatchObject({ acao: 'verificar', matricula: 'ALUNO-0001', codigo_turma: 'EXCIA-CPS-2610' })
  })

  test('primeiro acesso: cadastro exige o termo e envia a escolha de comunicação', async ({ page }) => {
    const respostas = respostasDe(cenarioPadrao())
    respostas.funcoes = {
      'acesso-aluno': (chamada) => {
        const corpo = chamada.corpo as { acao: string }
        return corpo.acao === 'verificar' ? { etapa: 'cadastro' } : { etapa: 'codigo', email_mascarado: 'n•••@empresa.com' }
      },
    }
    const api = await simularSupabase(page, respostas)

    await page.goto('/aluno/entrar')
    await page.getByLabel('ID do aluno').fill('ALUNO-0002')
    await page.getByLabel('ID da turma').fill(CODIGO)
    await page.getByRole('button', { name: 'Continuar' }).click()

    await expect(page.getByText('Etapa 2 de 3')).toBeVisible()
    await expect(page.getByRole('switch')).not.toBeChecked()
    await semViolacoesDeAcessibilidade(page)

    await page.getByLabel('Nome completo').fill('Nina Prado')
    await page.getByLabel('E-mail', { exact: true }).fill('nina@empresa.com')
    await page.getByRole('button', { name: 'Enviar código' }).click()
    await expect(page.getByText('É preciso aceitar o termo de uso para continuar.')).toBeVisible()

    await page.getByRole('checkbox').check()
    await page.getByRole('switch').click()
    await page.getByRole('button', { name: 'Enviar código' }).click()
    await expect(page.getByText('Etapa 3 de 3')).toBeVisible()

    const cadastro = api.enviadas('acesso-aluno').find((c) => (c.corpo as { acao: string }).acao === 'cadastrar')
    expect(cadastro?.corpo).toMatchObject({
      nome: 'Nina Prado',
      email: 'nina@empresa.com',
      aceite_termo: true,
      quer_comunicacao: true,
    })
  })

  test('IDs que não batem mostram a mensagem genérica do servidor', async ({ page }) => {
    const respostas = respostasDe(cenarioPadrao())
    respostas.funcoes = {
      'acesso-aluno': () => ({
        status: 404,
        corpo: { erro: 'Não encontramos essa combinação. Confira com o professor.', codigo: 'nao_encontrado' },
      }),
    }
    await simularSupabase(page, respostas)
    await page.goto('/aluno/entrar')
    await page.getByLabel('ID do aluno').fill('X')
    await page.getByLabel('ID da turma').fill('Y')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByRole('alert')).toContainText('Não encontramos essa combinação. Confira com o professor.')
    await expect(page.getByText('Etapa 1 de 2')).toBeVisible()
  })
})

test.describe('turma do aluno', () => {
  test('abas de materiais, curso e atividades', async ({ page }) => {
    const cenario = cenarioPadrao({ statusDaSessao: 'agendada', atividades: [{ ...QUIZ, sessao_ao_vivo_id: null }] })
    const api = await simularSupabase(page, respostasDe(cenario), cenario.usuario)
    await page.goto(`/aluno/turmas/${CODIGO}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await semViolacoesDeAcessibilidade(page)

    await page.getByRole('tab', { name: 'Materiais' }).click()
    await expect(page.getByRole('heading', { name: 'Material geral do curso' })).toBeVisible()
    await expect(page.getByText('Planilha do encontro 1', { exact: true })).toBeVisible()
    await semViolacoesDeAcessibilidade(page)

    await page.getByRole('tab', { name: 'Curso' }).click()
    await expect(page.getByText('20 horas')).toBeVisible()
    await expect(page.getByText('CT1', { exact: true })).toBeVisible()
    await semViolacoesDeAcessibilidade(page)

    await page.getByRole('tab', { name: 'Atividades' }).click()
    await page.getByRole('button', { name: 'Responder' }).click()
    await page.getByRole('radio', { name: '$' }).check()
    await page.getByRole('button', { name: 'Enviar respostas' }).click()

    // Depois de responder: correção, explicação e resultado da turma.
    await expect(page.getByText('Correta', { exact: true })).toBeVisible()
    await expect(page.getByText('O cifrão trava a linha, a coluna ou as duas.')).toBeVisible()
    await expect(page.getByText('75%')).toBeVisible()
    await semViolacoesDeAcessibilidade(page)

    const [resposta] = api.enviadas('responder_atividade')
    expect(resposta.corpo).toEqual({ p_atividade_id: QUIZ.id, p_respostas: [{ item_id: 'i1', opcao_ids: ['o1'] }] })
    expect(api.naoTratadas).toEqual([])
  })

  test('baixa o calendário em .ics com o fuso da turma', async ({ page }) => {
    const cenario = cenarioPadrao({ statusDaSessao: 'agendada' })
    await simularSupabase(page, respostasDe(cenario), cenario.usuario)
    await page.goto(`/aluno/turmas/${CODIGO}`)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Adicionar ao calendário' }).click(),
    ])
    expect(download.suggestedFilename()).toBe('excia-cps-2610.ics')
    const conteudo = await (await download.createReadStream()).toArray()
    const ics = Buffer.concat(conteudo).toString('utf8')
    expect(ics).toContain('DTSTART;TZID=America/Sao_Paulo:20991014T184500')
    expect(ics).toContain('BEGIN:VEVENT')
  })

  test('turma encerrada fica em modo leitura, sem faixa de aula ao vivo', async ({ page }) => {
    const cenario = cenarioPadrao({ statusDaTurma: 'encerrada', statusDaSessao: 'aberta' })
    await simularSupabase(page, respostasDe(cenario), cenario.usuario)
    await page.goto(`/aluno/turmas/${CODIGO}`)
    await expect(page.getByText(/somente leitura/)).toBeVisible()
    await expect(page.getByText('Aula ao vivo agora')).toBeHidden()
  })

  test('termo com versão antiga barra a turma até o novo aceite', async ({ page }) => {
    const cenario = cenarioPadrao({ versaoDoTermo: '2025-01-v0' })
    const api = await simularSupabase(page, respostasDe(cenario), cenario.usuario)
    await page.goto(`/aluno/turmas/${CODIGO}`)

    await expect(page.getByRole('heading', { name: 'O termo de uso mudou' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    await semViolacoesDeAcessibilidade(page)

    await page.getByRole('checkbox').check()
    cenario.versaoDoTermo = '2026-10-v1'
    await page.getByRole('button', { name: 'Continuar' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Excel Básico com IA Generativa' })).toBeVisible()
    const [aceite] = api.enviadas('/rest/v1/consentimento')
    expect(aceite.corpo).toMatchObject({ finalidade: 'uso_dados_pedagogicos', concedido: true, origem: 'area_aluno', versao_termo: '2026-10-v1' })
  })
})

test.describe('sala ao vivo', () => {
  test('mural ordenado, pergunta anônima enviada e mensagem com link seguro', async ({ page, isMobile }) => {
    const cenario = cenarioPadrao()
    const api = await simularSupabase(page, respostasDe(cenario), cenario.usuario)
    await page.goto(`/aluno/turmas/${CODIGO}`)
    await page.getByRole('link', { name: 'Entrar na aula ao vivo' }).click()
    await expect(page).toHaveURL(`/aluno/turmas/${CODIGO}/ao-vivo`)

    const mural = page.getByRole('list', { name: 'Mural de perguntas' }).filter({ visible: true })
    await expect(mural.getByRole('listitem').first()).toContainText('Não entendi referência absoluta.')
    await expect(mural.getByRole('listitem').first()).toContainText('Anônimo')
    await expect(mural.getByRole('listitem').first()).toContainText('Respondida')
    await semViolacoesDeAcessibilidade(page)

    const campo = page.getByLabel('Sua pergunta').filter({ visible: true })
    await campo.fill('Como travar só a coluna?')
    await page.getByLabel('Enviar anônima').filter({ visible: true }).check()
    await page.getByRole('button', { name: 'Enviar pergunta' }).filter({ visible: true }).click()

    await expect(mural).toContainText('Como travar só a coluna?')
    await expect(campo).toHaveValue('')
    const [pergunta] = api.enviadas('enviar_pergunta')
    expect(pergunta.corpo).toMatchObject({ p_texto: 'Como travar só a coluna?', p_destino: 'turma', p_anonima: true })

    if (isMobile) await page.getByRole('tab', { name: 'Mensagens' }).click()
    const feed = page.getByRole('list', { name: 'Mensagens da turma' }).filter({ visible: true })
    await expect(feed.getByRole('listitem').first()).toContainText('Intervalo de 15 minutos.')
    const link = feed.getByRole('link', { name: 'https://exemplo.com/base.xlsx' })
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(link).toHaveAttribute('target', '_blank')

    await page.getByPlaceholder('Mensagem para a turma').filter({ visible: true }).fill('Obrigada, professor.')
    await page.getByRole('button', { name: 'Enviar mensagem' }).filter({ visible: true }).click()
    await expect(feed).toContainText('Obrigada, professor.')
    // Intervalo de 5 s entre mensagens: o botão trava com a contagem.
    await expect(page.getByRole('button', { name: 'Enviar mensagem' }).filter({ visible: true })).toBeDisabled()
    await semViolacoesDeAcessibilidade(page)
    expect(api.naoTratadas).toEqual([])
  })

  test('uma pergunta que chega pelo Realtime aparece sem recarregar a página', async ({ page }) => {
    const cenario = cenarioPadrao()
    const api = await simularSupabase(page, respostasDe(cenario), cenario.usuario)
    await page.goto(`/aluno/turmas/${CODIGO}/ao-vivo`)
    await expect(page.getByText('Qual a diferença entre PROCV e PROCX?').first()).toBeVisible()
    await expect.poll(() => api.canaisAbertos()).toBeGreaterThan(0)
    await expect(page.getByText('Reconectando…')).toBeHidden()

    cenario.perguntas = [
      ...cenario.perguntas,
      { id: 'p9', texto: 'Dá para usar IA para revisar fórmulas?', destino: 'turma', anonima: false, autor_nome: 'Carla Dias', status: 'aberta', resposta: null, votos: 0, created_at: '2026-10-14T22:30:00Z' },
    ]
    api.emitirMudanca('pergunta')

    await expect(page.getByText('Dá para usar IA para revisar fórmulas?').first()).toBeVisible()
  })

  test('quiz publicado abre sozinho e pode ser respondido', async ({ page }) => {
    const cenario = cenarioPadrao({ atividades: [QUIZ] })
    await simularSupabase(page, respostasDe(cenario), cenario.usuario)
    await page.goto(`/aluno/turmas/${CODIGO}/ao-vivo`)

    const dialogo = page.getByRole('dialog', { name: 'Quiz — referências de célula' })
    await expect(dialogo).toBeVisible()
    await dialogo.getByRole('radio', { name: '$' }).check()
    await dialogo.getByRole('button', { name: 'Enviar respostas' }).click()
    await expect(dialogo.getByText('Correta', { exact: true })).toBeVisible()
    await semViolacoesDeAcessibilidade(page)
  })

  test('sessão encerrada vira somente leitura', async ({ page }) => {
    const cenario = cenarioPadrao({ statusDaSessao: 'encerrada' })
    await simularSupabase(page, respostasDe(cenario), cenario.usuario)
    await page.goto(`/aluno/turmas/${CODIGO}/ao-vivo`)
    await expect(page.getByText('Somente leitura')).toBeVisible()
    await expect(page.getByLabel('Sua pergunta').filter({ visible: true })).toHaveCount(0)
    await expect(page.getByText('Qual a diferença entre PROCV e PROCX?').first()).toBeVisible()
  })
})

test.describe('meus dados', () => {
  test('mostra perfil e turmas, grava a comunicação e baixa o JSON', async ({ page }) => {
    const cenario = cenarioPadrao()
    const api = await simularSupabase(page, respostasDe(cenario), cenario.usuario)
    await page.goto('/aluno/meus-dados')

    await expect(page.getByText('ana@empresa.com')).toBeVisible()
    await expect(page.getByRole('link', { name: CODIGO })).toBeVisible()
    await expect(page.getByText('14/10/2026 22:30')).toBeVisible()
    await semViolacoesDeAcessibilidade(page)

    await page.getByRole('switch').click()
    await expect(page.getByText('Comunicações ativadas')).toBeVisible()
    const [consentimento] = api.enviadas('/rest/v1/consentimento')
    expect(consentimento.corpo).toMatchObject({ finalidade: 'comunicacao_professor', concedido: true, origem: 'area_aluno' })

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Baixar meus dados' }).click(),
    ])
    expect(download.suggestedFilename()).toBe('meus-dados.json')
    const json = JSON.parse(Buffer.concat(await (await download.createReadStream()).toArray()).toString('utf8'))
    expect(json.perfil.email).toBe('ana@empresa.com')
    expect(Object.keys(json)).toEqual(
      expect.arrayContaining(['perfil', 'inscricoes', 'consentimentos', 'perguntas', 'mensagens', 'respostas']),
    )
    expect(api.naoTratadas).toEqual([])
  })

  test('a exclusão pede confirmação e só então chama o servidor', async ({ page }) => {
    const cenario = cenarioPadrao()
    const respostas = respostasDe(cenario)
    respostas.funcoes = { 'excluir-conta': () => ({ ok: true }) }
    const api = await simularSupabase(page, respostas, cenario.usuario)
    await page.goto('/aluno/meus-dados')

    await page.getByRole('button', { name: 'Solicitar exclusão' }).click()
    const dialogo = page.getByRole('alertdialog', { name: 'Excluir sua conta?' })
    await expect(dialogo).toBeVisible()
    expect(api.enviadas('excluir-conta')).toHaveLength(0)

    await dialogo.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialogo).toBeHidden()
    expect(api.enviadas('excluir-conta')).toHaveLength(0)

    await page.getByRole('button', { name: 'Solicitar exclusão' }).click()
    await dialogo.getByRole('button', { name: 'Excluir conta' }).click()
    await expect(page).toHaveURL('/')
    expect(api.enviadas('excluir-conta')).toHaveLength(1)
  })
})
