import {
  CalendarRangeIcon,
  ChartColumnIcon,
  FolderOpenIcon,
  MessageCircleQuestionIcon,
  ThumbsUpIcon,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Revelar } from '@/componentes/Revelar'
import { ReguaDoEncontro } from '@/componentes/turma/ReguaDoEncontro'
import type { TipoBloco } from '@/dominio/blocos'
import { useVisivel } from '@/hooks/useVisivel'

const RECURSOS: { icone: LucideIcon; titulo: string; texto: string }[] = [
  {
    icone: CalendarRangeIcon,
    titulo: 'Calendário com a régua do encontro',
    texto: 'Cada aula dividida em abertura, teoria, prática e perguntas, com horário e duração.',
  },
  {
    icone: MessageCircleQuestionIcon,
    titulo: 'Perguntas durante a aula',
    texto: 'Para a turma ou só para o professor, com opção de enviar sem o nome e votar nas mais importantes.',
  },
  {
    icone: ChartColumnIcon,
    titulo: 'Quizzes e pesquisas',
    texto: 'Respostas em tempo real, com correção na hora e resultado projetado para a turma.',
  },
  {
    icone: FolderOpenIcon,
    titulo: 'Materiais por encontro',
    texto: 'Planilhas, slides e links liberados no momento certo do curso.',
  },
]

// Encontro de demonstração: 18:45–22:45, como no cronograma de referência.
const BLOCOS_DEMO: { hora_inicio: string; duracao_min: number; tipo: TipoBloco; titulo: string }[] = [
  { hora_inicio: '18:45', duracao_min: 15, tipo: 'abertura', titulo: 'Abertura' },
  { hora_inicio: '19:00', duracao_min: 60, tipo: 'teoria', titulo: 'Conceitos' },
  { hora_inicio: '20:00', duracao_min: 15, tipo: 'intervalo', titulo: 'Intervalo' },
  { hora_inicio: '20:15', duracao_min: 90, tipo: 'pratica', titulo: 'Prática guiada' },
  { hora_inicio: '21:45', duracao_min: 30, tipo: 'perguntas', titulo: 'Perguntas' },
  { hora_inicio: '22:15', duracao_min: 30, tipo: 'margem', titulo: 'Margem' },
]

const RESULTADO_DEMO = [
  { opcao: '$', percentual: 72, correta: true },
  { opcao: '#', percentual: 18, correta: false },
  { opcao: '&', percentual: 10, correta: false },
]

/** Prévia ilustrativa da sala ao vivo. As barras crescem quando a prévia aparece na tela. */
function PreviaDaSala() {
  const { ref, visivel } = useVisivel<HTMLDivElement>()

  return (
    <div ref={ref} className="flex flex-col gap-4 border-2 bg-card p-5" aria-label="Prévia ilustrativa da sala de aula">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow text-muted-foreground">Encontro 1 · 18:45–22:45</p>
          <p className="font-mono text-lg font-bold">Estruturação de dados</p>
        </div>
        <Badge>
          <span aria-hidden="true" className="size-1.5 animate-pulse bg-primary-foreground" />
          Ao vivo
        </Badge>
      </div>

      <ReguaDoEncontro blocos={BLOCOS_DEMO} />

      <div className="flex gap-3 border-2 p-3">
        <div className="flex-1">
          <p className="eyebrow text-muted-foreground">Anônimo</p>
          <p className="text-[14px]">Quando usar referência absoluta em vez de relativa?</p>
        </div>
        <span className="flex h-fit flex-col items-center border-2 px-2 py-1 font-mono text-xs font-bold">
          <ThumbsUpIcon aria-hidden="true" className="size-3.5" />
          +12
        </span>
      </div>

      <div className="flex flex-col gap-2 border-2 p-3">
        <p className="eyebrow text-muted-foreground">Quiz · resultado da turma</p>
        <p className="text-[14px] font-bold">Qual símbolo fixa uma referência?</p>
        <ul className="flex flex-col gap-2">
          {RESULTADO_DEMO.map((r, i) => (
            <li key={r.opcao} className="flex items-center gap-3 text-[13px]">
              <span className="w-4 font-mono font-bold">{r.opcao}</span>
              <span className="h-3 flex-1 border-2 bg-background">
                <span
                  className={`block h-full transition-[width] duration-1000 ease-out ${r.correta ? 'bg-green' : 'bg-neutro'}`}
                  style={{ width: visivel ? `${r.percentual}%` : '0%', transitionDelay: `${200 + i * 150}ms` }}
                />
              </span>
              <span className="w-10 text-right font-mono">{r.percentual}%</span>
              {/* A cor não é a única pista: a correta tem rótulo em texto. */}
              <span className="w-14 text-xs font-bold">{r.correta ? 'Correta' : ''}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Apresenta a sala de aula interativa e leva à área do aluno. */
export function SalaInterativa() {
  return (
    <div className="grid items-start gap-10 md:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col gap-6">
        <p className="text-lg">
          Os cursos têm uma sala de aula própria. Você acompanha o calendário, acessa os materiais e participa da
          aula pelo celular ou pelo computador.
        </p>
        <ul className="flex flex-col gap-5">
          {RECURSOS.map((recurso, i) => (
            <Revelar key={recurso.titulo} como="li" atraso={i * 100} className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center border-2 bg-card">
                <recurso.icone aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h3 className="text-[17px]">{recurso.titulo}</h3>
                <p className="text-[14px] text-muted-foreground">{recurso.texto}</p>
              </div>
            </Revelar>
          ))}
        </ul>
        <Button asChild variant="secondary" className="self-start">
          <Link to="/aluno/entrar">Entrar na área do aluno</Link>
        </Button>
      </div>
      <Revelar atraso={150}>
        <PreviaDaSala />
      </Revelar>
    </div>
  )
}
