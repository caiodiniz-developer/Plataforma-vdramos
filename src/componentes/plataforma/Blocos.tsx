import { InboxIcon, SearchIcon, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EstadoDeErro } from '@/componentes/EstadoDeErro'
import type { Consulta } from '@/hooks/useConsulta'
import { cn } from '@/lib/utils'

/**
 * Cores de acento do guia, com o par de texto que passa em contraste: branco
 * sobre azul e Tinta; Tinta sobre laranja e verde; roxo só tingido, com borda.
 */
export type Cor = 'azul' | 'laranja' | 'roxo' | 'verde' | 'tinta'

const COR_DO_SELO: Record<Cor, string> = {
  azul: 'border-primary bg-primary text-primary-foreground',
  laranja: 'border-orange bg-orange text-tinta',
  roxo: 'border-violet bg-violet-tint text-tinta',
  verde: 'border-green bg-green text-tinta',
  tinta: 'border-tinta bg-tinta text-papel',
}

const COR_DA_FAIXA: Record<Cor, string> = {
  azul: 'bg-primary',
  laranja: 'bg-orange',
  roxo: 'bg-violet',
  verde: 'bg-green',
  tinta: 'bg-tinta',
}

/** Ícone dentro de um quadrado na cor de acento. */
export function Selo({ icone: Icone, cor = 'tinta', className }: { icone: LucideIcon; cor?: Cor; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center border-2', COR_DO_SELO[cor], className)}>
      <Icone className="size-5" />
    </span>
  )
}

/** Faixa das quatro cores do guia, a mesma da landing. */
export function FaixaDeCores({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex h-1.5 w-full', className)}>
      <span className="flex-1 bg-primary" />
      <span className="flex-1 bg-orange" />
      <span className="flex-1 bg-violet" />
      <span className="flex-1 bg-green" />
    </div>
  )
}

/** Cabeçalho de página da plataforma: rótulo, título em fonte de código e ações. */
export function CabecalhoDaPagina({
  rotulo,
  titulo,
  descricao,
  icone,
  cor = 'tinta',
  children,
}: {
  rotulo: string
  titulo: string
  descricao?: string
  /** Com ícone, o cabeçalho ganha o selo colorido da seção. */
  icone?: LucideIcon
  cor?: Cor
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 pb-5">
      <div className="flex min-w-0 items-start gap-4">
        {icone && <Selo icone={icone} cor={cor} className="mt-1 hidden size-14 sm:flex [&>svg]:size-6" />}
        <div className="flex min-w-0 flex-col gap-2">
          <p className="eyebrow text-muted-foreground">{rotulo}</p>
          <h1 className="text-[28px] md:text-[34px]">{titulo}</h1>
          {descricao && <p className="max-w-[640px] text-[15px] text-muted-foreground">{descricao}</p>}
        </div>
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
        <span className="flex size-14 items-center justify-center border-2 bg-muted">
          <Icone aria-hidden="true" className="size-6" />
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

/**
 * Filtro de lista em botões de alternância. Não é um conjunto de abas: não há
 * painel por opção, só a mesma lista filtrada, então cada botão informa o
 * estado com `aria-pressed`.
 */
export function FiltroDeLista<T extends string>({
  valor,
  aoMudar,
  opcoes,
  rotulo,
}: {
  valor: T
  aoMudar: (valor: T) => void
  opcoes: [valor: T, rotulo: string][]
  rotulo: string
}) {
  return (
    <div role="group" aria-label={rotulo} className="inline-flex max-w-full gap-1 overflow-x-auto bg-muted p-1">
      {opcoes.map(([opcao, texto]) => (
        <button
          key={opcao}
          type="button"
          aria-pressed={opcao === valor}
          onClick={() => aoMudar(opcao)}
          className={cn(
            'min-h-9 shrink-0 border-2 px-3 text-sm font-semibold whitespace-nowrap',
            opcao === valor ? 'border-foreground bg-background text-foreground' : 'border-transparent text-foreground/70 hover:text-foreground',
          )}
        >
          {texto}
        </button>
      ))}
    </div>
  )
}

/** Cartão de número do painel. */
export function Numero({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
  cor,
}: {
  rotulo: string
  valor: ReactNode
  detalhe?: string
  icone?: LucideIcon
  /** Com cor, o cartão ganha a faixa no topo e o ícone em selo. */
  cor?: Cor
}) {
  return (
    <Card className={cn('relative h-full overflow-hidden transition-transform duration-200 hover:-translate-y-0.5', cor && 'pt-7')}>
      {cor && <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1.5', COR_DA_FAIXA[cor])} />}
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow text-muted-foreground">{rotulo}</p>
          {Icone && cor && <Selo icone={Icone} cor={cor} className="size-9 [&>svg]:size-4" />}
          {Icone && !cor && <Icone aria-hidden="true" className="size-4 text-muted-foreground" />}
        </div>
        <p className="destaque text-[34px] leading-none">{valor}</p>
        {detalhe && <p className="text-xs text-muted-foreground">{detalhe}</p>}
      </CardContent>
    </Card>
  )
}
