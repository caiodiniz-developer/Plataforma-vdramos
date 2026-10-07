import { expect, test, type Browser, type Page } from '@playwright/test'

/**
 * Movimento da landing (GSAP, ScrollTrigger e Lenis) num navegador real: o que
 * a animação não pode quebrar. Níveis de movimento e o controle que os troca,
 * âncoras, rolagem suave, limpeza ao trocar de rota, a aula que passa com a
 * rolagem e a largura da página.
 */
const previa = (page: Page) => page.getByRole('group', { name: 'Prévia ilustrativa da sala de aula' })
const fixadores = (page: Page) => page.locator('.pin-spacer')
const nivelNoHtml = (page: Page) => page.locator('html')

async function abrir(page: Page, endereco = '/') {
  await page.goto(endereco)
  await expect(page.getByRole('heading', { level: 1, name: 'Vitor Ramos' })).toBeVisible()
  // No nível completo, a primeira carga da sessão tem a abertura: espera a cortina sair.
  await expect(page.locator('[data-abertura]')).toHaveCount(0)
}

/** Página nova com o sistema pedindo movimento reduzido. */
async function abrirComSistemaReduzido(browser: Browser) {
  const contexto = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await contexto.newPage()
  await abrir(page)
  return { contexto, page }
}

/** Rola direto para um ponto, sem suavização. */
async function rolarPara(page: Page, y: number | 'fim') {
  await page.evaluate((alvo) => {
    const topo = alvo === 'fim' ? document.documentElement.scrollHeight : alvo
    window.scrollTo({ top: topo, behavior: 'instant' })
  }, y)
}

