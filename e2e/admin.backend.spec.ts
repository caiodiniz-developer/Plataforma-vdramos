import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { cenarioPadrao, respostasDe } from './apoio/dados'
import { ANA, PROFESSOR, SENHA_DE_TESTE, simularSupabase } from './apoio/supabase'

async function semViolacoesDeAcessibilidade(page: Page) {
  const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(
    resultado.violations.map((v) => ({ regra: v.id, onde: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) })),
  ).toEqual([])
}

test.describe('painel do professor', () => {
  test('login com e-mail e senha leva ao painel com os números', async ({ page }) => {
    const cenario = cenarioPadrao({ usuario: PROFESSOR })
    const api = await simularSupabase(page, respostasDe(cenario))

    await page.goto('/admin/entrar')
    await page.getByLabel('E-mail').fill(PROFESSOR.email)
    await page.getByLabel('Senha').fill('senha-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos.')

    api.entrarComo(PROFESSOR)
    await page.getByLabel('Senha').fill(SENHA_DE_TESTE)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL('/admin')
    await expect(page.getByRole('heading', { level: 1, name: 'Olá, Vitor' })).toBeVisible()
    // Números vindos do banco: 2 alunos cadastrados, 1 ativo, 1 dúvida pendente.
    await expect(page.getByRole('link', { name: /Total de alunos/ })).toContainText('2')
    await expect(page.getByRole('link', { name: /Alunos ativos/ })).toContainText('1')
    await expect(page.getByRole('link', { name: /Perguntas pendentes/ })).toContainText('1')
    await expect(page.getByText('enviou uma dúvida: Dúvida sobre PROCX')).toBeVisible()
    await expect(page.getByText('Há 1 sessão ao vivo aberta.')).toBeVisible()
    await semViolacoesDeAcessibilidade(page)
    expect(api.naoTratadas).toEqual([])
  })

  test('aluno com sessão válida não entra no painel', async ({ page }) => {
    const cenario = cenarioPadrao({ usuario: ANA })
    await simularSupabase(page, respostasDe(cenario), ANA)
    await page.goto('/admin')
    await expect(page).toHaveURL('/admin/entrar')
  })

  test('login de aluno na tela do professor é recusado com a mesma mensagem', async ({ page }) => {
    const cenario = cenarioPadrao({ usuario: ANA })
    const api = await simularSupabase(page, respostasDe(cenario))
    api.entrarComo(ANA)
    await page.goto('/admin/entrar')
    await page.getByLabel('E-mail').fill(ANA.email)
    await page.getByLabel('Senha').fill(SENHA_DE_TESTE)
    await page.getByRole('button', { name: 'Entrar' }).click()
    // Não revela que a conta existe mas não é de professor.
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos.')
    await expect(page).toHaveURL('/admin/entrar')
  })

  test('mensagens de contato: filtros e marcar como lida', async ({ page, isMobile }) => {
    const cenario = cenarioPadrao({ usuario: PROFESSOR })
    const api = await simularSupabase(page, respostasDe(cenario), PROFESSOR)
    await page.goto('/admin')

    if (isMobile) await page.getByRole('button', { name: 'Abrir menu' }).click()
    await page.getByRole('link', { name: 'Contatos do site' }).click()
    await expect(page).toHaveURL('/admin/mensagens')

    // Padrão: só as não lidas.
    await expect(page.getByText('Gostaria de uma palestra sobre letramento em dados.')).toBeVisible()
    await expect(page.getByText('Podemos conversar sobre mentoria?')).toBeHidden()
    await expect(page.getByText('14/10/2026 22:30')).toBeVisible()
    await semViolacoesDeAcessibilidade(page)

    await page.getByRole('button', { name: 'Marcar como lida' }).click()
    await expect.poll(() => api.enviadas('/rest/v1/contato_mensagem').length).toBe(1)
    const [atualizacao] = api.enviadas('/rest/v1/contato_mensagem')
    expect(atualizacao.metodo).toBe('PATCH')
    expect(atualizacao.corpo).toEqual({ lida: true })
    expect(atualizacao.busca.get('id')).toBe('eq.c1')

    await page.getByRole('tab', { name: 'Lidas', exact: true }).click()
    await expect(page.getByText('Podemos conversar sobre mentoria?')).toBeVisible()
    // Assunto "outro" mostra o texto livre.
    await expect(page.getByText('Mentoria', { exact: true })).toBeVisible()

    await page.getByRole('tab', { name: 'Todas' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(2)
  })

  test('alunos: busca, bloqueio com confirmação e criação pela função do servidor', async ({ page }) => {
    const cenario = cenarioPadrao({ usuario: PROFESSOR })
    const respostas = respostasDe(cenario)
    respostas.funcoes = { 'admin-alunos': () => ({ aluno_autorizado_id: 'novo', conta_criada: false }) }
    const api = await simularSupabase(page, respostas, PROFESSOR)
    await page.goto('/admin/alunos')

    const ana = page.getByRole('row', { name: /Ana Souza/ })
    await expect(ana).toContainText('ALUNO-0001')
    await expect(ana).toContainText('Ativo')
    await expect(ana).toContainText('75% de acerto')
    await expect(page.getByRole('row', { name: /ALUNO-0002/ })).toContainText('Sem conta')
    await semViolacoesDeAcessibilidade(page)

    await page.getByRole('searchbox', { name: 'Pesquisar por nome ou ID' }).fill('ana')
    await expect(page.getByRole('row', { name: /ALUNO-0002/ })).toBeHidden()

    // Bloquear pede confirmação e só então grava.
    await ana.getByRole('button', { name: 'Ações de Ana Souza' }).click()
    await page.getByRole('menuitem', { name: 'Bloquear' }).click()
    const confirmacao = page.getByRole('alertdialog')
    await expect(confirmacao).toContainText('Bloquear Ana Souza?')
    expect(api.enviadas('/rest/v1/aluno_autorizado')).toHaveLength(0)
    await confirmacao.getByRole('button', { name: 'Bloquear' }).click()
    await expect.poll(() => api.enviadas('/rest/v1/aluno_autorizado').length).toBe(1)
    const [bloqueio] = api.enviadas('/rest/v1/aluno_autorizado')
    expect(bloqueio.metodo).toBe('PATCH')
    expect(bloqueio.corpo).toEqual({ ativo: false })

    // Criar passa pela Edge Function, que é quem fala com o Auth.
    await page.getByRole('searchbox', { name: 'Pesquisar por nome ou ID' }).fill('')
    await page.getByRole('button', { name: 'Novo aluno' }).click()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('alert')).toContainText('Informe o nome completo do aluno.')
    await page.getByLabel('Nome completo').fill('Bruno Lima')
    await page.getByLabel('ID do aluno').fill('aluno-0003')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect.poll(() => api.enviadas('admin-alunos').length).toBe(1)
    expect(api.enviadas('admin-alunos')[0].corpo).toMatchObject({ acao: 'criar', matricula: 'aluno-0003', nome: 'Bruno Lima' })
    expect(api.naoTratadas).toEqual([])
  })

  test('dúvidas: responder grava a resposta e marca como respondida', async ({ page }) => {
    const cenario = cenarioPadrao({ usuario: PROFESSOR })
    const api = await simularSupabase(page, respostasDe(cenario), PROFESSOR)
    await page.goto('/admin/duvidas')

    await expect(page.getByRole('heading', { name: 'Dúvida sobre PROCX' })).toBeVisible()
    await expect(page.getByText('Ana Souza')).toBeVisible()
    await semViolacoesDeAcessibilidade(page)

    await page.getByRole('button', { name: 'Responder' }).click()
    await page.getByLabel('Sua resposta').fill('Use PROCX quando a coluna de busca não for a primeira.')
    await page.getByRole('button', { name: 'Responder' }).click()

    await expect.poll(() => api.enviadas('/rest/v1/duvida').length).toBe(1)
    const [resposta] = api.enviadas('/rest/v1/duvida')
    expect(resposta.metodo).toBe('PATCH')
    expect(resposta.corpo).toEqual({ status: 'respondida', resposta: 'Use PROCX quando a coluna de busca não for a primeira.' })
    expect(resposta.busca.get('id')).toBe('eq.du1')
  })

  test('todas as seções do painel abrem com os dados e sem erro', async ({ page }) => {
    const cenario = cenarioPadrao({ usuario: PROFESSOR })
    const api = await simularSupabase(page, respostasDe(cenario), PROFESSOR)
    for (const [rota, titulo] of [
      ['turmas', 'Turmas'],
      ['conteudos', 'Conteúdos'],
      ['atividades', 'Atividades'],
      ['questoes', 'Questões'],
      ['conversas', 'Mensagens'],
      ['feedbacks', 'Feedbacks'],
      ['avisos', 'Avisos'],
    ]) {
      await page.goto(`/admin/${rota}`)
      await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
      await semViolacoesDeAcessibilidade(page)
    }
    await page.goto('/admin/conteudos')
    await expect(page.getByRole('heading', { name: 'Tabelas dinâmicas na prática' })).toBeVisible()
    await page.goto('/admin/avisos')
    await expect(page.getByRole('heading', { name: 'Prova na quarta' })).toBeVisible()
    expect(api.naoTratadas).toEqual([])
  })

  test('sair volta para a entrada e o painel deixa de abrir', async ({ page, isMobile }) => {
    const cenario = cenarioPadrao({ usuario: PROFESSOR })
    await simularSupabase(page, respostasDe(cenario), PROFESSOR)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    if (isMobile) await page.getByRole('button', { name: 'Abrir menu' }).click()
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL('/admin/entrar')

    await page.goto('/admin')
    await expect(page).toHaveURL('/admin/entrar')
  })
})
