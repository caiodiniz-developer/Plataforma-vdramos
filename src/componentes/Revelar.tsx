import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useVisivel } from '@/hooks/useVisivel'
import { cn } from '@/lib/utils'

type Props = {
  children: ReactNode
  /** Atraso em ms, para revelar itens de uma lista em sequência. */
  atraso?: number
  como?: ElementType
  className?: string
}

/** Sobe e aparece quando entra na tela. Sem movimento com `prefers-reduced-motion`. */
export function Revelar({ children, atraso = 0, como: Elemento = 'div', className }: Props) {
  const { ref, visivel } = useVisivel<HTMLElement>()
  const estilo: CSSProperties | undefined = atraso ? { transitionDelay: `${atraso}ms` } : undefined
  return (
    <Elemento ref={ref} data-visivel={visivel} style={estilo} className={cn('revelar', className)}>
      {children}
    </Elemento>
  )
}
