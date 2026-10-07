import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import type { RefObject } from 'react'
import { useNivelDeMovimento } from './nivelDeMovimento'

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, ScrambleTextPlugin)

/**
 * Consultas de tela que ajustam o movimento. `tela` casa em qualquer navegador
 * de verdade: garante que a montagem rode mesmo quando nenhuma das outras
 * casa (celular em pé, por exemplo). Onde `matchMedia` é só um simulacro que
 * nunca casa — os testes de tela no jsdom — nada é montado.
 */
export const CONSULTAS = {
  tela: 'all',
  desktop: '(min-width: 1024px)',
  // Altura mínima para fixar uma seção inteira na tela sem cortar conteúdo.
  alto: '(min-height: 720px)',
  ponteiroFino: '(hover: hover) and (pointer: fine)',
} as const

/**
 * O que cada componente recebe para decidir o que monta.
 *
 *  - `completo`: nível completo. Só aqui entram seção fixada, parallax, zoom,
 *    translações longas e tudo o que é preso à rolagem.
 *  - `essencial`: nível essencial. Fades, deslocamentos de até uns 16 px,
 *    recortes curtos e réguas que se desenham, com durações menores.
 *
 * No nível `nenhum` a montagem nem é chamada.
 */
export type Condicoes = {
  completo: boolean
  essencial: boolean
  desktop: boolean
  alto: boolean
  ponteiroFino: boolean
}

/** Busca elementos só dentro do escopo do componente (nunca na página toda). */
export type Seletor = (seletor: string) => HTMLElement[]

/**
 * Monta animações do GSAP dentro de `escopo` (os seletores em texto só
 * enxergam o que está dentro dele) e desfaz tudo — tweens, ScrollTriggers,
 * `pin-spacer` e textos divididos — quando o componente sai da tela, quando
 * uma das consultas muda, quando o nível de movimento muda ou quando uma
 * dependência muda.
 *
 * O estado escondido de cada elemento é aplicado pelo próprio GSAP. Se este
 * código não rodar, nada fica invisível.
 *
 * Regra da casa: esconder com `opacity`, `transform` ou `clip-path`, nunca com
 * `visibility` (`autoAlpha`). Texto com `visibility: hidden` sai da árvore de
 * acessibilidade: um link abaixo da dobra perderia o nome até a pessoa rolar.
 */
export function useMovimento(
  escopo: RefObject<HTMLElement | null>,
  montar: (condicoes: Condicoes, q: Seletor) => void | (() => void),
  dependencias: unknown[] = [],
) {
  const nivel = useNivelDeMovimento()

  useGSAP(
    () => {
      const raiz = escopo.current
      if (!raiz || nivel === 'nenhum') return
      const q: Seletor = (seletor) => Array.from(raiz.querySelectorAll<HTMLElement>(seletor))
      const mm = gsap.matchMedia()
      mm.add(
        CONSULTAS,
        (contexto) => {
          const tela = contexto.conditions as Record<keyof typeof CONSULTAS, boolean>
          return montar(
            {
              completo: nivel === 'completo',
              essencial: nivel === 'essencial',
              desktop: tela.desktop,
              alto: tela.alto,
              ponteiroFino: tela.ponteiroFino,
            },
            q,
          )
        },
        raiz,
      )
    },
    { scope: escopo, dependencies: [nivel, ...dependencias], revertOnUpdate: true },
  )
}

/**
 * Medidas de uma entrada conforme o nível: no completo o elemento percorre a
 * distância cheia; no essencial, no máximo 16 px e em menos tempo.
 */
export function entrada(condicoes: Pick<Condicoes, 'completo'>, cheio: { y?: number; duracao: number }) {
  if (condicoes.completo) return { y: cheio.y ?? 0, duration: cheio.duracao }
  return { y: Math.min(16, cheio.y ?? 0), duration: Math.min(0.6, cheio.duracao * 0.7) }
}

/** Estado aberto de um recorte retangular (destino dos reveals por `clip-path`). */
export const RECORTE_ABERTO = 'inset(0% 0% 0% 0%)'

/** Caracteres do efeito de texto embaralhado: só o que combina com a fonte mono. */
export const CARACTERES_DO_EMBARALHADO = '01<>/_#'

export { gsap, ScrollTrigger, SplitText, useGSAP }
