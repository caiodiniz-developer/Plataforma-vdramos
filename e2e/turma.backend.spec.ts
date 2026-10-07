import { expect, test } from '@playwright/test'
import { cenarioPadrao, CODIGO, respostasDe } from './apoio/dados'
import { simularSupabase } from './apoio/supabase'

test.describe('página da turma (aluno)', () => {
  test('carrega o cabeçalho, o calendário com o próximo encontro e a régua', async ({ page }) => {
    const cenario = cenarioPadrao({ statusDaSessao: 'agendada' })
    const api = await simularSupabase(page, respostasDe(cenario), cenario.usuario)

    await page.goto(`/aluno/turmas/${CODIGO}`)

    await expect(page.getByRole('heading', { level: 1, name: 'Excel Básico com IA Generativa' })).toBeVisible()
    await expect(page.getByText(/SENAI · Campinas · Presencial · 14\/10\/2026 a 28\/10\/2026 · 20 vagas/)).toBeVisible()
    await expect(page.getByText('Próximo encontro')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Régua do encontro' })).toBeVisible()
    await expect(page.getByRole('row', { name: /19:00 60 Teoria Conceitos do encontro/ })).toBeVisible()
    await expect(page.getByText('Aula ao vivo agora')).toBeHidden()
    expect(api.naoTratadas).toEqual([])
  })
})
