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
 * Entradas que tocam uma vez usam o padrão do ScrollTrigger (toca ao entrar e
 * não volta), nunca `once: true`. Com `once`, o gatilho se mata ao disparar; se
 * isso acontece dentro de uma remedição — a pessoa volta para a landing com a
 * página já rolada — a lista de gatilhos muda no meio do laço e o GSAP quebra.
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
          const limpar = montar(
            {
              completo: nivel === 'completo',
              essencial: nivel === 'essencial',
              desktop: tela.desktop,
              alto: tela.alto,
              ponteiroFino: tela.ponteiroFino,
            },
            q,
          )
          return () => {
            limpar?.()
            // O GSAP desfaz estilos, não textos: devolve o texto de quem foi embaralhado.
            q('[data-texto-original]').forEach((el) => {
              el.textContent = el.dataset.textoOriginal ?? el.textContent
              delete el.dataset.textoOriginal
            })
          }
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

type Nivelado = Pick<Condicoes, 'completo'>

/**
 * Ponto de partida de letras e palavras de título. Completo: sobem de dentro
 * da máscara da linha. Essencial: fade com deslocamento mínimo.
 */
export function deMascara(c: Nivelado): gsap.TweenVars {
  return c.completo
    ? { yPercent: 110, duration: 1.1, ease: 'expo.out' }
    : { y: 10, opacity: 0, duration: 0.5, ease: 'power2.out' }
}

/** Ponto de partida de um bloco de conteúdo: sobe e aparece. */
export function deBloco(c: Nivelado, y = 32): gsap.TweenVars {
  return { opacity: 0, ease: c.completo ? 'power3.out' : 'power2.out', ...entrada(c, { y, duracao: 0.9 }) }
}

/** Ponto de partida de uma régua de 2 px que se desenha da esquerda para a direita. */
export function deRegua(c: Nivelado): gsap.TweenVars {
  return { scaleX: 0, duration: c.completo ? 1.2 : 0.7, ease: 'circ.out' }
}

/**
 * Texto que se embaralha por um instante e assenta no valor final. Só para
 * elementos decorativos (`aria-hidden`): o texto lido por leitor de tela fica
 * em outro elemento, estável. Devolve o tween para entrar numa timeline.
 */
export function embaralhar(alvo: HTMLElement, c: Nivelado): gsap.core.Tween {
  const texto = alvo.dataset.textoOriginal ?? alvo.textContent ?? ''
  alvo.dataset.textoOriginal = texto
  return gsap.to(alvo, {
    duration: c.completo ? 0.9 : 0.5,
    ease: 'none',
    scrambleText: { text: texto, chars: CARACTERES_DO_EMBARALHADO, speed: 0.6 },
  })
}

/** Estado aberto de um recorte retangular (destino dos reveals por `clip-path`). */
export const RECORTE_ABERTO = 'inset(0% 0% 0% 0%)'

/** Caracteres do efeito de texto embaralhado: só o que combina com a fonte mono. */
export const CARACTERES_DO_EMBARALHADO = '01<>/_#'

export { gsap, ScrollTrigger, SplitText, useGSAP }
