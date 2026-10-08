import { CheckIcon, ClipboardListIcon, ClockIcon, ListChecksIcon, SearchXIcon } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RespostaDaAtividade } from '@/componentes/atividade/RespostaDaAtividade'
import { Busca, CabecalhoDaPagina, Carregado, FiltroDeLista, Vazio } from '@/componentes/plataforma/Blocos'
import { useTurmaAtual } from '@/componentes/plataforma/LayoutAluno'
import { minhasAtividades, type AtividadeDoAluno } from '@/dados/apoio'
import { contem, percentualDe } from '@/dominio/busca'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'

const FUSO = 'America/Sao_Paulo'
const ROTULO_DIFICULDADE = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' } as const

type Filtro = 'pendentes' | 'concluidas' | 'todas'

function Situacao({ atividade, agora }: { atividade: AtividadeDoAluno; agora: number }) {
  if (atividade.respondida) {
    return (
      <Badge variant="green">
        <CheckIcon aria-hidden="true" />
        Concluída
      </Badge>
    )
  }
  const vencida = atividade.status === 'encerrada' || (atividade.prazo_em !== null && new Date(atividade.prazo_em).getTime() < agora)
  return <Badge variant={vencida ? 'neutro' : 'outline'}>{vencida ? 'Encerrada' : 'Pendente'}</Badge>
}

/**
 * Lista de atividades (lições e quizzes) ou de questões avulsas da turma,
 * com a situação do aluno em cada uma. As duas telas usam a mesma estrutura.
 */
function ListaDeAtividades({ modo }: { modo: 'atividades' | 'questoes' }) {
  const turma = useTurmaAtual()
  const consulta = useConsulta(() => minhasAtividades(turma.id), [turma.id])
  const [filtro, setFiltro] = useState<Filtro>(modo === 'atividades' ? 'pendentes' : 'todas')
  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState<string | null>(null)
  // Instante fixado na montagem, para o prazo não mudar no meio de uma renderização.
  const [agora] = useState(() => Date.now())
  const ehQuestoes = modo === 'questoes'

  return (
    <>
      <CabecalhoDaPagina
        rotulo="Prática"
        titulo={ehQuestoes ? 'Questões' : 'Atividades'}
        descricao={
          ehQuestoes
            ? 'Responda e veja na hora se acertou, com a explicação do professor.'
            : 'Lições e exercícios que o professor passou para a turma.'
        }
      >
        <Busca valor={busca} aoMudar={setBusca} rotulo={ehQuestoes ? 'Pesquisar questões' : 'Pesquisar atividades'} />
      </CabecalhoDaPagina>

      <Carregado consulta={consulta}>
        {(todas) => {
          const doModo = todas.filter((a) => (ehQuestoes ? a.tipo === 'questao' : a.tipo !== 'questao'))
          const respondidas = doModo.filter((a) => a.respondida)
          const acertos = respondidas.reduce((soma, a) => soma + a.acertos, 0)
          const visiveis = doModo.filter(
            (a) =>
              contem(busca, a.titulo, a.descricao, a.categoria) &&
              (filtro === 'todas' || (filtro === 'concluidas' ? a.respondida : !a.respondida)),
          )

          if (doModo.length === 0) {
            return (
              <Vazio
                icone={ehQuestoes ? ListChecksIcon : ClipboardListIcon}
                titulo={ehQuestoes ? 'Sem questões por enquanto' : 'Sem atividades por enquanto'}
                texto="Quando o professor publicar, você recebe uma notificação."
              />
            )
          }

          return (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <FiltroDeLista
                  rotulo="Filtrar por situação"
                  valor={filtro}
                  aoMudar={setFiltro}
                  opcoes={[
                    ['pendentes', 'Pendentes'],
                    ['concluidas', 'Concluídas'],
                    ['todas', 'Todas'],
                  ]}
                />
                <p className="text-sm text-muted-foreground">
                  <span className="destaque text-base text-foreground">
                    {respondidas.length}/{doModo.length}
                  </span>{' '}
                  {ehQuestoes ? 'respondidas' : 'concluídas'}
                  {ehQuestoes && respondidas.length > 0 && (
                    <>
                      {' '}
                      · <span className="destaque text-base text-foreground">{percentualDe(acertos, respondidas.length)}%</span> de
                      acerto
                    </>
                  )}
                </p>
              </div>

              {visiveis.length === 0 ? (
                <Vazio icone={SearchXIcon} titulo="Nada neste filtro" texto="Troque o filtro ou o termo da pesquisa." />
              ) : (
                <ul className="flex flex-col gap-4">
                  {visiveis.map((a) => (
                    <li key={a.id}>
                      <Card>
                        <CardContent className="flex flex-col gap-4">
                          <div className="flex flex-wrap items-start gap-3">
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Situacao atividade={a} agora={agora} />
                                {a.categoria && <Badge variant="outline">{a.categoria}</Badge>}
                                {a.dificuldade && <Badge variant="neutro">{ROTULO_DIFICULDADE[a.dificuldade]}</Badge>}
                                {ehQuestoes && a.respondida && (
                                  <Badge variant={a.acertos > 0 ? 'green' : 'orange'}>{a.acertos > 0 ? 'Acertou' : 'Errou'}</Badge>
                                )}
                              </div>
                              <h2 className="text-[19px]">{a.titulo}</h2>
                              {a.descricao && <p className="text-sm text-muted-foreground">{a.descricao}</p>}
                              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                                {!ehQuestoes && (
                                  <span>
                                    {a.itens} {a.itens === 1 ? 'item' : 'itens'}
                                  </span>
                                )}
                                {a.prazo_em && (
                                  <span className="inline-flex items-center gap-1.5">
                                    <ClockIcon aria-hidden="true" className="size-3.5" />
                                    Prazo: {formatarDataHora(a.prazo_em, FUSO)}
                                  </span>
                                )}
                                {a.respondida_em && <span>Enviada em {formatarDataHora(a.respondida_em, FUSO)}</span>}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant={a.respondida ? 'outline' : 'default'}
                              aria-expanded={aberta === a.id}
                              onClick={() => setAberta(aberta === a.id ? null : a.id)}
                            >
                              {aberta === a.id ? 'Fechar' : a.respondida ? 'Ver respostas' : 'Responder'}
                            </Button>
                          </div>
                          {aberta === a.id && (
                            <div className="border-t-2 pt-4">
                              <RespostaDaAtividade atividadeId={a.id} aoResponder={consulta.recarregar} />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        }}
      </Carregado>
    </>
  )
}

export function Atividades() {
  return <ListaDeAtividades modo="atividades" />
}

export function Questoes() {
  return <ListaDeAtividades modo="questoes" />
}
