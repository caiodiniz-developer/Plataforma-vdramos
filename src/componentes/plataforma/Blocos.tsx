import { InboxIcon, SearchIcon, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EstadoDeErro } from '@/componentes/EstadoDeErro'
import type { Consulta } from '@/hooks/useConsulta'
import { cn } from '@/lib/utils'

/** Cabeçalho de página da plataforma: rótulo, título em fonte de código e ações. */
export function CabecalhoDaPagina({
  rotulo,
  titulo,
  descricao,
  children,
}: {
  rotulo: string
  titulo: string
  descricao?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 pb-5">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="eyebrow text-muted-foreground">{rotulo}</p>
        <h1 className="text-[28px] md:text-[34px]">{titulo}</h1>
        {descricao && <p className="max-w-[640px] text-[15px] text-muted-foreground">{descricao}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  )
}

/** Estado vazio com ícone, texto e ação opcional. */
export function Vazio({
  icone: Icone = InboxIcon,
  titulo,
  texto,
  children,
}: {
  icone?: LucideIcon
  titulo: string
  texto?: string
  children?: ReactNode
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-12 items-center justify-center border-2 bg-muted">
          <Icone aria-hidden="true" className="size-5" />
        </span>
        <p className="destaque text-lg">{titulo}</p>
        {texto && <p className="max-w-[420px] text-sm text-muted-foreground">{texto}</p>}
        {children}
      </CardContent>
    </Card>
  )
}

export function Esqueleto({ linhas = 3, className }: { linhas?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)} aria-busy="true">
      <span className="sr-only">Carregando</span>
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  )
}

/**
 * Trata os três estados de uma consulta (carregando, erro, pronto) e entrega
 * os dados já carregados para o conteúdo.
 */
export function Carregado<T>({
  consulta,
  linhas,
  children,
}: {
  consulta: Consulta<T>
  linhas?: number
  children: (dados: T) => ReactNode
}) {
  if (consulta.carregando && consulta.dados === null) return <Esqueleto linhas={linhas} />
  if (consulta.erro) return <EstadoDeErro mensagem={consulta.erro} aoTentarDeNovo={consulta.recarregar} />
  if (consulta.dados === null) return null
  return <>{children(consulta.dados)}</>
}

export function Busca({
  valor,
  aoMudar,
  rotulo,
  className,
}: {
  valor: string
  aoMudar: (valor: string) => void
  rotulo: string
  className?: string
}) {
  return (
    <div className={cn('relative w-full sm:w-[280px]', className)}>
      <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label={rotulo}
        placeholder={rotulo}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="pl-9"
      />
    </div>
  )
}

/** Cartão de número do painel. */
export function Numero({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
}: {
  rotulo: string
  valor: ReactNode
  detalhe?: string
  icone?: LucideIcon
}) {
  return (
    <Card className="h-full transition-transform duration-200 hover:-translate-y-0.5">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow text-muted-foreground">{rotulo}</p>
          {Icone && <Icone aria-hidden="true" className="size-4 text-muted-foreground" />}
        </div>
        <p className="destaque text-[34px] leading-none">{valor}</p>
        {detalhe && <p className="text-xs text-muted-foreground">{detalhe}</p>}
      </CardContent>
    </Card>
  )
}