test.describe('níveis de movimento', () => {
  test('sem pedido do sistema, o nível é completo', async ({ page }) => {
    await abrir(page)
    await expect(nivelNoHtml(page)).toHaveAttribute('data-movimento', 'completo')
    await expect(page.getByRole('button', { name: 'Animações completas', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('com o sistema em redução, o padrão é essencial e a pessoa liga o completo pelo controle', async ({
    browser,
  }) => {
    const { contexto, page } = await abrirComSistemaReduzido(browser)
    const completas = page.getByRole('button', { name: 'Animações completas', exact: true })
    const essenciais = page.getByRole('button', { name: 'Animações essenciais', exact: true })

    await expect(nivelNoHtml(page)).toHaveAttribute('data-movimento', 'essencial')
    await expect(essenciais).toHaveAttribute('aria-pressed', 'true')
    await expect(completas).toHaveAttribute('aria-pressed', 'false')

    await completas.click()
    await expect(nivelNoHtml(page)).toHaveAttribute('data-movimento', 'completo')
    await expect(completas).toHaveAttribute('aria-pressed', 'true')

    // A escolha vence o sistema e continua valendo depois de recarregar.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Vitor Ramos' })).toBeVisible()
    await expect(nivelNoHtml(page)).toHaveAttribute('data-movimento', 'completo')
    expect(await page.evaluate(() => window.localStorage.getItem('vr:movimento'))).toBe('completo')
    await contexto.close()
  })

  test('no topo do hero há um atalho para ligar as animações completas quando o sistema reduz', async ({
    browser,
  }) => {
    const { contexto, page } = await abrirComSistemaReduzido(browser)
    const atalho = page.getByRole('button', { name: 'Ligar animações completas' })
    await atalho.click()
    await expect(nivelNoHtml(page)).toHaveAttribute('data-movimento', 'completo')
    // Depois da escolha, o atalho sai: o controle do rodapé continua lá.
    await expect(atalho).toHaveCount(0)
    await contexto.close()
  })

  test('desligar as animações desfaz tudo na hora: nada fixado, nada escondido', async ({ page }) => {
    await abrir(page)
    await page.getByRole('button', { name: 'Animações desligadas', exact: true }).click()
    await expect(nivelNoHtml(page)).toHaveAttribute('data-movimento', 'nenhum')
    await expect(fixadores(page)).toHaveCount(0)
    await expect(previa(page).getByText('22:45', { exact: true })).toBeAttached()
    // O formulário fica de fora: os controles do Radix têm campos nativos escondidos de propósito.
    const escondidos = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>('main *, footer *')].filter(
          (el) => !el.closest('form') && (el.style.opacity === '0' || el.style.clipPath !== '' || el.style.transform !== ''),
        ).length,
    )
    expect(escondidos).toBe(0)
  })

  test('no nível essencial, a prévia da sala toca sozinha e termina completa, sem fixar a seção', async ({
    browser,
  }) => {
    const { contexto, page } = await abrirComSistemaReduzido(browser)
    await previa(page).scrollIntoViewIfNeeded()
    await expect(previa(page).getByText('22:45', { exact: true })).toBeAttached({ timeout: 10_000 })
    await expect(previa(page).getByText('+12')).toBeAttached()
    await expect(fixadores(page)).toHaveCount(0)
    await contexto.close()
  })
})

test.describe('movimento da landing (nível completo)', () => {
  test('a abertura aparece só na primeira carga da sessão e pode ser pulada', async ({ page }) => {
    await page.goto('/')
    const cortina = page.locator('[data-abertura]')
    await expect(cortina).toBeVisible()
    // O conteúdo já está montado por baixo, para leitor de tela e para quem pular.
    await expect(page.getByRole('heading', { level: 1, name: 'Vitor Ramos' })).toBeAttached()
    await page.keyboard.press('Escape')
    await expect(cortina).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Vitor Ramos' })).toBeVisible()
    await expect(cortina).toHaveCount(0)
  })

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

  test('com ponteiro fino, a roda do mouse passa pela rolagem suave e a página anda', async ({ page, isMobile }) => {
    test.skip(isMobile, 'a rolagem suave só liga com ponteiro fino')
    await abrir(page)
    await expect(page.locator('html')).toHaveClass(/lenis/)
    // Só a rolagem suave cancela o evento da roda: é o que a distingue da rolagem nativa.
    await page.evaluate(() => {
      const janela = window as unknown as { rodaCancelada?: boolean }
      window.addEventListener('wheel', (evento) => (janela.rodaCancelada = evento.defaultPrevented), { passive: true })
    })
    await page.mouse.move(700, 450)
    await page.mouse.wheel(0, 600)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300)
    expect(await page.evaluate(() => (window as unknown as { rodaCancelada?: boolean }).rodaCancelada)).toBe(true)
  })

  test('a lista do campo Assunto rola por dentro, sem levar a página junto', async ({ page, isMobile }) => {
    test.skip(isMobile, 'a rolagem suave só liga com ponteiro fino')
    await abrir(page, '/#contato')
    await page.getByRole('combobox', { name: 'Assunto' }).click()
    const lista = page.getByRole('listbox')
    await expect(lista).toBeVisible()
    const antes = await page.evaluate(() => window.scrollY)
    await lista.hover()
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(400)
    expect(await page.evaluate(() => window.scrollY)).toBe(antes)
    await page.getByRole('option', { name: 'Palestra' }).click()
    await expect(page.getByRole('combobox', { name: 'Assunto' })).toHaveText('Palestra')
  })

  test('voltar ao topo funciona com a rolagem suave', async ({ page }) => {
    await abrir(page)
    await rolarPara(page, 'fim')
    await page.getByRole('button', { name: 'Voltar ao topo' }).click()
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBeLessThan(5)
  })

  test('sair da landing e voltar não deixa seção fixada órfã nem duplica', async ({ page }) => {
    await abrir(page)
    const iniciais = await fixadores(page).count()

    for (let volta = 0; volta < 2; volta++) {
      await page.getByRole('contentinfo').getByRole('link', { name: 'Privacidade' }).click()
      await expect(page).toHaveURL('/privacidade')
      await expect(fixadores(page)).toHaveCount(0)
      // A rolagem suave pertence à landing: fora dela, a página rola nativa.
      await expect(page.locator('html')).not.toHaveClass(/lenis/)

      await page.goBack()
      await expect(page.getByRole('heading', { level: 1, name: 'Vitor Ramos' })).toBeVisible()
      await expect(fixadores(page)).toHaveCount(iniciais)
    }

    // A página volta inteira: um único h1 e o contato alcançável.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await rolarPara(page, 'fim')
    await expect(page.getByRole('heading', { level: 2, name: 'Contato' })).toBeAttached()
  })

  test('no desktop, a seção da sala fica fixa e a rolagem faz a aula passar', async ({ page, isMobile }) => {
    test.skip(isMobile, 'a seção só é fixada em telas largas e altas')
    await abrir(page)
    await expect(fixadores(page)).toHaveCount(1)

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

  test('as frentes são painéis em cor cheia: branco sobre azul, Tinta sobre laranja e verde', async ({ page }) => {
    await abrir(page)
    const cores = (nome: RegExp) =>
      page.getByRole('link', { name: nome }).evaluate((el) => {
        const estilo = getComputedStyle(el)
        return { texto: estilo.color, fundo: estilo.backgroundColor }
      })
    expect(await cores(/Conversar sobre palestra/)).toEqual({ texto: 'rgb(255, 255, 255)', fundo: 'rgb(47, 111, 237)' })
    expect(await cores(/Conversar sobre treinamento/)).toEqual({ texto: 'rgb(24, 26, 30)', fundo: 'rgb(217, 113, 28)' })
    expect(await cores(/Conversar sobre consultoria/)).toEqual({ texto: 'rgb(24, 26, 30)', fundo: 'rgb(31, 157, 85)' })
  })

  test('com os painéis empilhados, o foco por teclado traz o painel coberto de volta à tela', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'os painéis só empilham em telas largas')
    await abrir(page)
    const palestra = page.getByRole('link', { name: /Conversar sobre palestra/ })
    const consultoria = page.getByRole('link', { name: /Conversar sobre consultoria/ })
    // Rola até o último painel: o primeiro fica grudado por baixo, coberto.
    await consultoria.scrollIntoViewIfNeeded()
    await consultoria.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(palestra).toBeFocused()
    // O texto do painel focado é o que está por cima no ponto em que ele aparece.
    await expect
      .poll(() =>
        palestra.evaluate((el) => {
          const caixa = el.querySelector('h3')!.getBoundingClientRect()
          const noPonto = document.elementFromPoint(caixa.left + 20, caixa.top + caixa.height / 2)
          return Boolean(noPonto && el.contains(noPonto))
        }),
      )
      .toBe(true)
  })

  test('o cursor decorativo mostra a etiqueta sobre uma frente e some dentro de um campo', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'o cursor decorativo só existe com ponteiro fino')
    await abrir(page)
    const etiqueta = page.locator('[data-etiqueta]')
    const consultoria = page.getByRole('link', { name: /Conversar sobre consultoria/ })
    await consultoria.scrollIntoViewIfNeeded()
    await consultoria.hover()
    await expect(etiqueta).toHaveText('Conversar')
    await expect.poll(() => etiqueta.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(40)

    // Dentro de um campo vale só o cursor do sistema.
    const nome = page.getByLabel('Nome')
    await nome.scrollIntoViewIfNeeded()
    await nome.hover()
    await expect
      .poll(() => etiqueta.evaluate((el) => Number(getComputedStyle(el.parentElement!).opacity)))
      .toBe(0)
    // E o cursor do sistema nunca é escondido.
    expect(await nome.evaluate((el) => getComputedStyle(el).cursor)).not.toBe('none')
    expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).not.toBe('none')
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

  for (const largura of [360, 768, 1366, 1920]) {
    test(`não há rolagem horizontal em ${largura} px, do topo ao fim`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 1366 ? 768 : 900 })
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
