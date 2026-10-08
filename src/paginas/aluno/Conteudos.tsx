import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckIcon,
  FileTextIcon,
  GraduationCapIcon,
  Link2Icon,
  PaperclipIcon,
  PlayIcon,
  SearchXIcon,
  SparklesIcon,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Busca, CabecalhoDaPagina, Carregado, FiltroDeLista, Vazio } from '@/componentes/plataforma/Blocos'
import { cn } from '@/lib/utils'
import { useTurmaAtual } from '@/componentes/plataforma/LayoutAluno'
import { conteudosAcessados, listarConteudos, ROTULO_TIPO_CONTEUDO, type Conteudo } from '@/dados/apoio'
import { contem } from '@/dominio/busca'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'

type Filtro = 'todos' | 'aulas' | 'aulas_extras' | 'materiais'

const FILTROS: { valor: Filtro; rotulo: string; aceita: (c: Conteudo) => boolean }[] = [
  { valor: 'todos', rotulo: 'Todos', aceita: () => true },
  { valor: 'aulas', rotulo: 'Aulas', aceita: (c) => c.tipo === 'aula' },
  { valor: 'aulas_extras', rotulo: 'Aulas extras', aceita: (c) => c.tipo === 'aula_extra' },
  { valor: 'materiais', rotulo: 'Materiais', aceita: (c) => !['aula', 'aula_extra'].includes(c.tipo) },
]

/** Ícone e cor da faixa de cada tipo. Texto sempre com o par que passa em contraste. */
const VISUAL: Record<Conteudo['tipo'], { icone: LucideIcon; faixa: string }> = {
  aula: { icone: GraduationCapIcon, faixa: 'bg-primary text-primary-foreground' },
  aula_extra: { icone: SparklesIcon, faixa: 'bg-orange text-tinta' },
  texto: { icone: FileTextIcon, faixa: 'bg-tinta text-papel' },
  video: { icone: PlayIcon, faixa: 'bg-violet-tint text-tinta' },
  link: { icone: Link2Icon, faixa: 'bg-violet-tint text-tinta' },
  arquivo: { icone: PaperclipIcon, faixa: 'bg-green text-tinta' },
}

async function carregar(turmaId: string) {
  const [conteudos, acessados] = await Promise.all([listarConteudos(turmaId), conteudosAcessados()])
  return { conteudos, acessados }
}

function IconeDoTipo({ tipo }: { tipo: Conteudo['tipo'] }) {
  const Icone = VISUAL[tipo].icone
  return <Icone aria-hidden="true" className="size-12 transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110" strokeWidth={1.5} />
}

/** Conteúdos que o professor publicou para a turma, com busca e filtro por tipo. */
export default function Conteudos() {
  const turma = useTurmaAtual()
  const consulta = useConsulta(() => carregar(turma.id), [turma.id])
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')

  return (
    <>
      <CabecalhoDaPagina
        rotulo="Estudo"
        titulo="Conteúdos"
        icone={BookOpenIcon}
        cor="roxo"
        descricao="Aulas extras e materiais de apoio para as aulas presenciais."
      >
        <Busca valor={busca} aoMudar={setBusca} rotulo="Pesquisar conteúdos" />
      </CabecalhoDaPagina>

      <FiltroDeLista rotulo="Filtrar por tipo" valor={filtro} aoMudar={setFiltro} opcoes={FILTROS.map((f) => [f.valor, f.rotulo])} />

      <Carregado consulta={consulta}>
        {({ conteudos, acessados }) => {
          const aceita = FILTROS.find((f) => f.valor === filtro)!.aceita
          const visiveis = conteudos.filter((c) => aceita(c) && contem(busca, c.titulo, c.descricao))

          if (conteudos.length === 0) {
            return <Vazio icone={BookOpenIcon} titulo="Nada publicado ainda" texto="Quando o professor publicar um conteúdo, ele aparece aqui." />
          }
          if (visiveis.length === 0) {
            return <Vazio icone={SearchXIcon} titulo="Nenhum conteúdo encontrado" texto="Tente outro termo ou troque o filtro." />
          }
          return (
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visiveis.map((c) => (
                <li key={c.id}>
                  <Link to={`/aluno/conteudos/${c.id}`} className="group block h-full">
                    <Card className="h-full gap-0 overflow-hidden py-0 transition-transform duration-200 group-hover:-translate-y-1">
                      <div className={cn('flex h-24 items-end justify-between gap-3 border-b-2 px-4 py-3', VISUAL[c.tipo].faixa)}>
                        <span className="eyebrow">{ROTULO_TIPO_CONTEUDO[c.tipo]}</span>
                        <IconeDoTipo tipo={c.tipo} />
                      </div>
                      <CardContent className="flex h-full flex-col gap-3 py-4">
                        {acessados.has(c.id) && (
                          <Badge variant="green" className="self-start">
                            <CheckIcon aria-hidden="true" />
                            Visto
                          </Badge>
                        )}
                        <h2 className="text-[19px]">{c.titulo}</h2>
                        {c.descricao && <p className="text-sm text-muted-foreground">{c.descricao}</p>}
                        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {c.publicado_em ? formatarDataHora(c.publicado_em, 'America/Sao_Paulo') : ''}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
                            Abrir
                            <ArrowRightIcon aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }}
      </Carregado>
    </>
  )
}
