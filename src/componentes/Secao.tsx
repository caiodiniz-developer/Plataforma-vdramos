import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Revelar } from './Revelar'

type Props = {
  id?: string
  numero?: string
  titulo: string
  children: ReactNode
  className?: string
}

/**
 * Seção numerada do guia de marca: número, título em Ubuntu Mono e régua de
 * 2 px. O número vai em branco sobre azul (4,55:1); azul como texto pequeno
 * sobre Papel não passa em AA.
 */
export function Secao({ id, numero, titulo, children, className }: Props) {
  return (
    <section id={id} className={cn('mx-auto w-full max-w-[1080px] px-4 py-12 md:px-10 md:py-16', className)}>
      <Revelar className="mb-8 flex items-center gap-4 border-b-2 pb-4">
        {numero && (
          <span
            aria-hidden="true"
            className="bg-primary px-2 py-1 font-mono text-[13px] leading-none font-bold text-primary-foreground"
          >
            {numero}
          </span>
        )}
        <h2 className="text-[28px] md:text-[36px]">{titulo}</h2>
      </Revelar>
      {children}
    </section>
  )
}
