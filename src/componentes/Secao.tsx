import { useRef, type ReactNode } from 'react'
import { deMascara, deRegua, embaralhar, gsap, SplitText, useMovimento } from '@/lib/movimento'
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
 * Movimento: o número se embaralha e assenta, as palavras do título entram
 * (subindo de dentro da linha no nível completo; com fade curto no essencial)
 * e a régua se desenha da esquerda para a direita.
 */
export function CabecalhoDeSecao({ numero, titulo, tamanho = 'grande', className }: PropsDoCabecalho) {
  const raiz = useRef<HTMLElement>(null)

  useMovimento(raiz, (c, q) => {
    // O SplitText põe `aria-label` no h2 e `aria-hidden` nos pedaços: o
    // leitor de tela continua lendo o título inteiro.
    const palavras = SplitText.create(q('h2'), { type: 'words', mask: 'words' })
    const linha = gsap
      .timeline({ scrollTrigger: { trigger: raiz.current, start: 'top 82%' } })
      .from(palavras.words, { ...deMascara(c), stagger: 0.07 })
      .from(q('[data-regua]'), deRegua(c), 0.1)
    q('[data-numero]').forEach((alvo) => linha.add(embaralhar(alvo, c), 0))
  })

  return (
    <header ref={raiz} className={cn('flex flex-col gap-(--espaco-miolo)', className)}>
      <div className={cn('grid items-end gap-x-6 gap-y-4', tamanho === 'grande' && 'md:grid-cols-12')}>
        {numero && (
          <span
            aria-hidden="true"
            data-numero
            className={cn(
              'block font-mono text-[28px] leading-none font-bold text-primary',
              tamanho === 'grande' && 'md:col-span-2 md:text-[clamp(28px,3vw,52px)]',
            )}
          >
            {numero}
          </span>
        )}
        <h2
          className={cn(
            'leading-none',
            tamanho === 'grande' ? 'text-[clamp(40px,7vw,124px)] md:col-span-10' : 'text-[clamp(34px,3.9vw,64px)]',
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
  /** O conteúdo sai da coluna e ocupa a largura inteira da tela. */
  sangrado?: boolean
}

/** Seção numerada da landing, em fundo Papel, com a escala de respiro da página. */
export function Secao({ id, numero, titulo, tamanho, children, className, sangrado }: Props) {
  return (
    <section id={id} className={cn('bg-background pt-(--espaco-secao)', !sangrado && 'pb-(--espaco-secao)', className)}>
      <div className="conteiner-landing">
        <CabecalhoDeSecao numero={numero} titulo={titulo} tamanho={tamanho} />
      </div>
      <div className={cn('mt-(--espaco-bloco)', !sangrado && 'conteiner-landing')}>{children}</div>
    </section>
  )
}
