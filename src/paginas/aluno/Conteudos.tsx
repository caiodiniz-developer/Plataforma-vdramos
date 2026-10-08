import { ArrowRightIcon, BookOpenIcon, CheckIcon, SearchXIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Busca, CabecalhoDaPagina, Carregado, FiltroDeLista, Vazio } from '@/componentes/plataforma/Blocos'
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

async function carregar(turmaId: string) {
  const [conteudos, acessados] = await Promise.all([listarConteudos(turmaId), conteudosAcessados()])
  return { conteudos, acessados }
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
            <ul className="grid gap-4 sm:grid-cols-2">
              {visiveis.map((c) => (
                <li key={c.id}>
                  <Link to={`/aluno/conteudos/${c.id}`} className="group block h-full">
                    <Card className="h-full transition-[transform,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary">
                      <CardContent className="flex h-full flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={c.tipo === 'aula_extra' ? 'default' : 'outline'}>{ROTULO_TIPO_CONTEUDO[c.tipo]}</Badge>
                          {acessados.has(c.id) && (
                            <Badge variant="green">
                              <CheckIcon aria-hidden="true" />
                              Visto
                            </Badge>
                          )}
                        </div>
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
