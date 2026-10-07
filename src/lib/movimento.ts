import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import type { RefObject } from 'react'

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText)

/**
 * Consultas que decidem qual movimento a landing monta. `movimento` é a
 * principal: sem ela (a pessoa pediu menos movimento, ou o ambiente não tem
 * `matchMedia` de verdade, como nos testes de tela) nada é animado e o
 * conteúdo fica como o HTML e o CSS o desenham — sempre visível.
 */
export const CONSULTAS = {
  movimento: '(prefers-reduced-motion: no-preference)',
  desktop: '(min-width: 1024px)',
  // Altura mínima para fixar uma seção inteira na tela sem cortar conteúdo.
  alto: '(min-height: 740px)',
} as const

export type Condicoes = Record<keyof typeof CONSULTAS, boolean>

/**
 * Monta animações do GSAP dentro de `escopo` (os seletores em texto só
 * enxergam o que está dentro dele) e desfaz tudo — tweens, ScrollTriggers,
 * `pin-spacer` e textos divididos — quando o componente sai da tela, quando
 * uma das consultas muda ou quando uma dependência muda.
 *
 * O estado escondido de cada elemento é aplicado pelo próprio GSAP. Se este
 * código não rodar, nada fica invisível.
 */
export function useMovimento(
  escopo: RefObject<HTMLElement | null>,
  montar: (condicoes: Condicoes) => void,
  dependencias: unknown[] = [],
) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(
        CONSULTAS,
        (contexto) => {
          const condicoes = contexto.conditions as Condicoes
          if (condicoes.movimento) montar(condicoes)
        },
        escopo.current ?? undefined,
      )
    },
    { scope: escopo, dependencies: dependencias, revertOnUpdate: true },
  )
}

/** Estado aberto de um recorte retangular (destino dos reveals por `clip-path`). */
export const RECORTE_ABERTO = 'inset(0% 0% 0% 0%)'

export { gsap, ScrollTrigger, SplitText, useGSAP }
