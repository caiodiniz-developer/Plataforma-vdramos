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
    await expect(page.getByText('Turmas ativas')).toBeVisible()
    await expect(page.getByText('Alunos inscritos').locator('..')).toContainText('3')
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
    await page.getByRole('link', { name: 'Mensagens de contato' }).click()
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
