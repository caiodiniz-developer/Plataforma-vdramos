import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Varredura automática de acessibilidade (axe, regras WCAG 2.1 A e AA) nas
 * páginas que abrem sem backend. Cobre contraste de cor, nomes acessíveis,
 * ordem de títulos e uso de ARIA — o que a revisão de marca do PRD exige.
 */
async function semViolacoes(page: Page) {
  const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const resumo = resultado.violations.map((v) => ({
    regra: v.id,
    impacto: v.impact,
    onde: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
    detalhe: v.nodes[0]?.failureSummary?.split('\n').slice(0, 3).join(' | '),
  }))
  expect(resumo).toEqual([])
}

/** Rola a página inteira para que tudo que aparece ao rolar esteja visível. */
async function rolarAteOFim(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
  })
  await page.waitForTimeout(900)
}

test.describe('acessibilidade (axe, WCAG 2.1 AA)', () => {
  test('landing', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await rolarAteOFim(page)
    await semViolacoes(page)
  })

  test('privacidade', async ({ page }) => {
    await page.goto('/privacidade')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await semViolacoes(page)
  })

  test('entrada do aluno', async ({ page }) => {
    await page.goto('/aluno/entrar')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await semViolacoes(page)
  })

  test('entrada do professor', async ({ page }) => {
    await page.goto('/admin/entrar')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await semViolacoes(page)
  })

  test('página 404', async ({ page }) => {
    await page.goto('/nao-existe')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await semViolacoes(page)
  })
})
