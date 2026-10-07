import { useRef, type ReactNode } from 'react'
import { gsap, SplitText, useMovimento } from '@/lib/movimento'
import { cn } from '@/lib/utils'

type PropsDoCabecalho = {
  numero?: string
  titulo: string
  /** `grande` ocupa a largura da página; `medio` cabe ao lado de outro conteúdo. */
  tamanho?: 'grande' | 'medio'
  className?: string
}

/**
 * Cabeçalho de seção: número grande em Ubuntu Mono, título e régua de 2 px.
 * O número vai em azul só porque é texto grande (≥ 24 px bold); azul em texto
 * pequeno não passa em AA.
 *
 * Movimento: as palavras do título sobem de dentro da própria linha e a régua
 * se desenha da esquerda para a direita quando o cabeçalho entra na tela.
 */
export function CabecalhoDeSecao({ numero, titulo, tamanho = 'grande', className }: PropsDoCabecalho) {
  const raiz = useRef<HTMLElement>(null)

  useMovimento(raiz, (_condicoes, q) => {
    // O SplitText põe `aria-label` no h2 e `aria-hidden` nos pedaços: o
    // leitor de tela continua lendo o título inteiro.
    const palavras = SplitText.create(q('h2'), { type: 'words', mask: 'words' })
    gsap
      .timeline({ scrollTrigger: { trigger: raiz.current, start: 'top 82%', once: true } })
      .from(palavras.words, { yPercent: 110, duration: 1, ease: 'expo.out', stagger: 0.07 })
      .from(q('[data-numero]'), { yPercent: 110, duration: 0.8, ease: 'expo.out' }, 0)
      .from(q('[data-regua]'), { scaleX: 0, duration: 1.2, ease: 'circ.out' }, 0.1)
  })

  return (
    <header ref={raiz} className={cn('flex flex-col gap-5 md:gap-8', className)}>
      <div className={cn('grid items-end gap-x-6 gap-y-3', tamanho === 'grande' && 'md:grid-cols-12')}>
        {numero && (
          <span aria-hidden="true" className={cn('block overflow-hidden', tamanho === 'grande' && 'md:col-span-2')}>
            <span
              data-numero
              className={cn(
                'block font-mono text-[28px] leading-none font-bold text-primary',
                tamanho === 'grande' && 'md:text-[clamp(28px,3vw,52px)]',
              )}
            >
              {numero}
            </span>
          </span>
        )}
        <h2
          className={cn(
            'leading-none',
            tamanho === 'grande' ? 'text-[clamp(40px,7vw,124px)] md:col-span-10' : 'text-[clamp(36px,4.2vw,68px)]',
          )}
        >
          {titulo}
        </h2>
      </div>
      <span aria-hidden="true" data-regua className="block h-0.5 origin-left bg-current" />
    </header>
  )
}

type Props = PropsDoCabecalho & {
  id?: string
  children: ReactNode
  /** Seção invertida: fundo Tinta e texto Papel. */
  escura?: boolean
  /** O conteúdo começa colado na régua do cabeçalho (listas que usam a régua como primeira linha). */
  colado?: boolean
}

/** Seção numerada da landing, com fundo Papel ou Tinta. */
export function Secao({ id, numero, titulo, tamanho, children, className, escura, colado }: Props) {
  return (
    <section
      id={id}
      className={cn(
        'overflow-x-clip py-20 md:py-32',
        escura ? 'bg-secondary text-secondary-foreground' : 'bg-background',
        className,
      )}
    >
      <div className="conteiner-landing">
        <CabecalhoDeSecao numero={numero} titulo={titulo} tamanho={tamanho} />
        <div className={colado ? undefined : 'mt-10 md:mt-16'}>{children}</div>
      </div>
    </section>
  )
}
