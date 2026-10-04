import { Badge } from '@/components/ui/badge'
import { Revelar } from '@/componentes/Revelar'
import type { Foto } from '@/conteudo/galeria'
import { cn } from '@/lib/utils'

/**
 * Galeria em mosaico: a primeira foto ocupa duas colunas no desktop. As fotos
 * vêm de `src/conteudo/galeria.ts`; enquanto forem ilustrações provisórias,
 * aparecem com a etiqueta "Foto de exemplo".
 */
export function Galeria({ fotos }: { fotos: Foto[] }) {
  if (fotos.length === 0) return null

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fotos.map((foto, i) => (
        <Revelar
          key={foto.arquivo}
          como="li"
          atraso={(i % 3) * 120}
          className={cn(i === 0 && 'sm:col-span-2 lg:row-span-2')}
        >
          <figure className="group flex h-full flex-col border-2 bg-card">
            <div className="relative flex-1 overflow-hidden">
              <img
                src={foto.arquivo}
                alt={foto.alt}
                loading="lazy"
                width={1200}
                height={900}
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
              {foto.exemplo && (
                <Badge variant="neutro" className="absolute right-3 bottom-3">
                  Foto de exemplo
                </Badge>
              )}
            </div>
            <figcaption className="flex items-center justify-between border-t-2 px-4 py-3">
              <span className="font-mono text-[15px] font-bold">{foto.legenda}</span>
              <span aria-hidden="true" className="font-mono text-xs text-muted-foreground">
                {String(i + 1).padStart(2, '0')}
              </span>
            </figcaption>
          </figure>
        </Revelar>
      ))}
    </ul>
  )
}
