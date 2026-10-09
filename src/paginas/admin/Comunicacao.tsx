import { ArrowLeftIcon, Loader2Icon, MegaphoneIcon, MessageSquareIcon, MessagesSquareIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Busca, CabecalhoDaPagina, Carregado, FiltroDeLista, Vazio } from '@/componentes/plataforma/Blocos'
import { Confirmar, type Confirmacao } from '@/componentes/plataforma/Confirmar'
import { Conversa } from '@/componentes/plataforma/Conversa'
import { comLink, InserirLink, TextoComLinks } from '@/componentes/plataforma/Links'
import { assinarMudancas, ROTULO_TIPO_FEEDBACK } from '@/dados/apoio'
import {
  enviarAvisoPorEmail,
  excluirAviso,
  listarConversas,
  listarFeedbacks,
  listarTodosOsAvisos,
  listarTurmas,
  marcarConversaLida,
  marcarFeedback,
  mensagensDaConversa,
  publicarAviso,
  responderAoAluno,
  type ConversaDoProfessor,
} from '@/dados/professor'
import { contem } from '@/dominio/busca'
import { formatarDataHora } from '@/dominio/tempo'
import { instituicoesDe, TODAS, turmasDaInstituicao } from '@/dominio/turmas'
import { useConsulta } from '@/hooks/useConsulta'
import { cn } from '@/lib/utils'

const FUSO = 'America/Sao_Paulo'

// ---------------------------------------------------------------------------
// Mensagens privadas
// ---------------------------------------------------------------------------

async function carregarConversa(inscricaoId: string) {
  const mensagens = await mensagensDaConversa(inscricaoId)
  if (mensagens.some((m) => m.autor === 'aluno' && m.lida_em === null)) await marcarConversaLida(inscricaoId)
  return mensagens
}

function ConversaAberta({ conversa, aoMudar }: { conversa: ConversaDoProfessor; aoMudar: () => void }) {
  const consulta = useConsulta(() => carregarConversa(conversa.inscricao_id), [conversa.inscricao_id])
  const { recarregar } = consulta
  useEffect(
    () => assinarMudancas('mensagem_privada', recarregar, `inscricao_id=eq.${conversa.inscricao_id}`),
    [conversa.inscricao_id, recarregar],
  )
  return (
    <Carregado consulta={consulta}>
      {(mensagens) => (
        <Conversa
          mensagens={mensagens}
          eu="professor"
          nomeDoOutro={conversa.aluno}
          vazio="Nenhuma mensagem ainda."
          aoEnviar={async (texto) => {
            await responderAoAluno(conversa.inscricao_id, texto)
            consulta.recarregar()
            aoMudar()
          }}
        />
      )}
    </Carregado>
  )
}

