import { expect, test } from '@playwright/test'

test.describe('rotas públicas e protegidas', () => {
  test('a landing abre sem erros no console', async ({ page }) => {
    const erros: string[] = []
    page.on('pageerror', (e) => erros.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error') erros.push(m.text())
    })

    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Vitor Ramos' })).toBeVisible()
    expect(erros).toEqual([])
  })

  test('privacidade mostra a versão do termo e o texto da política', async ({ page }) => {
    await page.goto('/privacidade')
    await expect(page.getByRole('heading', { level: 1, name: 'Privacidade e termo de uso' })).toBeVisible()
    await expect(page.getByText(/Versão 2026-10-v1/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Seus direitos' })).toBeVisible()
  })

  test('endereço inexistente cai na página 404 e volta ao início', async ({ page }) => {
    await page.goto('/nao-existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao início' }).click()
    await expect(page).toHaveURL('/')
  })

  test('área do aluno sem sessão redireciona para a entrada', async ({ page }) => {
    await page.goto('/aluno/turmas/EXCIA-CPS-2610')
    await expect(page).toHaveURL('/aluno/entrar')
    await expect(page.getByRole('heading', { name: 'Área do aluno' })).toBeVisible()
  })

  test('sala ao vivo e meus dados também exigem sessão', async ({ page }) => {
    await page.goto('/aluno/turmas/EXCIA-CPS-2610/ao-vivo')
    await expect(page).toHaveURL('/aluno/entrar')
    await page.goto('/aluno/meus-dados')
    await expect(page).toHaveURL('/aluno/entrar')
  })

  test('o painel do aluno e as suas telas exigem sessão', async ({ page }) => {
    for (const rota of ['/aluno', '/aluno/conteudos', '/aluno/atividades', '/aluno/duvidas', '/aluno/mensagens']) {
      await page.goto(rota)
      await expect(page).toHaveURL('/aluno/entrar')
    }
  })

  test('painel do admin sem sessão redireciona para a entrada do professor', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL('/admin/entrar')
    for (const rota of ['/admin/mensagens', '/admin/alunos', '/admin/conteudos', '/admin/questoes', '/admin/duvidas']) {
      await page.goto(rota)
      await expect(page).toHaveURL('/admin/entrar')
    }
    await expect(page.getByLabel('E-mail')).toBeVisible()
    await expect(page.getByLabel('Senha')).toBeVisible()
  })

  test('entrada do aluno avisa quando o backend não está configurado', async ({ page }) => {
    await page.goto('/aluno/entrar')
    await page.getByLabel('ID do aluno').fill('ALUNO-0001')
    await page.getByLabel('ID da turma').fill('EXCIA-CPS-2610')
    await page.getByRole('textbox', { name: 'Senha' }).fill('qualquer-valor-1')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('alert')).toContainText('backend ainda não foi configurado')
  })
})
