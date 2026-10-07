// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONSULTAS, entrada, gsap, useMovimento, type Condicoes, type Seletor } from './movimento'
import { escolherNivel, iniciarNivelDeMovimento } from './nivelDeMovimento'

const REDUZ = '(prefers-reduced-motion: reduce)'

/** Faz o `matchMedia` do jsdom responder "sim" só para as consultas dadas e relê o nível. */
function simularConsultas(ativas: string[]) {
  vi.stubGlobal(
    'matchMedia',
    (consulta: string) =>
      ({
        matches: ativas.includes(consulta),
        media: consulta,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
  iniciarNivelDeMovimento()
}

type Montar = (condicoes: Condicoes, q: Seletor) => void | (() => void)

function Caixa({ montar }: { montar: Montar }) {
  const raiz = useRef<HTMLDivElement>(null)
  useMovimento(raiz, montar)
  return (
    <div>
      <p className="alvo">fora do escopo</p>
      <div ref={raiz}>
        <p className="alvo">dentro do escopo</p>
      </div>
    </div>
  )
}

afterEach(() => {
  cleanup()
  escolherNivel(null)
  window.localStorage.clear()
  vi.unstubAllGlobals()
  iniciarNivelDeMovimento()
})

describe('useMovimento', () => {
  it('não monta nada onde nenhuma consulta casa (ambiente de teste sem tela)', () => {
    simularConsultas([])
    const montar = vi.fn<Montar>()
    render(<Caixa montar={montar} />)
    expect(montar).not.toHaveBeenCalled()
  })

  it('no nível completo, monta com as condições da tela', () => {
    simularConsultas([CONSULTAS.tela, CONSULTAS.desktop])
    const montar = vi.fn<Montar>()
    render(<Caixa montar={montar} />)
    expect(montar).toHaveBeenCalledTimes(1)
    expect(montar.mock.calls[0][0]).toEqual({
      completo: true,
      essencial: false,
      desktop: true,
      alto: false,
      ponteiroFino: false,
    })
  })

  it('com o sistema pedindo redução, continua montando, no nível essencial', () => {
    simularConsultas([CONSULTAS.tela, REDUZ])
    const montar = vi.fn<Montar>()
    render(<Caixa montar={montar} />)
    expect(montar).toHaveBeenCalledTimes(1)
    expect(montar.mock.calls[0][0]).toMatchObject({ completo: false, essencial: true })
  })

  it('quando a pessoa escolhe "nenhum", desfaz o que havia e não monta de novo', () => {
    simularConsultas([CONSULTAS.tela])
    let alvo: HTMLElement | undefined
    const montar = vi.fn<Montar>((_c, q) => {
      alvo = q('.alvo')[0]
      gsap.set(alvo, { opacity: 0 })
    })
    render(<Caixa montar={montar} />)
    expect(alvo?.style.opacity).toBe('0')

    act(() => escolherNivel('nenhum'))
    expect(alvo?.style.opacity).toBe('')
    expect(montar).toHaveBeenCalledTimes(1)
  })

  it('trocar de nível refaz a montagem com as condições novas', () => {
    simularConsultas([CONSULTAS.tela])
    const montar = vi.fn<Montar>()
    render(<Caixa montar={montar} />)
    act(() => escolherNivel('essencial'))
    expect(montar).toHaveBeenCalledTimes(2)
    expect(montar.mock.calls[1][0]).toMatchObject({ completo: false, essencial: true })
  })

  it('o seletor só enxerga elementos dentro do escopo do componente', () => {
    simularConsultas([CONSULTAS.tela])
    let achados: HTMLElement[] = []
    render(<Caixa montar={(_c, q) => void (achados = q('.alvo'))} />)
    expect(achados.map((el) => el.textContent)).toEqual(['dentro do escopo'])
  })

  it('ao desmontar, desfaz os estilos aplicados e chama a limpeza', () => {
    simularConsultas([CONSULTAS.tela])
    const limpeza = vi.fn()
    let alvo: HTMLElement | undefined
    const { unmount } = render(
      <Caixa
        montar={(_c, q) => {
          alvo = q('.alvo')[0]
          gsap.set(alvo, { opacity: 0 })
          return limpeza
        }}
      />,
    )
    expect(alvo?.style.opacity).toBe('0')

    unmount()
    expect(alvo?.style.opacity).toBe('')
    expect(limpeza).toHaveBeenCalledTimes(1)
  })
})

describe('entrada', () => {
  it('no completo percorre a distância cheia; no essencial, no máximo 16 px e mais rápido', () => {
    expect(entrada({ completo: true }, { y: 80, duracao: 1.2 })).toEqual({ y: 80, duration: 1.2 })
    expect(entrada({ completo: false }, { y: 80, duracao: 1.2 })).toEqual({ y: 16, duration: 0.6 })
    expect(entrada({ completo: false }, { y: 8, duracao: 0.5 })).toEqual({ y: 8, duration: 0.35 })
  })
})
