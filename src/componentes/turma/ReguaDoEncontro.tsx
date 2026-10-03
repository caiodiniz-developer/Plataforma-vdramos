import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { proporcoesDaRegua, ROTULO_TIPO_BLOCO, type TipoBloco } from '@/dominio/blocos'
import { formatarHora } from '@/dominio/tempo'
import { cn } from '@/lib/utils'

/** Cor por tipo de bloco (PRD, seção 9). `margem` é Papel com hachura. */
export const COR_DO_BLOCO: Record<TipoBloco, string> = {
  abertura: 'bg-tinta',
  teoria: 'bg-primary',
  pratica: 'bg-orange',
  perguntas: 'bg-violet',
  intervalo: 'bg-neutro',
  margem: 'hachura',
}

type BlocoDaRegua = { id?: string; hora_inicio: string; duracao_min: number; tipo: TipoBloco; titulo: string }

/**
 * Régua do encontro: barra horizontal em que cada bloco ocupa a largura
 * proporcional à sua duração. A cor nunca é a única informação: o tipo e o
 * horário aparecem no tooltip, na legenda e na tabela de blocos.
 */
export function ReguaDoEncontro({ blocos }: { blocos: BlocoDaRegua[] }) {
  if (blocos.length === 0) return null
  const larguras = proporcoesDaRegua(blocos)
  const tipos = [...new Set(blocos.map((b) => b.tipo))]

  return (
    <div className="flex flex-col gap-3">
      <TooltipProvider delayDuration={100}>
        <div className="flex h-8 w-full overflow-hidden border-2" role="img" aria-label="Régua do encontro">
          {blocos.map((bloco, indice) => (
            <Tooltip key={bloco.id ?? indice}>
              <TooltipTrigger asChild>
                <div
                  tabIndex={0}
                  style={{ width: `${larguras[indice]}%` }}
                  className={cn(
                    'h-full border-r-2 border-background last:border-r-0 focus-visible:z-10',
                    COR_DO_BLOCO[bloco.tipo],
                  )}
                />
              </TooltipTrigger>
              <TooltipContent>
                {formatarHora(bloco.hora_inicio)} · {bloco.duracao_min} min · {ROTULO_TIPO_BLOCO[bloco.tipo]} —{' '}
                {bloco.titulo}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
      <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Legenda da régua">
        {tipos.map((tipo) => (
          <li key={tipo} className="flex items-center gap-2 text-xs">
            <span aria-hidden="true" className={cn('size-3 border-2', COR_DO_BLOCO[tipo])} />
            {ROTULO_TIPO_BLOCO[tipo]}
          </li>
        ))}
      </ul>
    </div>
  )
}
