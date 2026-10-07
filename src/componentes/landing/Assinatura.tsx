import { useRef, type CSSProperties } from 'react'
import { gsap, SplitText, useMovimento } from '@/lib/movimento'

/**
 * Assinatura que fecha a landing: o nome em escala de página, dentro do
 * rodapé. Decorativa (`aria-hidden`): o nome já é o h1 da página.
 *
 * Movimento: as letras sobem quando o rodapé entra na tela.
 */
export function Assinatura({ nome }: { nome: string }) {
  const raiz = useRef<HTMLParagraphElement>(null)

  useMovimento(raiz, () => {
    const letras = SplitText.create(raiz.current, { type: 'chars', mask: 'chars', aria: 'none' })
    gsap.from(letras.chars, {
      yPercent: 110,
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.03,
      scrollTrigger: { trigger: raiz.current, start: 'top 95%', once: true },
    })
  })

  return (
    <p
      ref={raiz}
      aria-hidden="true"
      data-assinatura
      className="nome-gigante font-mono font-bold tracking-[-0.02em]"
      style={{ '--colunas-pilha': nome.length, '--colunas-linha': nome.length } as CSSProperties}
    >
      {nome}
    </p>
  )
}
