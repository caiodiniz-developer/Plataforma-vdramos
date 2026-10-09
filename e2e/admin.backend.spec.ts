import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { cenarioPadrao, CODIGO, questaoDoProfessor, respostasDe } from './apoio/dados'
import { ANA, PROFESSOR, SENHA_DE_TESTE, simularSupabase } from './apoio/supabase'

async function semViolacoesDeAcessibilidade(page: Page) {
  const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(
    resultado.violations.map((v) => ({ regra: v.id, onde: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) })),
  ).toEqual([])
}

/** Nada passa da largura da tela (vale principalmente no celular). */
async function cabeNaTela(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
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

  test('questões: nascem ocultas, a chave libera uma e o botão geral libera todas', async ({ page }) => {
    const cenario = cenarioPadrao({
      usuario: PROFESSOR,
      atividades: [questaoDoProfessor(), questaoDoProfessor({ id: 'dddddddd-0000-4000-8000-000000000011', titulo: 'Soma simples' })],
    })
    const api = await simularSupabase(page, respostasDe(cenario), PROFESSOR)
    await page.goto('/admin/questoes')

    const primeira = page.getByRole('listitem').filter({ hasText: 'Referência absoluta' })
    await expect(primeira.getByText('Oculta').first()).toBeVisible()
    await semViolacoesDeAcessibilidade(page)
    await cabeNaTela(page)

    await primeira.getByRole('switch', { name: 'Referência absoluta: visível para os alunos' }).click()
    await expect.poll(() => api.enviadas('rpc/definir_visibilidade').length).toBe(1)
    expect(api.enviadas('rpc/definir_visibilidade')[0].corpo).toEqual({ p_ids: ['dddddddd-0000-4000-8000-000000000010'], p_visivel: true })

    await page.getByRole('button', { name: 'Liberar todas' }).click()
    const confirmacao = page.getByRole('alertdialog')
    await expect(confirmacao).toContainText('Liberar 2 questões?')
    await confirmacao.getByRole('button', { name: 'Liberar todas' }).click()
    await expect.poll(() => api.enviadas('rpc/definir_visibilidade').length).toBe(2)
    expect((api.enviadas('rpc/definir_visibilidade')[1].corpo as { p_ids: string[]; p_visivel: boolean }).p_ids).toHaveLength(2)

    // Nova questão: o botão principal salva oculta; liberar é a opção ao lado.
    await page.getByRole('button', { name: 'Nova questão' }).click()
    await expect(page.getByRole('button', { name: 'Salvar oculta' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salvar e liberar' })).toBeVisible()
  })

  test('filtros por instituição e turma em conteúdos, atividades e questões', async ({ page }) => {
    const cenario = cenarioPadrao({ usuario: PROFESSOR, atividades: [questaoDoProfessor()] })
    await simularSupabase(page, respostasDe(cenario), PROFESSOR)
    for (const rota of ['conteudos', 'atividades', 'questoes']) {
      await page.goto(`/admin/${rota}`)
      await expect(page.getByRole('combobox', { name: 'Filtrar por instituição' })).toBeVisible()
      await page.getByRole('combobox', { name: 'Filtrar por turma' }).click()
      await expect(page.getByRole('option', { name: CODIGO })).toBeVisible()
      await page.keyboard.press('Escape')
    }
    await page.goto('/admin/conteudos')
    await page.getByRole('combobox', { name: 'Filtrar por instituição' }).click()
    await page.getByRole('option', { name: 'SENAI' }).click()
    await expect(page.getByRole('heading', { name: 'Tabelas dinâmicas na prática' })).toBeVisible()
  })

  test('aviso para várias turmas, com link e pedido de envio por e-mail', async ({ page }) => {
    const cenario = cenarioPadrao({ usuario: PROFESSOR })
    const api = await simularSupabase(page, respostasDe(cenario), PROFESSOR)
    await page.goto('/admin/avisos')
    await page.getByRole('button', { name: 'Novo aviso' }).click()

    await page.getByRole('radio', { name: 'Escolher turmas' }).click()
    await page.getByRole('button', { name: 'Publicar aviso' }).click()
    await expect(page.getByRole('alert')).toContainText('Escolha ao menos uma turma.')

    await expect(page.getByRole('combobox', { name: 'Filtrar turmas por instituição' })).toBeVisible()
    await page.getByRole('checkbox', { name: CODIGO }).check()
    await page.getByLabel('Título').fill('Material novo')
    await page.getByLabel('Aviso', { exact: true }).fill('Veja https://exemplo.com/material')
    await page.getByRole('checkbox', { name: 'Enviar também por e-mail' }).check()
    await semViolacoesDeAcessibilidade(page)
    await cabeNaTela(page)
    await page.getByRole('button', { name: 'Publicar aviso' }).click()

    await expect.poll(() => api.enviadas('/rest/v1/aviso').length).toBe(1)
    const linhas = api.enviadas('/rest/v1/aviso')[0].corpo as { turma_id: string; lote_id: string; titulo: string }[]
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({ titulo: 'Material novo', turma_id: 'aaaaaaaa-0000-4000-8000-000000000001' })
    // O envio por e-mail usa o lote do aviso recém-publicado.
    await expect.poll(() => api.enviadas('enviar-aviso').length).toBe(1)
    expect(api.enviadas('enviar-aviso')[0].corpo).toEqual({ lote_id: linhas[0].lote_id })
    await expect(page.getByText('E-mail ainda não configurado')).toBeVisible()
  })

  test('alunos: o cadastro já pode colocar o aluno em mais de uma turma', async ({ page }) => {
    const cenario = cenarioPadrao({ usuario: PROFESSOR })
    const respostas = respostasDe(cenario)
    const resumo = respostas.tabelas!.vw_turma_resumo
    respostas.tabelas!.vw_turma_resumo = (chamada) => [
      ...resumo(chamada),
      { ...resumo(chamada)[0], id: 'aaaaaaaa-0000-4000-8000-000000000002', codigo: 'TURMA-002' },
    ]
    respostas.funcoes = { ...respostas.funcoes, 'admin-alunos': () => ({ aluno_autorizado_id: 'novo-id', conta_criada: false }) }
    const api = await simularSupabase(page, respostas, PROFESSOR)
    await page.goto('/admin/alunos')

    await page.getByRole('button', { name: 'Novo aluno' }).click()
    await page.getByLabel('Nome completo').fill('Bruno Lima')
    await page.getByLabel('ID do aluno').fill('aluno-0003')
    await page.getByRole('group', { name: 'Também nestas turmas (opcional)' }).getByRole('checkbox', { name: 'TURMA-002' }).check()
    await semViolacoesDeAcessibilidade(page)
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByText('Aluno criado em 2 turmas')).toBeVisible()
    expect(api.enviadas('admin-alunos')[0].corpo).toMatchObject({ acao: 'criar', turma_id: 'aaaaaaaa-0000-4000-8000-000000000001' })
    expect(api.enviadas('rpc/matricular_em_turma')[0].corpo).toEqual({
      p_aluno_autorizado_id: 'novo-id',
      p_turma_id: 'aaaaaaaa-0000-4000-8000-000000000002',
    })
  })

  test('alunos: adicionar a outra turma chama a função do banco', async ({ page }) => {
    const cenario = cenarioPadrao({ usuario: PROFESSOR })
    const respostas = respostasDe(cenario)
    // Uma segunda turma, para haver para onde adicionar.
    const resumo = respostas.tabelas!.vw_turma_resumo
    respostas.tabelas!.vw_turma_resumo = (chamada) => [
      ...resumo(chamada),
      { ...resumo(chamada)[0], id: 'aaaaaaaa-0000-4000-8000-000000000002', codigo: 'TURMA-002' },
    ]
    const api = await simularSupabase(page, respostas, PROFESSOR)
    await page.goto('/admin/alunos')

    await page.getByRole('row', { name: /Ana Souza/ }).getByRole('button', { name: 'Ações de Ana Souza' }).click()
    await page.getByRole('menuitem', { name: 'Adicionar a outra turma' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Adicionar a outra turma' })
    await expect(dialogo.getByRole('combobox')).toContainText('TURMA-002')
    await dialogo.getByRole('button', { name: 'Adicionar' }).click()
    await expect.poll(() => api.enviadas('rpc/matricular_em_turma').length).toBe(1)
    expect(api.enviadas('rpc/matricular_em_turma')[0].corpo).toEqual({
      p_aluno_autorizado_id: 'aa000000-0000-4000-8000-000000000001',
      p_turma_id: 'aaaaaaaa-0000-4000-8000-000000000002',
    })
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
