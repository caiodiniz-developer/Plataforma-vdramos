import {
  ArrowRightIcon,
  BookOpenIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  ListChecksIcon,
  MegaphoneIcon,
  TargetIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CabecalhoDaPagina, Carregado, Numero, Vazio } from '@/componentes/plataforma/Blocos'
import { useTurmaAtual } from '@/componentes/plataforma/LayoutAluno'
import { useSessao } from '@/contextos/Sessao'
import {
  listarAvisos,
  listarConteudos,
  meuProgresso,
  minhasAtividades,
  minhasDuvidas,
  ROTULO_TIPO_CONTEUDO,
} from '@/dados/apoio'
import { percentualDe } from '@/dominio/busca'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'

const FUSO = 'America/Sao_Paulo'

async function carregar(turmaId: string) {
  const [progresso, conteudos, atividades, duvidas, avisos] = await Promise.all([
    meuProgresso(turmaId),
    listarConteudos(turmaId),
    minhasAtividades(turmaId),
    minhasDuvidas(turmaId),
    listarAvisos(turmaId),
  ])
  return { progresso, conteudos, atividades, duvidas, avisos }
}

function Bloco({ titulo, para, verTudo, children }: { titulo: string; para: string; verTudo: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>
          <h2 className="text-[19px]">{titulo}</h2>
        </CardTitle>
        <Button asChild variant="link" size="sm" className="px-0">
          <Link to={para}>
            {verTudo}
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

/** Painel do aluno: progresso, conteúdos recentes, atividades, dúvidas e avisos. */
export default function Inicio() {
  const turma = useTurmaAtual()
  const { perfil } = useSessao()
  const consulta = useConsulta(() => carregar(turma.id), [turma.id])
  const primeiroNome = perfil?.nome.split(' ')[0] ?? ''

  return (
    <>
      <CabecalhoDaPagina
        rotulo={`Turma ${turma.codigo}`}
        titulo={`Olá, ${primeiroNome}`}
        descricao="Aqui ficam os conteúdos extras, as atividades e o canal direto com o professor."
      />

      <Carregado consulta={consulta} linhas={4}>
        {({ progresso, conteudos, atividades, duvidas, avisos }) => {
          const licoes = atividades.filter((a) => a.tipo !== 'questao')
          const pendentes = licoes.filter((a) => !a.respondida && a.status === 'publicada')
          const desempenho = percentualDe(progresso.questoes_corretas, progresso.questoes_respondidas)
          const percConteudo = percentualDe(progresso.conteudos_acessados, progresso.conteudos_disponiveis)

          return (
            <>
              <section aria-labelledby="titulo-progresso" className="flex flex-col gap-4">
                <h2 id="titulo-progresso" className="text-[19px]">
                  Seu progresso
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Numero
                    icone={ClipboardListIcon}
                    rotulo="Atividades realizadas"
                    valor={`${progresso.atividades_realizadas}/${progresso.atividades_disponiveis}`}
                  />
                  <Numero icone={ListChecksIcon} rotulo="Questões respondidas" valor={progresso.questoes_respondidas} />
                  <Numero
                    icone={BookOpenIcon}
                    rotulo="Conteúdos acessados"
                    valor={`${progresso.conteudos_acessados}/${progresso.conteudos_disponiveis}`}
                  />
                  <Numero
                    icone={TargetIcon}
                    rotulo="Desempenho"
                    valor={progresso.questoes_respondidas > 0 ? `${desempenho}%` : '—'}
                    detalhe={
                      progresso.questoes_respondidas > 0
                        ? `${progresso.questoes_corretas} acertos em ${progresso.questoes_respondidas} questões`
                        : 'Responda questões para ver seu desempenho'
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Conteúdos da turma</span>
                    <span className="font-mono">{percConteudo}%</span>
                  </div>
                  <Progress value={percConteudo} aria-label="Conteúdos acessados" className="h-2" />
                </div>
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                <Bloco titulo="Conteúdos recentes" para="/aluno/conteudos" verTudo="Ver todos">
                  {conteudos.length === 0 ? (
                    <Vazio icone={BookOpenIcon} titulo="Nada publicado ainda" texto="Os conteúdos do professor aparecem aqui." />
                  ) : (
                    <ul className="flex flex-col">
                      {conteudos.slice(0, 4).map((c) => (
                        <li key={c.id} className="border-t border-divisor first:border-t-0">
                          <Link to={`/aluno/conteudos/${c.id}`} className="flex items-center gap-3 py-3 hover:bg-accent">
                            <span className="min-w-0 flex-1">
                              <span className="eyebrow block text-muted-foreground">{ROTULO_TIPO_CONTEUDO[c.tipo]}</span>
                              <span className="block truncate font-semibold">{c.titulo}</span>
                            </span>
                            <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Bloco>

                <Bloco titulo="Atividades" para="/aluno/atividades" verTudo="Ver todas">
                  {licoes.length === 0 ? (
                    <Vazio icone={ClipboardListIcon} titulo="Sem atividades por enquanto" />
                  ) : (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm">
                        <span className="destaque text-lg">{pendentes.length}</span> pendente{pendentes.length === 1 ? '' : 's'} ·{' '}
                        <span className="destaque text-lg">{licoes.length - pendentes.length}</span> concluída
                        {licoes.length - pendentes.length === 1 ? '' : 's'}
                      </p>
                      <ul className="flex flex-col">
                        {licoes.slice(0, 4).map((a) => (
                          <li key={a.id} className="flex items-center gap-3 border-t border-divisor py-3 first:border-t-0">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{a.titulo}</span>
                              {a.prazo_em && (
                                <span className="font-mono text-xs text-muted-foreground">
                                  Prazo: {formatarDataHora(a.prazo_em, FUSO)}
                                </span>
                              )}
                            </span>
                            <Badge variant={a.respondida ? 'green' : 'outline'}>{a.respondida ? 'Concluída' : 'Pendente'}</Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Bloco>

                <Bloco titulo="Minhas dúvidas" para="/aluno/duvidas" verTudo="Abrir">
                  {duvidas.length === 0 ? (
                    <Vazio icone={CircleHelpIcon} titulo="Nenhuma dúvida enviada" texto="Ficou com dúvida? Pergunte direto ao professor.">
                      <Button asChild size="sm">
                        <Link to="/aluno/duvidas">Enviar dúvida</Link>
                      </Button>
                    </Vazio>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm">
                        <span className="destaque text-lg">{progresso.duvidas_abertas}</span> aberta
                        {progresso.duvidas_abertas === 1 ? '' : 's'} ·{' '}
                        <span className="destaque text-lg">{progresso.duvidas_respondidas}</span> respondida
                        {progresso.duvidas_respondidas === 1 ? '' : 's'}
                      </p>
                      <ul className="flex flex-col">
                        {duvidas.slice(0, 3).map((d) => (
                          <li key={d.id} className="flex items-center gap-3 border-t border-divisor py-3 first:border-t-0">
                            <span className="min-w-0 flex-1 truncate font-semibold">{d.titulo}</span>
                            <Badge variant={d.status === 'respondida' ? 'green' : 'outline'}>
                              {d.status === 'respondida' ? 'Respondida' : d.status === 'arquivada' ? 'Arquivada' : 'Aberta'}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Bloco>

                <Bloco titulo="Avisos" para="/aluno/avisos" verTudo="Ver todos">
                  {avisos.length === 0 ? (
                    <Vazio icone={MegaphoneIcon} titulo="Nenhum aviso" texto="Os comunicados do professor aparecem aqui." />
                  ) : (
                    <ul className="flex flex-col gap-4">
                      {avisos.slice(0, 3).map((a) => (
                        <li key={a.id} className="border-l-2 border-primary pl-3">
                          <p className="font-semibold">{a.titulo}</p>
                          <p className="text-sm text-muted-foreground">{a.texto}</p>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{formatarDataHora(a.created_at, FUSO)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Bloco>
              </div>
            </>
          )
        }}
      </Carregado>
    </>
  )
}
