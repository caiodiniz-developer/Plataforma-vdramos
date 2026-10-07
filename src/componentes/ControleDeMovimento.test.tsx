// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHAVE_DA_ESCOLHA, escolherNivel, iniciarNivelDeMovimento } from '@/lib/nivelDeMovimento'
import { ControleDeMovimento } from './ControleDeMovimento'

function sistema(pedeReducao: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: pedeReducao && consulta.includes('reduce'),
    media: consulta,
    addEventListener() {},
    removeEventListener() {},
  }))
  iniciarNivelDeMovimento()
}

const pressionado = (nome: string) => screen.getByRole('button', { name: nome }).getAttribute('aria-pressed')

afterEach(() => {
  cleanup()
  escolherNivel(null)
  window.localStorage.clear()
  vi.unstubAllGlobals()
  iniciarNivelDeMovimento()
})

describe('ControleDeMovimento', () => {
  it('é um grupo nomeado com as três opções', () => {
    sistema(false)
    render(<ControleDeMovimento />)
    const grupo = screen.getByRole('group', { name: 'Animações' })
    expect(within(grupo).getAllByRole('button')).toHaveLength(3)
  })

  it('sem escolha, mostra o nível que veio do sistema', () => {
    sistema(true)
    render(<ControleDeMovimento />)
    expect(pressionado('Animações essenciais')).toBe('true')
    expect(pressionado('Animações completas')).toBe('false')
    expect(pressionado('Animações desligadas')).toBe('false')
  })

  it('com o sistema em redução, a pessoa liga as animações completas e a escolha fica guardada', async () => {
    sistema(true)
    render(<ControleDeMovimento />)

    await userEvent.click(screen.getByRole('button', { name: 'Animações completas' }))

    expect(pressionado('Animações completas')).toBe('true')
    expect(pressionado('Animações essenciais')).toBe('false')
    expect(document.documentElement.dataset.movimento).toBe('completo')
    expect(window.localStorage.getItem(CHAVE_DA_ESCOLHA)).toBe('completo')
  })

  it('também permite desligar tudo', async () => {
    sistema(false)
    render(<ControleDeMovimento />)
    await userEvent.click(screen.getByRole('button', { name: 'Animações desligadas' }))
    expect(pressionado('Animações desligadas')).toBe('true')
    expect(document.documentElement.dataset.movimento).toBe('nenhum')
  })
})
