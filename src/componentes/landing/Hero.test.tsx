// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PERFIL_PUBLICO_PADRAO } from '@/conteudo/padrao'
import { escolherNivel, iniciarNivelDeMovimento } from '@/lib/nivelDeMovimento'
import { Hero } from './Hero'

/** Só a consulta de movimento reduzido casa: o nível muda, mas nenhuma animação é montada. */
function sistema(pedeReducao: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: pedeReducao && consulta.includes('reduce'),
    media: consulta,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }))
  iniciarNivelDeMovimento()
}

const atalho = () => screen.queryByRole('button', { name: 'Ligar animações completas' })

afterEach(() => {
  cleanup()
  escolherNivel(null)
  window.localStorage.clear()
  vi.unstubAllGlobals()
  iniciarNivelDeMovimento()
})

describe('Hero — atalho para as animações completas', () => {
  it('não aparece quando o sistema não pede redução', () => {
    sistema(false)
    render(<Hero perfil={PERFIL_PUBLICO_PADRAO} />)
    expect(atalho()).toBeNull()
  })

  it('aparece quando o sistema pede redução e a pessoa ainda não escolheu', () => {
    sistema(true)
    render(<Hero perfil={PERFIL_PUBLICO_PADRAO} />)
    expect(atalho()).toBeTruthy()
  })

  it('some depois da escolha, qualquer que seja ela', async () => {
    sistema(true)
    render(<Hero perfil={PERFIL_PUBLICO_PADRAO} />)
    await userEvent.click(atalho()!)
    expect(document.documentElement.dataset.movimento).toBe('completo')
    expect(atalho()).toBeNull()
  })

  it('não aparece se a pessoa já tinha escolhido ficar no essencial', () => {
    sistema(true)
    escolherNivel('essencial')
    render(<Hero perfil={PERFIL_PUBLICO_PADRAO} />)
    expect(atalho()).toBeNull()
  })
})
