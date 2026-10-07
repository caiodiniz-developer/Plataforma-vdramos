import { expect, test } from '@playwright/test'

/**
 * Comportamento da landing num navegador real. Os seletores usam papéis e
 * textos (o que a pessoa vê), não classes: valem para qualquer redesenho.
 */
test.describe('landing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Vitor Ramos' })).toBeVisible()
  })

  test('mostra a frase de apresentação do guia de marca', async ({ page }) => {
    await expect(page.getByText(/Construindo produtos e educação em dados e inteligência artificial/).first()).toBeVisible()
  })

  test('tem um único h1 e os títulos de seção esperados', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    for (const titulo of ['Frentes de trabalho', 'Sala de aula interativa', 'Contato']) {
      await expect(page.getByRole('heading', { level: 2, name: titulo })).toBeAttached()
    }
  })

  test('o formulário de contato bloqueia o envio vazio e aponta cada campo', async ({ page }) => {
    await page.getByRole('button', { name: 'Enviar mensagem' }).click()
    await expect(page.getByText('Informe seu nome.')).toBeVisible()
    await expect(page.getByText('Informe seu e-mail.')).toBeVisible()
    await expect(page.getByText('Escolha um assunto.')).toBeVisible()
    await expect(page.getByText('Confirme a leitura da política de privacidade.')).toBeVisible()
  })

  test('assunto "Outro" abre o campo de texto livre e ele é obrigatório', async ({ page }) => {
    await page.getByLabel('Nome').fill('Ana Souza')
    await page.getByLabel('E-mail').fill('ana@empresa.com')
    await page.getByRole('combobox', { name: 'Assunto' }).click()
    await page.getByRole('option', { name: 'Outro' }).click()
    await expect(page.getByLabel('Qual assunto?')).toBeVisible()
    await page.getByLabel('Mensagem').fill('Quero conversar sobre uma mentoria.')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Enviar mensagem' }).click()
    await expect(page.getByText('Descreva o assunto.')).toBeVisible()
  })

  test('sem backend, o envio falha com aviso e mantém o que foi digitado', async ({ page }) => {
    await page.getByLabel('Nome').fill('Ana Souza')
    await page.getByLabel('E-mail').fill('ana@empresa.com')
    await page.getByRole('combobox', { name: 'Assunto' }).click()
    await page.getByRole('option', { name: 'Treinamento' }).click()
    await page.getByLabel('Mensagem').fill('Gostaria de um treinamento de Excel para a equipe.')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Enviar mensagem' }).click()

    await expect(page.getByText(/backend ainda não foi configurado/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
    // Nada é marcado como enviado antes da confirmação do servidor.
    await expect(page.getByLabel('Nome')).toHaveValue('Ana Souza')
    await expect(page.getByLabel('Mensagem')).toHaveValue('Gostaria de um treinamento de Excel para a equipe.')
  })

  test('escolher uma frente de trabalho leva ao contato com o assunto preenchido', async ({ page }) => {
    await page.getByRole('link', { name: /Conversar sobre consultoria/ }).click()
    await expect(page).toHaveURL(/#contato$/)
    await expect(page.getByRole('combobox', { name: 'Assunto' })).toHaveText('Consultoria')
  })

  test('o link de privacidade do formulário e o do rodapé funcionam', async ({ page }) => {
    await page.getByRole('contentinfo').getByRole('link', { name: 'Privacidade' }).click()
    await expect(page).toHaveURL('/privacidade')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacidade e termo de uso')
  })

  test('a área do aluno é alcançável pela landing', async ({ page }) => {
    await page.getByRole('link', { name: 'Entrar na área do aluno' }).click()
    await expect(page).toHaveURL('/aluno/entrar')
  })

  test('não há rolagem horizontal', async ({ page }) => {
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(sobra).toBeLessThanOrEqual(0)
  })

  test('todas as imagens carregam e têm texto alternativo', async ({ page }) => {
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight / 2) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 100))
      }
    })
    await page.waitForLoadState('networkidle')
    const imagens = await page.locator('img').evaluateAll((lista) =>
      (lista as HTMLImageElement[]).map((img) => ({
        src: img.getAttribute('src'),
        carregou: img.complete && img.naturalWidth > 0,
        alt: img.getAttribute('alt'),
      })),
    )
    expect(imagens.length).toBeGreaterThan(0)
    for (const img of imagens) {
      expect(img.carregou, `não carregou: ${img.src}`).toBe(true)
      expect(img.alt, `sem alt: ${img.src}`).not.toBeNull()
    }
  })

  /** Menor opacidade entre o elemento e todos os seus ancestrais. */
  const opacidadeEfetiva = (el: Element) => {
    let no: Element | null = el
    let menor = 1
    while (no) {
      menor = Math.min(menor, Number(getComputedStyle(no).opacity))
      no = no.parentElement
    }
    return menor
  }

  test('com movimento reduzido no sistema, a landing anima por inteiro e nada fica escondido depois de rolar', async ({
    browser,
  }) => {
    // Decisão do dono: a landing não reduz o movimento a pedido do sistema, e uma
    // escolha de nível guardada por uma versão anterior não prende ninguém.
    const contexto = await browser.newContext({ reducedMotion: 'reduce' })
    await contexto.addInitScript(() => window.localStorage.setItem('vr:movimento', 'nenhum'))
    const page = await contexto.newPage()
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Vitor Ramos' })).toBeVisible()
    expect(await page.evaluate(() => window.localStorage.getItem('vr:movimento'))).toBeNull()

    // Depois de rolar até cada parte, todo conteúdo está visível: nada preso em opacidade 0.
    await page.evaluate(async () => {
      for (let y = 0; y <= document.documentElement.scrollHeight; y += window.innerHeight / 2) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 120))
      }
    })
    for (const titulo of ['Frentes de trabalho', 'Sala de aula interativa', 'Contato']) {
      await expect
        .poll(() => page.getByRole('heading', { level: 2, name: titulo }).evaluate(opacidadeEfetiva))
        .toBe(1)
    }
    await expect
      .poll(() =>
        page.locator('main *, footer *').evaluateAll(
          (lista) =>
            lista.filter((el) => !el.closest('form, .animate-pulse') && Number(getComputedStyle(el).opacity) < 1).length,
        ),
      )
      .toBe(0)
    await contexto.close()
  })
})

test.describe('landing no celular', () => {
  test.skip(({ isMobile }) => !isMobile, 'só no projeto de celular')

  test('o menu abre, navega para a seção e fecha', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    const menu = page.getByRole('dialog')
    await expect(menu).toBeVisible()
    await menu.getByRole('link', { name: 'Contato' }).click()
    await expect(menu).toBeHidden()
    await expect(page).toHaveURL(/#contato$/)
  })
})
