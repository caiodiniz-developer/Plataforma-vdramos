// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Revelar } from '@/componentes/Revelar'

type Callback = (entradas: { isIntersecting: boolean }[]) => void

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Revelar', () => {
  it('fica visível de imediato quando o navegador não tem IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<Revelar>Conteúdo</Revelar>)
    expect(screen.getByText('Conteúdo').getAttribute('data-visivel')).toBe('true')
  })

  it('revela quando o elemento entra na tela e para de observar', () => {
    let avisar: Callback = () => {}
    const desconectar = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: Callback) {
          avisar = callback
        }
        observe() {}
        disconnect = desconectar
      },
    )

    render(<Revelar atraso={120}>Conteúdo</Revelar>)
    const elemento = screen.getByText('Conteúdo')
    expect(elemento.getAttribute('data-visivel')).toBe('false')
    expect(elemento.style.transitionDelay).toBe('120ms')

    act(() => avisar([{ isIntersecting: true }]))
    expect(elemento.getAttribute('data-visivel')).toBe('true')
    expect(desconectar).toHaveBeenCalled()
  })
})
