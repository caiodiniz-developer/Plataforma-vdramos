import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

const ANO = new Date().getFullYear()

type Props = {
  /** Conteúdo acima dos links. Na landing, a assinatura em escala de página. */
  children?: ReactNode
}

/** Rodapé público em Tinta: privacidade e acesso à área do aluno (PRD F1). */
export function Rodape({ children }: Props) {
  return (
    <footer className="mt-auto overflow-x-clip bg-secondary text-secondary-foreground">
      <div className="conteiner-landing flex flex-col gap-8 py-10 md:py-14">
        {children}
        {/* Na landing, a direita fica livre para o botão de voltar ao topo. */}
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t-2 border-papel pt-6 font-mono text-xs',
            children && 'pr-14 md:pr-20',
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
