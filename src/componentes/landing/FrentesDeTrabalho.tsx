import { ArrowRightIcon } from 'lucide-react'
import { useRef } from 'react'
import type { Assunto } from '@/dominio/contato'
import { gsap, useMovimento } from '@/lib/movimento'
import { cn } from '@/lib/utils'

type Frente = {
  rotulo: string
  titulo: string
  texto: string
  assunto: Assunto
  /** Cor do marcador e do bloco que varre a linha no hover. */
  cor: string
  /** Cor do texto sobre o bloco: branco no azul, Tinta no laranja e no verde. */
  textoSobreACor: string
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
    cor: 'bg-primary',
    textoSobreACor: 'group-hover:text-primary-foreground group-focus-visible:text-primary-foreground',
  },
  {
    rotulo: 'Treinamento',
    titulo: 'IA Aplicada',
    texto: 'Módulo prático de modelos de linguagem para produto.',
    assunto: 'treinamento',
    cor: 'bg-orange',
    textoSobreACor: 'group-hover:text-tinta group-focus-visible:text-tinta',
  },
  {
    rotulo: 'Consultoria',
    titulo: 'Produto de Dados',
    texto: 'Do diagnóstico ao roadmap de engenharia de IA.',
    assunto: 'consultoria',
    cor: 'bg-green',
    textoSobreACor: 'group-hover:text-tinta group-focus-visible:text-tinta',
  },
]

type Props = { aoEscolher: (assunto: Assunto) => void }

/**
 * Lista editorial das frentes: uma linha por frente, com o título em letra
 * grande. No hover e no foco, um bloco chapado da cor da frente varre a linha.
 *
 * Movimento: ao entrar na tela, a régua de cada linha se desenha e o título
 * sobe de dentro da própria linha.
 */
export function FrentesDeTrabalho({ aoEscolher }: Props) {
  const raiz = useRef<HTMLUListElement>(null)

  useMovimento(raiz, (_condicoes, q) => {
    q('[data-frente]').forEach((linha) => {
      const dentro = (seletor: string) => Array.from(linha.querySelectorAll<HTMLElement>(seletor))
      gsap
        .timeline({ scrollTrigger: { trigger: linha, start: 'top 85%', once: true } })
        .from(dentro('[data-regua]'), { scaleX: 0, duration: 1.2, ease: 'circ.out' }, 0)
        .from(dentro('[data-titulo]'), { yPercent: 105, duration: 1.1, ease: 'expo.out' }, 0.05)
        .from(dentro('[data-apoio]'), { y: 24, opacity: 0, duration: 0.8, ease: 'power2.out', stagger: 0.07 }, 0.2)
    })
  })

  return (
    <ul ref={raiz}>
      {FRENTES.map((frente, i) => (
        <li key={frente.titulo} data-frente className="relative">
          {/* A primeira linha usa a régua do cabeçalho da seção. */}
          {i > 0 && <span aria-hidden="true" data-regua className="block h-0.5 origin-left bg-foreground" />}
          <a
            href="#contato"
            onClick={() => aoEscolher(frente.assunto)}
            className={cn(
              'group relative grid items-center gap-x-6 gap-y-4 overflow-hidden px-2 py-8 transition-colors duration-300 md:grid-cols-12 md:px-4 md:py-12',
              frente.textoSobreACor,
            )}
          >
            {/* Bloco chapado que varre a linha. */}
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-0 origin-left scale-x-0 transition-transform duration-500 ease-[cubic-bezier(0.7,0,0.2,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100',
                frente.cor,
              )}
            />
            <span data-apoio className="relative flex items-center gap-3 md:col-span-2">
              <span aria-hidden="true" className="font-mono text-sm">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'size-3 transition-colors duration-300 group-hover:bg-tinta group-focus-visible:bg-tinta',
                  frente.cor,
                )}
              />
              <span className="eyebrow">{frente.rotulo}</span>
            </span>
            <h3 className="relative overflow-hidden pb-[0.1em] text-[clamp(34px,5vw,84px)] leading-none md:col-span-5">
              <span data-titulo className="block">
                {frente.titulo}
              </span>
            </h3>
            <p data-apoio className="relative max-w-[34ch] text-base leading-normal md:col-span-3 md:text-lg">
              {frente.texto}
            </p>
            <span
              data-apoio
              className="relative inline-flex min-h-11 items-center gap-2 text-sm font-bold md:col-span-2 md:justify-self-end"
            >
              Conversar sobre {frente.rotulo.toLowerCase()}
              <ArrowRightIcon
                aria-hidden="true"
                className="size-5 shrink-0 transition-transform duration-300 group-hover:translate-x-1.5 group-focus-visible:translate-x-1.5"
              />
            </span>
          </a>
        </li>
      ))}
      <li aria-hidden="true" className="h-0.5 bg-foreground" />
    </ul>
  )
}
