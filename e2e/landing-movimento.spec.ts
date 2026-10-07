import { expect, test, type Page } from '@playwright/test'

/**
 * Movimento da landing (GSAP + ScrollTrigger) num navegador real: o que a
 * animação não pode quebrar. Âncoras, limpeza ao trocar de rota, a aula que
 * passa com a rolagem, movimento reduzido e largura da página.
 */
const previa = (page: Page) => page.getByRole('group', { name: 'Prévia ilustrativa da sala de aula' })

async function abrir(page: Page, endereco = '/') {
  await page.goto(endereco)
  await expect(page.getByRole('heading', { level: 1, name: 'Vitor Ramos' })).toBeVisible()
}

/** Rola direto para um ponto, sem a rolagem suave do CSS. */
async function rolarPara(page: Page, y: number | 'fim') {
  await page.evaluate((alvo) => {
    const topo = alvo === 'fim' ? document.documentElement.scrollHeight : alvo
    window.scrollTo({ top: topo, behavior: 'instant' })
  }, y)
}

test.describe('movimento da landing', () => {
  test('as âncoras do cabeçalho chegam à seção, mesmo com a seção fixada no caminho', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no celular as âncoras ficam no menu (coberto em landing.spec.ts)')
    await abrir(page)
    const cabecalho = page.getByRole('banner')

    await cabecalho.getByRole('link', { name: 'Contato' }).click()
    await expect(page).toHaveURL(/#contato$/)
    await expect(page.getByRole('heading', { level: 2, name: 'Contato' })).toBeInViewport()

    await cabecalho.getByRole('link', { name: 'Sala de aula' }).click()
    await expect(page).toHaveURL(/#sala-de-aula$/)
    await expect(page.getByRole('heading', { level: 2, name: 'Sala de aula interativa' })).toBeInViewport()

    await cabecalho.getByRole('link', { name: 'Frentes' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Frentes de trabalho' })).toBeInViewport()
  })

  test('abrir o endereço com #contato leva direto ao contato', async ({ page }) => {
    await abrir(page, '/#contato')
    await expect(page.getByRole('heading', { level: 2, name: 'Contato' })).toBeInViewport()
  })

  test('sair da landing e voltar não deixa seção fixada órfã nem duplica', async ({ page }) => {
    await abrir(page)
    const fixadores = page.locator('.pin-spacer')
    const iniciais = await fixadores.count()

    for (let volta = 0; volta < 2; volta++) {
      await page.getByRole('contentinfo').getByRole('link', { name: 'Privacidade' }).click()
      await expect(page).toHaveURL('/privacidade')
      await expect(fixadores).toHaveCount(0)

      await page.goBack()
      await expect(page.getByRole('heading', { level: 1, name: 'Vitor Ramos' })).toBeVisible()
      await expect(fixadores).toHaveCount(iniciais)
    }

    // A página volta inteira: um único h1 e o contato alcançável.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await rolarPara(page, 'fim')
    await expect(page.getByRole('heading', { level: 2, name: 'Contato' })).toBeAttached()
  })

  test('no desktop, a seção da sala fica fixa e a rolagem faz a aula passar', async ({ page, isMobile }) => {
    test.skip(isMobile, 'a seção só é fixada em telas largas e altas')
    await abrir(page)
    await expect(page.locator('.pin-spacer')).toHaveCount(1)

    const topo = await page.locator('#sala-de-aula').evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
    const altura = page.viewportSize()!.height

    // Começo da seção fixada: a aula ainda vai começar.
    await rolarPara(page, topo)
    await expect(previa(page).getByText('18:45', { exact: true })).toBeVisible()
    await expect(previa(page).getByText('Abertura').first()).toBeVisible()

    // Meio do trecho fixado: o relógio andou e a seção continua na tela.
    await rolarPara(page, topo + altura * 1.1)
    await expect(previa(page).getByText('20:45', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Sala de aula interativa' })).toBeInViewport()

    // Fim do trecho: encontro completo.
    await rolarPara(page, topo + altura * 2.2)
    await expect(previa(page).getByText('22:45', { exact: true })).toBeVisible()
    await expect(previa(page).getByText('+12')).toBeVisible()

    // E volta: rolar para cima retrocede a aula.
    await rolarPara(page, topo)
    await expect(previa(page).getByText('18:45', { exact: true })).toBeVisible()
  })

  test('ao fim da página, a prévia da sala mostra o encontro completo', async ({ page }) => {
    await abrir(page)
    await previa(page).scrollIntoViewIfNeeded()
    await rolarPara(page, 'fim')
    // Sem fixar (celular), a sequência toca sozinha por alguns segundos.
    await expect(previa(page).getByText('22:45', { exact: true })).toBeAttached({ timeout: 10_000 })
    await expect(previa(page).getByText('+12')).toBeAttached()
  })

  test('no hover, a frente em azul troca o texto para branco (Tinta sobre azul não passa em AA)', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'hover só existe com ponteiro fino')
    await abrir(page)
    const cor = (nome: RegExp) =>
      page.getByRole('link', { name: nome }).evaluate((el) => getComputedStyle(el.querySelector('h3')!).color)

    await page.getByRole('link', { name: /Conversar sobre palestra/ }).hover()
    await expect.poll(() => cor(/Conversar sobre palestra/)).toBe('rgb(255, 255, 255)')

    // Laranja e verde recebem texto em Tinta.
    await page.getByRole('link', { name: /Conversar sobre treinamento/ }).hover()
    await expect.poll(() => cor(/Conversar sobre treinamento/)).toBe('rgb(24, 26, 30)')
    await expect.poll(() => cor(/Conversar sobre palestra/)).toBe('rgb(24, 26, 30)')
  })

  test('o título dividido em letras continua com o nome inteiro para leitores de tela', async ({ page }) => {
    await abrir(page)
    const titulo = page.getByRole('heading', { level: 1 })
    await expect(titulo).toHaveAccessibleName('Vitor Ramos')
    // Os pedaços criados pela animação ficam fora da árvore de acessibilidade.
    const pedacosExpostos = await titulo.evaluate(
      (h1) => [...h1.querySelectorAll('div')].filter((d) => !d.closest('[aria-hidden="true"]')).length,
    )
    expect(pedacosExpostos).toBe(0)
  })

  test('com movimento reduzido, nada é fixado e a prévia já nasce completa', async ({ browser }) => {
    const contexto = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await contexto.newPage()
    await abrir(page)

    await expect(page.locator('.pin-spacer')).toHaveCount(0)
    await expect(previa(page).getByText('22:45', { exact: true })).toBeAttached()
    // Nenhum elemento fica transparente ou recortado por animação. O formulário fica de
    // fora: os controles do Radix têm campos nativos escondidos de propósito.
    const escondidos = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('main *, footer *')].filter(
        (el) => !el.closest('form') && (el.style.opacity === '0' || el.style.clipPath !== ''),
      ).length,
    )
    expect(escondidos).toBe(0)
    await contexto.close()
  })

  test('em 768 px as âncoras ficam no menu, que abre e leva à seção', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await abrir(page)
    await expect(page.getByRole('banner').getByRole('link', { name: 'Contato' })).toBeHidden()
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    const menu = page.getByRole('dialog')
    await menu.getByRole('link', { name: 'Sala de aula' }).click()
    await expect(menu).toBeHidden()
    await expect(page).toHaveURL(/#sala-de-aula$/)
    await expect(page.getByRole('heading', { level: 2, name: 'Sala de aula interativa' })).toBeInViewport()
  })

  for (const largura of [360, 768, 1920]) {
    test(`não há rolagem horizontal em ${largura} px, do topo ao fim`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 })
      await abrir(page)
      for (const ponto of [0, 0.25, 0.5, 0.75, 1]) {
        const sobra = await page.evaluate((fracao) => {
          window.scrollTo({ top: document.documentElement.scrollHeight * fracao, behavior: 'instant' })
          return document.documentElement.scrollWidth - document.documentElement.clientWidth
        }, ponto)
        expect(sobra, `sobra em ${Math.round(ponto * 100)} % da página`).toBeLessThanOrEqual(0)
      }
    })
  }
})