/** Conversas privadas com os alunos. Para iniciar uma, use "Enviar mensagem" em Alunos. */
export function Conversas() {
  const consulta = useConsulta(listarConversas, [])
  const { recarregar } = consulta
  // Mensagem nova de qualquer aluno atualiza a lista e o contador de não lidas.
  useEffect(() => assinarMudancas('mensagem_privada', recarregar), [recarregar])
  const [parametros, setParametros] = useSearchParams()
  const [busca, setBusca] = useState('')
  const aberta = parametros.get('aluno')

  return (
    <>
      <CabecalhoDaPagina rotulo="Comunicação" titulo="Mensagens" descricao="Conversas privadas com cada aluno. Só você e ele veem.">
        <Busca valor={busca} aoMudar={setBusca} rotulo="Pesquisar por aluno" />
      </CabecalhoDaPagina>

      <Carregado consulta={consulta}>
        {(conversas) => {
          const atual = conversas.find((c) => c.inscricao_id === aberta) ?? null
          const visiveis = conversas.filter((c) => contem(busca, c.aluno, c.turma_codigo))

          if (conversas.length === 0) {
            return (
              <Vazio
                icone={MessagesSquareIcon}
                titulo="Nenhuma conversa ainda"
                texto="As mensagens dos alunos aparecem aqui. Para começar uma conversa, abra Alunos e use Enviar mensagem."
              />
            )
          }

          return (
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <ul className={cn('flex flex-col border-2', atual && 'hidden lg:flex')} aria-label="Conversas">
                {visiveis.map((c) => (
                  <li key={c.inscricao_id} className="border-t border-divisor first:border-t-0">
                    <button
                      type="button"
                      aria-current={c.inscricao_id === aberta}
                      onClick={() => setParametros({ aluno: c.inscricao_id })}
                      className={cn(
                        'flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-accent',
                        c.inscricao_id === aberta && 'bg-muted',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-semibold">{c.aluno}</span>
                        {c.naoLidas > 0 && c.inscricao_id !== aberta && <Badge>{c.naoLidas}</Badge>}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">{c.ultima}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {c.turma_codigo} · {formatarDataHora(c.ultima_em, FUSO)}
                      </span>
                    </button>
                  </li>
                ))}
                {visiveis.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">Nenhum aluno com este nome.</li>}
              </ul>

              <div className={cn('flex min-w-0 flex-col gap-4', !atual && 'hidden lg:flex')}>
                {atual ? (
                  <>
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="ghost" className="lg:hidden" onClick={() => setParametros({})}>
                        <ArrowLeftIcon aria-hidden="true" />
                        Conversas
                      </Button>
                      <h2 className="text-[19px]">{atual.aluno}</h2>
                      <span className="font-mono text-xs text-muted-foreground">{atual.turma_codigo}</span>
                    </div>
                    <ConversaAberta key={atual.inscricao_id} conversa={atual} aoMudar={consulta.recarregar} />
                  </>
                ) : (
                  <Vazio icone={MessagesSquareIcon} titulo="Escolha uma conversa" texto="Selecione um aluno na lista para ler e responder." />
                )}
              </div>
            </div>
          )
        }}
      </Carregado>
    </>
  )
}

// ---------------------------------------------------------------------------
// Feedbacks
// ---------------------------------------------------------------------------

type FiltroDeFeedback = 'nao_lidos' | 'lidos' | 'todos'

/** Feedbacks enviados pelos alunos. */
export function Feedbacks() {
  const consulta = useConsulta(listarFeedbacks, [])
  const [filtro, setFiltro] = useState<FiltroDeFeedback>('nao_lidos')

  async function alternar(id: string, lido: boolean) {
    try {
      await marcarFeedback(id, lido)
      consulta.recarregar()
    } catch (falha) {
      toast.error((falha as Error).message)
    }
  }

  return (
    <>
      <CabecalhoDaPagina rotulo="Comunicação" titulo="Feedbacks" descricao="Dificuldades, sugestões e avaliações que os alunos mandaram." />

      <Carregado consulta={consulta}>
        {(feedbacks) => {
          const visiveis = feedbacks.filter((f) => filtro === 'todos' || f.lido === (filtro === 'lidos'))
          return (
            <>
              <FiltroDeLista
                rotulo="Filtrar por leitura"
                valor={filtro}
                aoMudar={setFiltro}
                opcoes={[
                  ['nao_lidos', 'Não lidos'],
                  ['lidos', 'Lidos'],
                  ['todos', 'Todos'],
                ]}
              />

              {visiveis.length === 0 ? (
                <Vazio
                  icone={MessageSquareIcon}
                  titulo={feedbacks.length === 0 ? 'Nenhum feedback recebido' : 'Nada neste filtro'}
                  texto={feedbacks.length === 0 ? 'Quando um aluno enviar um feedback, ele aparece aqui.' : undefined}
                />
              ) : (
                <ul className="flex flex-col gap-4">
                  {visiveis.map((f) => (
                    <li key={f.id}>
                      <Card>
                        <CardContent className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{ROTULO_TIPO_FEEDBACK[f.tipo]}</Badge>
                            {!f.lido && <Badge>Novo</Badge>}
                            <span className="text-sm font-semibold">{f.aluno}</span>
                            <span className="font-mono text-xs text-muted-foreground">{f.turma_codigo}</span>
                            <span className="ml-auto font-mono text-xs text-muted-foreground">{formatarDataHora(f.created_at, FUSO)}</span>
                          </div>
                          <p className="text-[15px] whitespace-pre-wrap">{f.texto}</p>
                          <Button size="sm" variant="outline" className="self-start" onClick={() => void alternar(f.id, !f.lido)}>
                            {f.lido ? 'Marcar como não lido' : 'Marcar como lido'}
                          </Button>
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

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

type TurmaDoAviso = { id: string; codigo: string; instituicao: string }

async function carregarAvisos() {
  const [avisos, turmas] = await Promise.all([listarTodosOsAvisos(), listarTurmas()])
  return { avisos, turmas }
}

function NovoAviso({ turmas, aoFechar }: { turmas: TurmaDoAviso[]; aoFechar: (feito: boolean) => void }) {
  const id = useId()
  const [paraTodos, setParaTodos] = useState(true)
  const [instituicao, setInstituicao] = useState(TODAS)
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set())
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [porEmail, setPorEmail] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const daInstituicao = turmasDaInstituicao(turmas, instituicao)
  const todasMarcadas = daInstituicao.length > 0 && daInstituicao.every((t) => escolhidas.has(t.id))

  function marcar(turmaId: string, marcada: boolean) {
    setEscolhidas((atuais) => {
      const novas = new Set(atuais)
      if (marcada) novas.add(turmaId)
      else novas.delete(turmaId)
      return novas
    })
  }

  function marcarTodas(marcadas: boolean) {
    setEscolhidas((atuais) => {
      const novas = new Set(atuais)
      for (const t of daInstituicao) {
        if (marcadas) novas.add(t.id)
        else novas.delete(t.id)
      }
      return novas
    })
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    if (!paraTodos && escolhidas.size === 0) return setErro('Escolha ao menos uma turma.')
    if (titulo.trim().length < 3) return setErro('Dê um título ao aviso.')
    if (texto.trim().length < 3) return setErro('Escreva o aviso.')
    setEnviando(true)
    setErro(null)
    try {
      const lote = await publicarAviso({ turmaIds: paraTodos ? [] : [...escolhidas], titulo, texto })
      toast.success('Aviso publicado', { description: 'Os alunos recebem uma notificação na plataforma.' })
      if (porEmail) {
        // O aviso já está publicado: falha no e-mail é avisada, mas não desfaz.
        try {
          const envio = await enviarAvisoPorEmail(lote)
          if (!envio.configurado) {
            toast.warning('E-mail ainda não configurado', {
              description: `O aviso foi publicado só na plataforma. ${envio.destinatarios} ${envio.destinatarios === 1 ? 'aluno receberia' : 'alunos receberiam'} por e-mail.`,
            })
          } else if (envio.destinatarios === 0) {
            toast.info('Nenhum aluno para receber por e-mail', { description: 'Ninguém destas turmas autorizou comunicações e informou e-mail.' })
          } else {
            toast.success(`E-mail enviado para ${envio.enviados} de ${envio.destinatarios} ${envio.destinatarios === 1 ? 'aluno' : 'alunos'}`)
          }
        } catch (falha) {
          toast.error('O aviso foi publicado, mas o e-mail não saiu', { description: (falha as Error).message })
        }
      }
      aoFechar(true)
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar(false)}>
      <DialogContent className="max-h-[92vh] min-h-0 overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-[22px] font-bold">Novo aviso</DialogTitle>
          <DialogDescription>O aviso aparece no painel dos alunos e gera uma notificação.</DialogDescription>
        </DialogHeader>
        <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold">Para quem</legend>
            <RadioGroup value={paraTodos ? 'todos' : 'turmas'} onValueChange={(v) => setParaTodos(v === 'todos')} className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="todos" id={`${id}-todos`} />
                <Label htmlFor={`${id}-todos`}>Todos os alunos</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="turmas" id={`${id}-turmas`} />
                <Label htmlFor={`${id}-turmas`}>Escolher turmas</Label>
              </div>
            </RadioGroup>

            {!paraTodos && (
              <div className="flex flex-col gap-3 border-2 p-3">
                <Select value={instituicao} onValueChange={setInstituicao}>
                  <SelectTrigger aria-label="Filtrar turmas por instituição">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODAS}>Todas as instituições</SelectItem>
                    {instituicoesDe(turmas).map((nome) => (
                      <SelectItem key={nome} value={nome}>
                        {nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {daInstituicao.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma turma nesta instituição.</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2 border-b border-divisor pb-2">
                      <Checkbox id={`${id}-marcar-todas`} checked={todasMarcadas} onCheckedChange={(v) => marcarTodas(v === true)} />
                      <Label htmlFor={`${id}-marcar-todas`}>Marcar todas da lista</Label>
                    </div>
                    <ul className="grid max-h-[180px] gap-2 overflow-y-auto sm:grid-cols-2">
                      {daInstituicao.map((t) => (
                        <li key={t.id} className="flex items-center gap-2">
                          <Checkbox id={`${id}-t-${t.id}`} checked={escolhidas.has(t.id)} onCheckedChange={(v) => marcar(t.id, v === true)} />
                          <Label htmlFor={`${id}-t-${t.id}`} className="font-mono text-[13px] font-normal">
                            {t.codigo}
                          </Label>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  <span className="destaque text-foreground">{escolhidas.size}</span> {escolhidas.size === 1 ? 'turma escolhida' : 'turmas escolhidas'}
                </p>
              </div>
            )}
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-titulo`}>Título</Label>
            <Input id={`${id}-titulo`} maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-texto`}>Aviso</Label>
            <Textarea id={`${id}-texto`} rows={5} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} />
            <div className="flex flex-wrap items-center gap-2">
              <InserirLink aoInserir={(trecho) => setTexto((atual) => comLink(atual, trecho))} />
              <span className="text-xs text-muted-foreground">Endereços que começam com https:// também viram link.</span>
            </div>
          </div>

          <div className="flex items-start gap-3 border-2 p-3">
            <Checkbox id={`${id}-email`} checked={porEmail} onCheckedChange={(v) => setPorEmail(v === true)} className="mt-0.5" />
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${id}-email`}>Enviar também por e-mail</Label>
              <p className="text-xs text-muted-foreground">
                Só recebe quem autorizou comunicações do professor e informou um e-mail. Cada aluno recebe o seu, sem ver os demais.
              </p>
            </div>
          </div>

          {erro && (
            <p role="alert" className="text-[13px] font-semibold text-destructive">
              {erro}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => aoFechar(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando && <Loader2Icon className="animate-spin" aria-hidden="true" />}
              Publicar aviso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Avisos do professor para todos os alunos ou para as turmas escolhidas. */
export function Avisos() {
  const consulta = useConsulta(carregarAvisos, [])
  const [novo, setNovo] = useState(false)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)

  return (
    <>
      <CabecalhoDaPagina rotulo="Comunicação" titulo="Avisos" descricao="Comunicados para todos os alunos ou para as turmas que você escolher.">
        <Button onClick={() => setNovo(true)}>
          <PlusIcon aria-hidden="true" />
          Novo aviso
        </Button>
      </CabecalhoDaPagina>

      <Carregado consulta={consulta}>
        {({ avisos, turmas }) => {
          const codigoDaTurma = new Map(turmas.map((t) => [t.id, t.codigo]))
          return (
            <>
              {avisos.length === 0 ? (
                <Vazio icone={MegaphoneIcon} titulo="Nenhum aviso publicado" texto="Avise a turma sobre prazos, mudanças e novidades.">
                  <Button size="sm" onClick={() => setNovo(true)}>
                    Novo aviso
                  </Button>
                </Vazio>
              ) : (
                <ul className="flex flex-col gap-4">
                  {avisos.map((a) => (
                    <li key={a.lote_id}>
                      <Card>
                        <CardContent className="flex flex-wrap items-start gap-4">
                          <div className="flex min-w-[min(100%,280px)] flex-1 flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {a.para_todos ? (
                                <Badge variant="outline">Todos os alunos</Badge>
                              ) : (
                                a.turma_ids.map((turmaId) => (
                                  <Badge key={turmaId} variant="outline">
                                    Turma {codigoDaTurma.get(turmaId) ?? ''}
                                  </Badge>
                                ))
                              )}
                              <span className="font-mono text-xs text-muted-foreground">{formatarDataHora(a.created_at, FUSO)}</span>
                            </div>
                            <h2 className="text-[19px]">{a.titulo}</h2>
                            <TextoComLinks texto={a.texto} className="text-[15px]" />
                          </div>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Excluir aviso ${a.titulo}`}
                            onClick={() =>
                              setConfirmacao({
                                titulo: `Excluir "${a.titulo}"?`,
                                texto: 'O aviso some do painel dos alunos de todas as turmas para as quais foi enviado. Esta ação não pode ser desfeita.',
                                acao: 'Excluir',
                                destrutiva: true,
                                executar: () => excluirAviso(a.lote_id),
                                sucesso: 'Aviso excluído',
                              })
                            }
                          >
                            <Trash2Icon />
                          </Button>
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}

              {novo && (
                <NovoAviso
                  turmas={turmas}
                  aoFechar={(feito) => {
                    setNovo(false)
                    if (feito) consulta.recarregar()
                  }}
                />
              )}
            </>
          )
        }}
      </Carregado>

      <Confirmar
        pedido={confirmacao}
        aoFechar={(feito) => {
          setConfirmacao(null)
          if (feito) consulta.recarregar()
        }}
      />
    </>
  )
}
