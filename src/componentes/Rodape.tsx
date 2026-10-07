import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { ControleDeMovimento } from './ControleDeMovimento'

const ANO = new Date().getFullYear()

type Props = {
  /** Conteúdo acima dos links. Na landing, a assinatura em escala de página. */
  children?: ReactNode
}

/**
 * Rodapé público em Tinta: controle de animações, privacidade e acesso à área
 * do aluno (PRD F1).
 */
export function Rodape({ children }: Props) {
  return (
    <footer className="mt-auto overflow-x-clip bg-secondary text-secondary-foreground">
      <div className="conteiner-landing flex flex-col gap-10 py-12 md:py-16">
        {children}
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-6 border-t-2 border-papel pt-8">
          <ControleDeMovimento />
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-8 font-mono text-xs">
            <Link to="/privacidade" className="inline-flex min-h-11 items-center underline">
              Privacidade
            </Link>
            <Link to="/aluno/entrar" className="inline-flex min-h-11 items-center underline">
              Área do aluno
            </Link>
          </nav>
        </div>
        {/* Na landing, a direita fica livre para o botão de voltar ao topo. */}
        <p className={cn('font-mono text-xs', children && 'pr-14 md:pr-20')}>Vitor Ramos © {ANO}</p>
      </div>
    </footer>
  )
}
