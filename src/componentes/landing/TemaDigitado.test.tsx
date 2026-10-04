// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TemaDigitado } from './TemaDigitado'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function textoVisivel(container: HTMLElement): string {
  // Segundo span decorativo: o texto que está sendo "digitado".
  return container.querySelectorAll('[aria-hidden="true"]')[1]?.textContent ?? ''
}

describe('TemaDigitado', () => {
  it('digita o tema letra a letra e passa para o próximo depois da pausa', () => {
    const { container } = render(<TemaDigitado temas={['Dados', 'IA']} intervaloMs={1000} />)
    expect(textoVisivel(container)).toBe('')

    for (let i = 0; i < 5; i++) act(() => vi.advanceTimersByTime(70))
    expect(textoVisivel(container)).toBe('dados')

    act(() => vi.advanceTimersByTime(1000))
    for (let i = 0; i < 2; i++) act(() => vi.advanceTimersByTime(70))
    expect(textoVisivel(container)).toBe('ia')
  })

  it('volta ao primeiro tema depois do último', () => {
    const { container } = render(<TemaDigitado temas={['A', 'B']} intervaloMs={100} />)
    for (const _ of [0, 1, 2]) {
      act(() => vi.advanceTimersByTime(70))
      act(() => vi.advanceTimersByTime(100))
    }
    act(() => vi.advanceTimersByTime(70))
    expect(textoVisivel(container)).toBe('b')
  })

  it('entrega a lista inteira ao leitor de tela', () => {
    render(<TemaDigitado temas={['Dados', 'IA', 'Educação']} />)
    expect(screen.getByText('Dados, IA, Educação')).toBeTruthy()
  })
})
