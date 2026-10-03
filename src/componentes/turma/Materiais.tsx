import {
  ArrowUpRightIcon,
  FileIcon,
  FileTextIcon,
  LinkIcon,
  Loader2Icon,
  PencilRulerIcon,
  PresentationIcon,
  VideoIcon,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { urlDoArquivo, type Material, type TipoMaterial, type Turma } from '@/dados/turma'

const ICONE: Record<TipoMaterial, LucideIcon> = {
  link: LinkIcon,
  arquivo: FileIcon,
  video: VideoIcon,
  slides: PresentationIcon,
  exercicio: PencilRulerIcon,
  outro: FileTextIcon,
}

const ROTULO: Record<TipoMaterial, string> = {
  link: 'Link',
  arquivo: 'Arquivo',
  video: 'Vídeo',
  slides: 'Slides',
  exercicio: 'Exercício',
  outro: 'Outro',
}

function CartaoDeMaterial({ material }: { material: Material }) {
  const [abrindo, setAbrindo] = useState(false)
  const Icone = ICONE[material.tipo]

  async function abrir() {
    if (abrindo) return
    // Link externo abre direto; arquivo pede uma URL assinada nova a cada clique.
    if (!material.arquivo_path) {
      window.open(material.url ?? '', '_blank', 'noopener,noreferrer')
      return
    }
    setAbrindo(true)
    try {
      window.open(await urlDoArquivo(material.arquivo_path), '_blank', 'noopener,noreferrer')
    } catch (falha) {
      toast.error((falha as Error).message, { action: { label: 'Tentar de novo', onClick: () => void abrir() } })
    } finally {
      setAbrindo(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <Icone aria-hidden="true" className="size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-muted-foreground">
            {material.tipo === 'outro' ? (material.tipo_outro ?? ROTULO.outro) : ROTULO[material.tipo]}
          </p>
          <p className="font-bold">{material.titulo}</p>
        </div>
        <Button size="sm" variant="outline" disabled={abrindo} onClick={() => void abrir()}>
          {abrindo ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <ArrowUpRightIcon aria-hidden="true" />}
          Abrir
          <span className="sr-only">
            {material.titulo} (nova aba)
          </span>
        </Button>
      </CardContent>
    </Card>
  )
}

/** PRD F7: materiais liberados, agrupados por encontro, com os gerais primeiro. */
export function Materiais({ turma }: { turma: Turma }) {
  if (turma.materiais.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-muted-foreground">O professor ainda não publicou materiais.</p>
        </CardContent>
      </Card>
    )
  }

  const grupos = [
    { chave: 'geral', titulo: 'Material geral do curso', itens: turma.materiais.filter((m) => m.encontro_id === null) },
    ...turma.encontros.map((e) => ({
      chave: e.id,
      titulo: `Encontro ${e.numero} · ${e.titulo}`,
      itens: turma.materiais.filter((m) => m.encontro_id === e.id),
    })),
  ].filter((grupo) => grupo.itens.length > 0)

  return (
    <div className="flex flex-col gap-8">
      {grupos.map((grupo) => (
        <section key={grupo.chave} className="flex flex-col gap-3">
          <h3 className="text-[19px]">{grupo.titulo}</h3>
          <ul className="flex flex-col gap-3">
            {grupo.itens.map((material) => (
              <li key={material.id}>
                <CartaoDeMaterial material={material} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
