import { escolherNivel, useNivelDeMovimento, type Nivel } from '@/lib/nivelDeMovimento'
import { cn } from '@/lib/utils'

const OPCOES: { nivel: Nivel; rotulo: string; descricao: string }[] = [
  { nivel: 'completo', rotulo: 'Completas', descricao: 'Animações completas' },
  { nivel: 'essencial', rotulo: 'Essenciais', descricao: 'Animações essenciais' },
  { nivel: 'nenhum', rotulo: 'Desligadas', descricao: 'Animações desligadas' },
]

/**
 * Controle de animações (fica no rodapé, sobre fundo Tinta). O padrão segue o
 * sistema; a escolha feita aqui vence o sistema e fica guardada no navegador.
 * O estado não depende só da cor: o botão ativo tem `aria-pressed` e um
 * marcador quadrado ao lado do texto.
 */
export function ControleDeMovimento({ className }: { className?: string }) {
  const nivel = useNivelDeMovimento()

  return (
    <div role="group" aria-label="Animações" className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      <span aria-hidden="true" className="eyebrow">
        Animações
      </span>
      <div className="flex">
        {OPCOES.map((opcao) => {
          const ativa = opcao.nivel === nivel
          return (
            <button
              key={opcao.nivel}
              type="button"
              aria-pressed={ativa}
              aria-label={opcao.descricao}
              onClick={() => escolherNivel(opcao.nivel)}
              className={cn(
                'eyebrow -ml-0.5 inline-flex min-h-11 cursor-pointer items-center gap-2 border-2 border-papel px-3 transition-colors first:ml-0 focus-visible:z-10',
                ativa ? 'bg-papel text-tinta' : 'text-papel hover:bg-papel hover:text-tinta',
              )}
            >
              <span aria-hidden="true" className={cn('size-2', ativa ? 'bg-tinta' : 'border-2 border-current')} />
              {opcao.rotulo}
            </button>
          )
        })}
      </div>
    </div>
  )
}
