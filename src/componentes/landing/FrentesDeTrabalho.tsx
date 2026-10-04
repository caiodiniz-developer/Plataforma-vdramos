import { ArrowRightIcon, BookOpenCheckIcon, BrainCircuitIcon, ChartNoAxesCombinedIcon, type LucideIcon } from 'lucide-react'
import { Revelar } from '@/componentes/Revelar'
import type { Assunto } from '@/dominio/contato'
import { cn } from '@/lib/utils'

type Frente = {
  icone: LucideIcon
  rotulo: string
  titulo: string
  texto: string
  assunto: Assunto
  escura?: boolean
  corDoRotulo: string
}

/**
 * Frentes de trabalho. Títulos e textos vêm dos cartões do Brand Style Guide;
 * cada uma leva ao formulário de contato com o assunto já escolhido.
 */
const FRENTES: Frente[] = [
  {
    icone: BookOpenCheckIcon,
    rotulo: 'Palestra',
    titulo: 'Letramento em Dados',
    texto: 'Como estruturar times para decisões orientadas a dados.',
    assunto: 'palestra',
    corDoRotulo: 'bg-primary text-primary-foreground',
  },
  {
    icone: BrainCircuitIcon,
    rotulo: 'Treinamento',
    titulo: 'IA Aplicada',
    texto: 'Módulo prático de modelos de linguagem para produto.',
    assunto: 'treinamento',
    escura: true,
    corDoRotulo: 'bg-orange text-tinta',
  },
  {
    icone: ChartNoAxesCombinedIcon,
    rotulo: 'Consultoria',
    titulo: 'Produto de Dados',
    texto: 'Do diagnóstico ao roadmap de engenharia de IA.',
    assunto: 'consultoria',
    corDoRotulo: 'bg-green text-tinta',
  },
]

type Props = { aoEscolher: (assunto: Assunto) => void }

export function FrentesDeTrabalho({ aoEscolher }: Props) {
  return (
    <ul className="grid gap-5 md:grid-cols-3">
      {FRENTES.map((frente, i) => (
        <Revelar key={frente.titulo} como="li" atraso={i * 120}>
          <a
            href="#contato"
            onClick={() => aoEscolher(frente.assunto)}
            className={cn(
              'group flex h-full flex-col gap-4 border-2 p-6 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-primary focus-visible:-translate-y-1',
              frente.escura ? 'bg-secondary text-secondary-foreground' : 'bg-card',
            )}
          >
            <div className="flex items-center justify-between">
              {/* Etiqueta: branco sobre azul (4,55:1); Tinta sobre laranja e verde (regra de contraste). */}
              <span className={cn('eyebrow px-2 py-1 text-[10px]', frente.corDoRotulo)}>{frente.rotulo}</span>
              <frente.icone aria-hidden="true" className="size-6" />
            </div>
            <h3 className="text-[22px]">{frente.titulo}</h3>
            <p className={cn('text-[15px] leading-[1.55]', frente.escura ? 'text-neutro' : 'text-muted-foreground')}>
              {frente.texto}
            </p>
            <span className="mt-auto inline-flex items-center gap-2 pt-2 text-[13px] font-bold">
              Conversar sobre {frente.rotulo.toLowerCase()}
              <ArrowRightIcon aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </a>
        </Revelar>
      ))}
    </ul>
  )
}
