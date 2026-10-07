import { useRef, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { gsap, SplitText, useMovimento } from '@/lib/movimento'
import { cn } from '@/lib/utils'

const ANO = new Date().getFullYear()

type Props = {
  /** Na landing, o rodapé fecha a página com o nome em escala de página. */
  assinatura?: string
}

/**
 * Rodapé público em Tinta: privacidade e acesso à área do aluno (PRD F1).
 *
 * Movimento (só na landing): as letras da assinatura sobem quando o rodapé
 * entra na tela. A assinatura é decorativa (`aria-hidden`).
 */
export function Rodape({ assinatura }: Props) {
  const raiz = useRef<HTMLElement>(null)

  useMovimento(
    raiz,
    (_condicoes, q) => {
    const alvo = q('[data-assinatura]')
    if (alvo.length === 0) return
    const letras = SplitText.create(alvo, { type: 'chars', mask: 'chars', aria: 'none' })
    gsap.from(letras.chars, {
      yPercent: 110,
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.03,
      scrollTrigger: { trigger: alvo, start: 'top 95%', once: true },
    })
    },
    [assinatura],
  )

  return (
    <footer ref={raiz} className="mt-auto overflow-x-clip bg-secondary text-secondary-foreground">
      <div className="conteiner-landing flex flex-col gap-8 py-10 md:py-14">
        {assinatura && (
          <p
            aria-hidden="true"
            data-assinatura
            className="nome-gigante font-mono font-bold tracking-[-0.02em]"
            style={{ '--colunas-pilha': assinatura.length, '--colunas-linha': assinatura.length } as CSSProperties}
          >
            {assinatura}
          </p>
        )}
        {/* Na landing, a direita fica livre para o botão de voltar ao topo. */}
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t-2 border-papel pt-6 font-mono text-xs',
            assinatura && 'pr-14 md:pr-20',
          )}
        >
          <span>Vitor Ramos © {ANO}</span>
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6">
            <Link to="/privacidade" className="inline-flex min-h-11 items-center underline">
              Privacidade
            </Link>
            <Link to="/aluno/entrar" className="inline-flex min-h-11 items-center underline">
              Área do aluno
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
