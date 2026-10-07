import Lenis from 'lenis'
import { gsap, ScrollTrigger } from './movimento'

/**
 * Rolagem suave (Lenis), ligada só no nível completo e com ponteiro fino. O
 * Lenis suaviza a roda do mouse e continua usando a rolagem da própria janela:
 * teclado, foco, barra de rolagem e toque seguem nativos.
 *
 * Fora do caminho do Lenis ficam as listas e os painéis do Radix (lista do
 * `Select`, menu em `Sheet`, diálogos) e qualquer momento em que o corpo da
 * página está travado por um deles: ali a rolagem é a nativa do componente.
 */
let lenis: Lenis | null = null

/** Altura do cabeçalho fixo: as âncoras param logo abaixo dele. */
export const ALTURA_DO_CABECALHO = 64

const SELETOR_NATIVO = '[role="listbox"], [role="dialog"], [data-radix-popper-content-wrapper], [data-lenis-prevent]'

export function ligarRolagemSuave(): () => void {
  if (lenis) return () => {}
  const instancia = new Lenis({
    lerp: 0.09,
    smoothWheel: true,
    syncTouch: false,
    wheelMultiplier: 1,
    autoRaf: false,
    prevent: (no) => document.body.hasAttribute('data-scroll-locked') || no.closest(SELETOR_NATIVO) !== null,
  })
  lenis = instancia

  const avancar = (tempo: number) => instancia.raf(tempo * 1000)
  instancia.on('scroll', ScrollTrigger.update)
  gsap.ticker.add(avancar)
  gsap.ticker.lagSmoothing(0)

  return () => {
    gsap.ticker.remove(avancar)
    gsap.ticker.lagSmoothing(500, 33)
    instancia.destroy()
    if (lenis === instancia) lenis = null
  }
}

export function rolagemSuaveAtiva(): boolean {
  return lenis !== null
}

/**
 * Leva a página até um elemento ou posição. Com o Lenis ligado, passa por ele
 * (a âncora nativa brigaria com a suavização); sem ele, usa a rolagem nativa.
 */
export function rolarAte(alvo: HTMLElement | number, deslocamento = 0) {
  if (lenis) {
    lenis.scrollTo(alvo, { offset: deslocamento })
    return
  }
  const topo = typeof alvo === 'number' ? alvo : alvo.getBoundingClientRect().top + window.scrollY
  window.scrollTo({ top: topo + deslocamento })
}
