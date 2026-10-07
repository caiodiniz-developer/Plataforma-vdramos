import { ArrowRightIcon } from 'lucide-react'
import { useRef, type FocusEvent } from 'react'
import type { Assunto } from '@/dominio/contato'
import { deBloco, deMascara, deRegua, embaralhar, gsap, SplitText, useMovimento } from '@/lib/movimento'
import { ALTURA_DO_CABECALHO, rolarAte } from '@/lib/rolagem'
import { cn } from '@/lib/utils'

type Frente = {
  rotulo: string
  titulo: string
  texto: string
  assunto: Assunto
  /** Cor que toma a tela e cor do texto sobre ela (branco no azul; Tinta no laranja e no verde). */
  painel: string
}

/**
 * Frentes de trabalho. Títulos e textos vêm dos cartões do Brand Style Guide;
 * cada uma leva ao formulário de contato com o assunto já escolhido.
 */
const FRENTES: Frente[] = [
  {
    rotulo: 'Palestra',
    titulo: 'Letramento em Dados',
    texto: 'Como estruturar times para decisões orientadas a dados.',
    assunto: 'palestra',
    painel: 'bg-primary text-primary-foreground',
  },
  {
    rotulo: 'Treinamento',
    titulo: 'IA Aplicada',
    texto: 'Módulo prático de modelos de linguagem para produto.',
    assunto: 'treinamento',
    painel: 'bg-orange text-tinta',
  },
  {
    rotulo: 'Consultoria',
    titulo: 'Produto de Dados',
    texto: 'Do diagnóstico ao roadmap de engenharia de IA.',
    assunto: 'consultoria',
    painel: 'bg-green text-tinta',
  },
]

type Props = { aoEscolher: (assunto: Assunto) => void }

/**
 * Três painéis de tela cheia, um por frente, cada um na sua cor. O painel
 * inteiro é o link "Conversar sobre …".
 *
 * Movimento:
 *  - em telas largas: os painéis empilham — cada um gruda no topo
 *    (`position: sticky`, classe `painel-empilhado`) e o seguinte sobe por
 *    cima, tomando a tela com a sua cor, enquanto o de baixo recua. É rolagem
 *    nativa: todo link continua alcançável, e o foco por teclado leva a página
 *    até o painel focado.
 *  - no celular: painéis em sequência, sem grudar.
 * Em todos os tamanhos, a régua se desenha, as palavras do título sobem de
 * dentro da linha e o número gigante sobe mais devagar que o painel.
 */
export function FrentesDeTrabalho({ aoEscolher }: Props) {
  const raiz = useRef<HTMLUListElement>(null)

  useMovimento(raiz, (c, q) => {
    const paineis = q('[data-painel]')
    paineis.forEach((painel, i) => {
      const dentro = (seletor: string) => Array.from(painel.querySelectorAll<HTMLElement>(seletor))
      const palavras = SplitText.create(dentro('h3'), { type: 'words', mask: 'words' })
      const linha = gsap
        .timeline({ scrollTrigger: { trigger: painel, start: 'top 75%' } })
        .from(dentro('[data-regua]'), deRegua(), 0)
        .from(palavras.words, { ...deMascara(), stagger: 0.08 }, 0.05)
        .from(dentro('[data-apoio]'), { ...deBloco(28), stagger: 0.08 }, 0.25)
      dentro('[data-embaralha]').forEach((alvo) => linha.add(embaralhar(alvo), 0))

      // O número gigante sobe mais devagar que o painel.
      gsap.fromTo(
        dentro('[data-numero]'),
        { yPercent: 18 },
        { yPercent: -18, ease: 'none', scrollTrigger: { trigger: painel, start: 'top bottom', end: 'bottom top', scrub: true } },
      )
      // Enquanto o painel seguinte cobre este, o conteúdo recua.
      const seguinte = paineis[i + 1]
      if (seguinte && c.desktop) {
        gsap.to(dentro('[data-conteudo]'), {
          scale: 0.9,
          yPercent: -5,
          ease: 'none',
          scrollTrigger: { trigger: seguinte, start: 'top bottom', end: `top ${ALTURA_DO_CABECALHO}px`, scrub: true },
        })
      }
    })
  })

  // Empilhado, um painel anterior fica coberto: o foco por teclado leva a página até ele.
  function aoFocar(evento: FocusEvent<HTMLAnchorElement>, indice: number) {
    const lista = raiz.current
    const painel = evento.currentTarget.parentElement
    if (!lista || !painel || !evento.currentTarget.matches(':focus-visible')) return
    if (getComputedStyle(painel).position !== 'sticky') return
    const topoDaLista = lista.getBoundingClientRect().top + window.scrollY
    rolarAte(topoDaLista + indice * painel.offsetHeight, -ALTURA_DO_CABECALHO)
  }

  return (
    <ul ref={raiz}>
      {FRENTES.map((frente, i) => (
        <li key={frente.titulo} data-painel className="painel-empilhado">
          <a
            href="#contato"
            data-cursor="Conversar"
            onClick={() => aoEscolher(frente.assunto)}
            onFocus={(evento) => aoFocar(evento, i)}
            className={cn(
              'group relative flex min-h-[78svh] flex-col overflow-hidden focus-visible:outline-offset-[-6px] focus-visible:outline-current lg:min-h-[calc(100svh-4rem)]',
              frente.painel,
            )}
          >
            <span
              aria-hidden="true"
              data-numero
              className="pointer-events-none absolute right-(--calha) hidden md:block bottom-[-0.12em] font-mono text-[clamp(180px,30vw,560px)] leading-none font-bold"
            >
              {i + 1}
            </span>

            <div data-conteudo className="conteiner-landing relative flex flex-1 origin-top flex-col justify-between gap-(--espaco-bloco) py-(--espaco-item)">
              <div className="flex items-center gap-4">
                <span aria-hidden="true" data-embaralha className="font-mono text-sm">
                  {String(i + 1).padStart(2, '0')} / {String(FRENTES.length).padStart(2, '0')}
                </span>
                <span className="eyebrow">{frente.rotulo}</span>
                <span aria-hidden="true" data-regua className="h-0.5 flex-1 origin-left bg-current" />
              </div>

              <h3 className="max-w-[12ch] text-[clamp(44px,9.5vw,176px)] leading-none">{frente.titulo}</h3>

              <div className="flex max-w-[52ch] flex-col gap-(--espaco-miolo)">
                <p data-apoio className="text-xl leading-[1.4] md:text-2xl">
                  {frente.texto}
                </p>
                <span data-apoio className="inline-flex min-h-11 items-center gap-3 text-base font-bold md:text-lg">
                  <span className="border-b-2 border-current pb-1">Conversar sobre {frente.rotulo.toLowerCase()}</span>
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="size-6 shrink-0 transition-transform duration-300 group-hover:translate-x-3 group-focus-visible:translate-x-3"
                  />
                </span>
              </div>
            </div>
          </a>
        </li>
      ))}
    </ul>
  )
}
