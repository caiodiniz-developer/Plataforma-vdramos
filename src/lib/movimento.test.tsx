// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONSULTAS, gsap, useMovimento, type Condicoes, type Seletor } from './movimento'

const REDUZ = '(prefers-reduced-motion: reduce)'

/** Faz o `matchMedia` do jsdom responder "sim" só para as consultas dadas. */
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
  vi.unstubAllGlobals()
})

describe('useMovimento', () => {
  it('não monta nada onde nenhuma consulta casa (ambiente de teste sem tela)', () => {
    simularConsultas([])
    const montar = vi.fn<Montar>()
    render(<Caixa montar={montar} />)
    expect(montar).not.toHaveBeenCalled()
  })

  it('monta com as capacidades da tela', () => {
    simularConsultas([CONSULTAS.tela, CONSULTAS.desktop])
    const montar = vi.fn<Montar>()
    render(<Caixa montar={montar} />)
    expect(montar).toHaveBeenCalledTimes(1)
    expect(montar.mock.calls[0][0]).toEqual({ desktop: true, alto: false, ponteiroFino: false })
  })

  it('monta do mesmo jeito quando o sistema pede movimento reduzido (decisão do produto)', () => {
    simularConsultas([CONSULTAS.tela, CONSULTAS.desktop, CONSULTAS.alto, CONSULTAS.ponteiroFino, REDUZ])
    const montar = vi.fn<Montar>()
    render(<Caixa montar={montar} />)
    expect(montar).toHaveBeenCalledTimes(1)
    expect(montar.mock.calls[0][0]).toEqual({ desktop: true, alto: true, ponteiroFino: true })
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

  it('ao desmontar, devolve o texto de quem estava sendo embaralhado', () => {
    simularConsultas([CONSULTAS.tela])
    let alvo: HTMLElement | undefined
    const { unmount } = render(
      <Caixa
        montar={(_c, q) => {
          alvo = q('.alvo')[0]
          alvo.dataset.textoOriginal = 'dentro do escopo'
          alvo.textContent = '01<>/_#'
        }}
      />,
    )
    unmount()
    expect(alvo?.textContent).toBe('dentro do escopo')
    expect(alvo?.dataset.textoOriginal).toBeUndefined()
  })
})
