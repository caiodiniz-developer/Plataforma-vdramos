import { ArrowLeftIcon, BookOpenIcon, CircleHelpIcon, ClipboardListIcon, ListChecksIcon, MessageSquareIcon, TargetIcon, UserXIcon } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CabecalhoDaPagina, Carregado, Numero, Vazio } from '@/componentes/plataforma/Blocos'
import { Conversa } from '@/componentes/plataforma/Conversa'
import { TextoComLinks } from '@/componentes/plataforma/Links'
import { ROTULO_TIPO_FEEDBACK } from '@/dados/apoio'
import {
  buscarPerfilDoAluno,
  listarAlunos,
  marcarConversaLida,
  mensagensDaConversa,
  responderAoAluno,
  type AlunoDoProfessor,
  type PerfilDoAluno,
} from '@/dados/professor'
import { percentualDe } from '@/dominio/busca'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'
import { ROTULO_SITUACAO, VARIANTE_SITUACAO } from './situacao'

const FUSO = 'America/Sao_Paulo'
const ROTULO_DUVIDA = { aberta: 'Aberta', respondida: 'Respondida', arquivada: 'Arquivada' } as const

async function carregar(id: string) {
  const aluno = (await listarAlunos()).find((a) => a.aluno_autorizado_id === id) ?? null
  if (!aluno || !aluno.inscricao_id) return { aluno, perfil: null, mensagens: [] }
  const [perfil, mensagens] = await Promise.all([buscarPerfilDoAluno(aluno.inscricao_id), mensagensDaConversa(aluno.inscricao_id)])
  if (mensagens.some((m) => m.autor === 'aluno' && m.lida_em === null)) await marcarConversaLida(aluno.inscricao_id)
  return { aluno, perfil, mensagens }
}

function Linha({ children }: { children: React.ReactNode }) {
  return <li className="flex flex-col gap-1 border-t border-divisor py-3 first:border-t-0">{children}</li>
}

function Quando({ em }: { em: string }) {
  return <span className="font-mono text-[11px] text-muted-foreground">{formatarDataHora(em, FUSO)}</span>
}

