import {
  ActivityIcon,
  BookOpenIcon,
  CircleHelpIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  FileTextIcon,
  InboxIcon,
  ListChecksIcon,
  LockIcon,
  MessageSquareIcon,
  MessagesSquareIcon,
  UserCheckIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CabecalhoDaPagina, Carregado, Numero, Vazio } from '@/componentes/plataforma/Blocos'
import { useSessao } from '@/contextos/Sessao'
import { buscarResumoDoPainel } from '@/dados/admin'
import { buscarResumoDaPlataforma } from '@/dados/professor'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'

const FUSO = 'America/Sao_Paulo'

const ROTULO_EVENTO: Record<string, string> = {
  cadastro: 'Cadastro',
  atividade: 'Atividade',
  duvida: 'Dúvida',
  feedback: 'Feedback',
  mensagem: 'Mensagem',
  conteudo: 'Conteúdo',
}

async function carregar() {
  const [plataforma, turmas] = await Promise.all([buscarResumoDaPlataforma(), buscarResumoDoPainel()])
  return { ...plataforma, turmas }
}

function Atalho({ para, rotulo, valor, icone, detalhe }: { para: string; rotulo: string; valor: number; icone: LucideIcon; detalhe?: string }) {
  return (
    <Link to={para} className="block focus-visible:outline-2 focus-visible:outline-offset-2">
      <Numero rotulo={rotulo} valor={valor} icone={icone} detalhe={detalhe} />
    </Link>
  )
}

function Grupo({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-[19px]">
        {titulo}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  )
}

/** Painel inicial do professor: números reais da plataforma e atividade recente. */
export default function Painel() {
  const { perfil } = useSessao()
  const consulta = useConsulta(carregar, [])

  return (
    <>
      <CabecalhoDaPagina
        rotulo="Painel"
        titulo={`Olá${perfil ? `, ${perfil.nome.split(' ')[0]}` : ''}`}
        descricao="O que está acontecendo com os seus alunos agora."
      />

      <Carregado consulta={consulta} linhas={4}>
        {({ resumo, recentes, turmas }) => (
          <>
            {turmas.sessoesAbertas > 0 && (
              <p className="border-l-2 border-primary pl-3 font-semibold">
                {turmas.sessoesAbertas === 1 ? 'Há 1 sessão ao vivo aberta.' : `Há ${turmas.sessoesAbertas} sessões ao vivo abertas.`}
              </p>
            )}

            <Grupo id="titulo-alunos" titulo="Alunos">
              <Atalho
                para="/admin/alunos"
                rotulo="Total de alunos"
                valor={resumo.alunos.total}
                icone={UsersIcon}
                detalhe={`${turmas.turmasAtivas} ${turmas.turmasAtivas === 1 ? 'turma ativa' : 'turmas ativas'}`}
              />
              <Atalho
                para="/admin/alunos"
                rotulo="Alunos ativos"
                valor={resumo.alunos.ativos}
                icone={UserCheckIcon}
                detalhe={resumo.alunos.semConta > 0 ? `${resumo.alunos.semConta} ainda sem conta` : undefined}
              />
              <Atalho para="/admin/alunos" rotulo="Alunos bloqueados" valor={resumo.alunos.bloqueados} icone={LockIcon} />
              <Atalho para="/admin/alunos" rotulo="Novos cadastros" valor={resumo.alunos.novos} icone={UserPlusIcon} detalhe="Nos últimos 7 dias" />
            </Grupo>

            <Grupo id="titulo-ensino" titulo="Conteúdo">
              <Atalho para="/admin/conteudos" rotulo="Aulas" valor={resumo.conteudo.aulas} icone={BookOpenIcon} />
              <Atalho para="/admin/atividades" rotulo="Atividades" valor={resumo.conteudo.atividades} icone={ClipboardListIcon} />
              <Atalho para="/admin/questoes" rotulo="Questões" valor={resumo.conteudo.questoes} icone={ListChecksIcon} />
              <Atalho para="/admin/conteudos" rotulo="Materiais" valor={resumo.conteudo.materiais} icone={FileTextIcon} />
            </Grupo>

            <Grupo id="titulo-interacoes" titulo="Interações">
              <Atalho para="/admin/duvidas" rotulo="Perguntas pendentes" valor={resumo.interacoes.duvidasPendentes} icone={CircleHelpIcon} />
              <Atalho para="/admin/feedbacks" rotulo="Feedbacks não lidos" valor={resumo.interacoes.feedbacksNaoLidos} icone={MessageSquareIcon} />
              <Atalho
                para="/admin/atividades"
                rotulo="Atividades enviadas"
                valor={resumo.interacoes.atividadesEnviadas}
                icone={ClipboardCheckIcon}
              />
              <Atalho para="/admin/conversas" rotulo="Mensagens não lidas" valor={resumo.interacoes.mensagensNaoLidas} icone={MessagesSquareIcon} />
            </Grupo>

            <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2 className="text-[19px]">Atividade recente</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentes.length === 0 ? (
                    <Vazio icone={ActivityIcon} titulo="Nada por aqui ainda" texto="Cadastros, respostas, dúvidas e feedbacks dos alunos aparecem aqui." />
                  ) : (
                    <ul className="flex flex-col">
                      {recentes.map((e, i) => (
                        <li key={`${e.quando}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-divisor py-3 first:border-t-0">
                          <Badge variant="outline">{ROTULO_EVENTO[e.tipo] ?? e.tipo}</Badge>
                          <span className="min-w-0 flex-1 text-sm">
                            <span className="font-semibold">{e.aluno}</span> {e.descricao}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">{formatarDataHora(e.quando, FUSO)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2 className="text-[19px]">Site</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Link to="/admin/mensagens" className="flex items-center gap-3 border-2 p-3 hover:bg-accent">
                    <InboxIcon aria-hidden="true" className="size-5" />
                    <span className="flex-1 text-sm font-semibold">Contatos não lidos</span>
                    <span className="destaque text-xl">{resumo.contatosNaoLidos}</span>
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {turmas.turmasPlanejadas === 1 ? '1 turma planejada' : `${turmas.turmasPlanejadas} turmas planejadas`} ·{' '}
                    {turmas.inscritos === 1 ? '1 aluno com conta' : `${turmas.inscritos} alunos com conta`}
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </Carregado>
    </>
  )
}