function Abas({ aluno, perfil, children }: { aluno: AlunoDoProfessor; perfil: PerfilDoAluno; children: React.ReactNode }) {
  return (
    <Tabs defaultValue="respostas" className="gap-5">
      <TabsList className="max-w-full justify-start overflow-x-auto">
        <TabsTrigger value="respostas">Respostas</TabsTrigger>
        <TabsTrigger value="duvidas">Dúvidas</TabsTrigger>
        <TabsTrigger value="feedbacks">Feedbacks</TabsTrigger>
        <TabsTrigger value="conteudos">Conteúdos</TabsTrigger>
        <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
      </TabsList>

      <TabsContent value="respostas">
        {perfil.respostas.length === 0 ? (
          <Vazio icone={ClipboardListIcon} titulo="Nenhuma resposta ainda" texto="As respostas de atividades e questões deste aluno aparecem aqui." />
        ) : (
          <Card>
            <CardContent>
              <ul className="flex flex-col">
                {perfil.respostas.map((r, i) => (
                  <Linha key={i}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{r.atividade}</span>
                      {r.correta !== null && <Badge variant={r.correta ? 'green' : 'orange'}>{r.correta ? 'Acertou' : 'Errou'}</Badge>}
                      <span className="ml-auto">
                        <Quando em={r.created_at} />
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {r.item}. {r.enunciado}
                    </p>
                    <p className="text-[15px] whitespace-pre-wrap">{r.opcoes ?? r.texto ?? '—'}</p>
                  </Linha>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="duvidas">
        {perfil.duvidas.length === 0 ? (
          <Vazio icone={CircleHelpIcon} titulo="Nenhuma dúvida enviada" />
        ) : (
          <Card>
            <CardContent>
              <ul className="flex flex-col">
                {perfil.duvidas.map((d) => (
                  <Linha key={d.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{d.titulo}</span>
                      <Badge variant={d.status === 'respondida' ? 'green' : d.status === 'arquivada' ? 'neutro' : 'outline'}>
                        {ROTULO_DUVIDA[d.status]}
                      </Badge>
                      <span className="ml-auto">
                        <Quando em={d.created_at} />
                      </span>
                    </div>
                    <TextoComLinks texto={d.pergunta} className="text-[15px]" />
                    {d.resposta && <TextoComLinks texto={d.resposta} className="border-l-2 border-primary pl-3 text-sm" />}
                  </Linha>
                ))}
              </ul>
              <Button asChild variant="link" size="sm" className="mt-2 px-0">
                <Link to="/admin/duvidas">Responder em Dúvidas</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="feedbacks">
        {perfil.feedbacks.length === 0 ? (
          <Vazio icone={MessageSquareIcon} titulo="Nenhum feedback enviado" />
        ) : (
          <Card>
            <CardContent>
              <ul className="flex flex-col">
                {perfil.feedbacks.map((f) => (
                  <Linha key={f.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{ROTULO_TIPO_FEEDBACK[f.tipo]}</Badge>
                      <span className="ml-auto">
                        <Quando em={f.created_at} />
                      </span>
                    </div>
                    <p className="text-[15px] whitespace-pre-wrap">{f.texto}</p>
                  </Linha>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="conteudos">
        {perfil.acessos.length === 0 ? (
          <Vazio icone={BookOpenIcon} titulo="Nenhum conteúdo acessado" />
        ) : (
          <Card>
            <CardContent>
              <ul className="flex flex-col">
                {perfil.acessos.map((a, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-3 border-t border-divisor py-3 first:border-t-0">
                    <span className="min-w-0 flex-1 font-semibold">{a.titulo}</span>
                    <Quando em={a.ultimo_em} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="mensagens">
        <p className="mb-3 text-sm text-muted-foreground">Conversa privada com {aluno.nome}.</p>
        {children}
      </TabsContent>
    </Tabs>
  )
}

/** Perfil detalhado do aluno: dados, progresso e tudo o que ele enviou. */
export default function AlunoPerfil() {
  const { id = '' } = useParams()
  const consulta = useConsulta(() => carregar(id), [id])

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/admin/alunos">
          <ArrowLeftIcon aria-hidden="true" />
          Alunos
        </Link>
      </Button>

      <Carregado consulta={consulta} linhas={4}>
        {({ aluno, perfil, mensagens }) =>
          !aluno ? (
            <Vazio icone={UserXIcon} titulo="Aluno não encontrado" texto="Ele pode ter sido removido." />
          ) : (
            <>
              <CabecalhoDaPagina rotulo="Perfil do aluno" titulo={aluno.nome ?? 'Sem nome'}>
                <Badge variant={VARIANTE_SITUACAO[aluno.situacao]}>{ROTULO_SITUACAO[aluno.situacao]}</Badge>
              </CabecalhoDaPagina>

              <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="eyebrow text-muted-foreground">ID do aluno</dt>
                  <dd className="destaque text-base">{aluno.matricula}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-muted-foreground">ID da turma</dt>
                  <dd className="destaque text-base">{aluno.turma_codigo}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-muted-foreground">Cadastro</dt>
                  <dd>{aluno.cadastrado_em ? formatarDataHora(aluno.cadastrado_em, FUSO) : 'Ainda não criou a conta'}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-muted-foreground">Último acesso</dt>
                  <dd>{aluno.ultimo_acesso_em ? formatarDataHora(aluno.ultimo_acesso_em, FUSO) : 'Nunca'}</dd>
                </div>
              </dl>

              {!perfil ? (
                <Vazio
                  icone={UserXIcon}
                  titulo="Este aluno ainda não criou a conta"
                  texto="Quando ele fizer o primeiro acesso, o progresso e as interações aparecem aqui."
                />
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Numero icone={ClipboardListIcon} rotulo="Atividades realizadas" valor={aluno.atividades_realizadas} />
                    <Numero icone={ListChecksIcon} rotulo="Questões respondidas" valor={aluno.questoes_respondidas} />
                    <Numero
                      icone={TargetIcon}
                      rotulo="Desempenho"
                      valor={aluno.questoes_respondidas > 0 ? `${percentualDe(aluno.questoes_corretas, aluno.questoes_respondidas)}%` : '—'}
                      detalhe={aluno.questoes_respondidas > 0 ? `${aluno.questoes_corretas} acertos` : 'Sem questões respondidas'}
                    />
                    <Numero icone={BookOpenIcon} rotulo="Conteúdos acessados" valor={aluno.conteudos_acessados} />
                  </div>

                  <Abas aluno={aluno} perfil={perfil}>
                    <Conversa
                      mensagens={mensagens}
                      eu="professor"
                      nomeDoOutro={aluno.nome ?? 'Aluno'}
                      vazio="Nenhuma mensagem ainda. Escreva a primeira."
                      aoEnviar={async (texto) => {
                        await responderAoAluno(aluno.inscricao_id!, texto)
                        consulta.recarregar()
                      }}
                    />
                  </Abas>
                </>
              )}
            </>
          )
        }
      </Carregado>
    </>
  )
}
