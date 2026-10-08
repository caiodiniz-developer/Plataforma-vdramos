import { CircleHelpIcon, Loader2Icon, PaperclipIcon, PlusIcon } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CabecalhoDaPagina, Carregado, Vazio } from '@/componentes/plataforma/Blocos'
import { useTurmaAtual } from '@/componentes/plataforma/LayoutAluno'
import {
  ANEXO_MAXIMO_MB,
  assinarMudancas,
  enviarDuvida,
  listarConteudos,
  minhasDuvidas,
  urlAssinada,
  type Duvida,
  type NovaDuvida,
} from '@/dados/apoio'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'

const FUSO = 'America/Sao_Paulo'
const SEM_CONTEUDO = 'nenhum'

const ROTULO_STATUS: Record<Duvida['status'], string> = { aberta: 'Aberta', respondida: 'Respondida', arquivada: 'Arquivada' }

async function carregar(turmaId: string) {
  const [duvidas, conteudos] = await Promise.all([minhasDuvidas(turmaId), listarConteudos(turmaId)])
  return { duvidas, conteudos }
}

async function abrirAnexo(caminho: string) {
  try {
    window.open(await urlAssinada(caminho), '_blank', 'noopener,noreferrer')
  } catch (falha) {
    toast.error((falha as Error).message)
  }
}

/** Dúvidas do aluno para o professor. Só ele e o professor veem cada uma. */
export default function Duvidas() {
  const id = useId()
  const turma = useTurmaAtual()
  const [parametros, setParametros] = useSearchParams()
  const conteudoInicial = parametros.get('conteudo')
  const consulta = useConsulta(() => carregar(turma.id), [turma.id])
  const { recarregar } = consulta

  // A resposta do professor aparece assim que ele envia.
  useEffect(
    () => assinarMudancas('duvida', recarregar, `inscricao_id=eq.${turma.inscricao_id}`),
    [turma.inscricao_id, recarregar],
  )

  const vazia: NovaDuvida = { titulo: '', pergunta: '', categoria: '', conteudoId: conteudoInicial, anexo: null }
  const [aberto, setAberto] = useState(conteudoInicial !== null)
  const [nova, setNova] = useState<NovaDuvida>(vazia)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function fechar() {
    setAberto(false)
    setErro(null)
    if (conteudoInicial) setParametros({}, { replace: true })
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    if (nova.titulo.trim().length < 3) return setErro('Dê um título à dúvida (ao menos 3 letras).')
    if (nova.pergunta.trim().length < 3) return setErro('Escreva a sua pergunta.')
    setEnviando(true)
    setErro(null)
    try {
      await enviarDuvida(turma, nova)
      toast.success('Dúvida enviada', { description: 'Você recebe uma notificação quando o professor responder.' })
      setNova({ ...vazia, conteudoId: null })
      fechar()
      consulta.recarregar()
    } catch (falha) {
      // O texto continua no formulário para o aluno tentar de novo.
      setErro((falha as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <CabecalhoDaPagina
        rotulo="Professor"
        titulo="Minhas dúvidas"
        descricao="Pergunte direto ao professor. Só você e ele veem a sua dúvida."
      >
        <Button onClick={() => setAberto(true)}>
          <PlusIcon aria-hidden="true" />
          Nova dúvida
        </Button>
      </CabecalhoDaPagina>

      <Carregado consulta={consulta}>
        {({ duvidas, conteudos }) => (
          <>
            {duvidas.length === 0 ? (
              <Vazio icone={CircleHelpIcon} titulo="Nenhuma dúvida enviada" texto="Quando você enviar uma dúvida, ela e a resposta ficam guardadas aqui.">
                <Button size="sm" onClick={() => setAberto(true)}>
                  Enviar a primeira dúvida
                </Button>
              </Vazio>
            ) : (
              <ul className="flex flex-col gap-4">
                {duvidas.map((d) => (
                  <li key={d.id}>
                    <Card>
                      <CardContent className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={d.status === 'respondida' ? 'green' : d.status === 'arquivada' ? 'neutro' : 'outline'}>
                            {ROTULO_STATUS[d.status]}
                          </Badge>
                          {d.categoria && <Badge variant="outline">{d.categoria}</Badge>}
                          <span className="ml-auto font-mono text-xs text-muted-foreground">{formatarDataHora(d.created_at, FUSO)}</span>
                        </div>
                        <h2 className="text-[19px]">{d.titulo}</h2>
                        <p className="text-[15px] whitespace-pre-wrap">{d.pergunta}</p>
                        {d.anexo_path && (
                          <Button variant="link" size="sm" className="self-start px-0" onClick={() => void abrirAnexo(d.anexo_path!)}>
                            <PaperclipIcon aria-hidden="true" />
                            Ver anexo
                          </Button>
                        )}
                        {d.resposta ? (
                          <div className="flex flex-col gap-1 border-l-2 border-primary bg-muted py-3 pr-3 pl-4">
                            <p className="eyebrow text-muted-foreground">
                              Resposta do professor
                              {d.respondida_em && ` · ${formatarDataHora(d.respondida_em, FUSO)}`}
                            </p>
                            <p className="text-[15px] whitespace-pre-wrap">{d.resposta}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Aguardando a resposta do professor.</p>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}

            <Dialog open={aberto} onOpenChange={(a) => (a ? setAberto(true) : fechar())}>
              <DialogContent className="plataforma max-h-[92vh] min-h-0 overflow-y-auto sm:max-w-[560px]">
                <DialogHeader>
                  <DialogTitle className="font-mono text-[22px] font-bold">Nova dúvida</DialogTitle>
                  <DialogDescription>Explique o que você não entendeu. Quanto mais contexto, melhor a resposta.</DialogDescription>
                </DialogHeader>
                <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${id}-titulo`}>Título</Label>
                    <Input id={`${id}-titulo`} maxLength={120} value={nova.titulo} onChange={(e) => setNova({ ...nova, titulo: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${id}-pergunta`}>Pergunta</Label>
                    <Textarea
                      id={`${id}-pergunta`}
                      rows={5}
                      maxLength={2000}
                      value={nova.pergunta}
                      onChange={(e) => setNova({ ...nova, pergunta: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`${id}-conteudo`}>Conteúdo (opcional)</Label>
                      <Select
                        value={nova.conteudoId ?? SEM_CONTEUDO}
                        onValueChange={(v) => setNova({ ...nova, conteudoId: v === SEM_CONTEUDO ? null : v })}
                      >
                        <SelectTrigger id={`${id}-conteudo`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SEM_CONTEUDO}>Nenhum em especial</SelectItem>
                          {conteudos.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.titulo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`${id}-categoria`}>Categoria (opcional)</Label>
                      <Input
                        id={`${id}-categoria`}
                        maxLength={40}
                        placeholder="Ex.: JavaScript"
                        value={nova.categoria}
                        onChange={(e) => setNova({ ...nova, categoria: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${id}-anexo`}>Anexo (opcional, até {ANEXO_MAXIMO_MB} MB)</Label>
                    <Input
                      id={`${id}-anexo`}
                      type="file"
                      accept="image/*,.pdf,.txt,.zip"
                      onChange={(e) => setNova({ ...nova, anexo: e.target.files?.[0] ?? null })}
                    />
                  </div>
                  {erro && (
                    <p role="alert" className="text-[13px] font-semibold text-destructive">
                      {erro}
                    </p>
                  )}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={fechar}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={enviando}>
                      {enviando && <Loader2Icon className="animate-spin" aria-hidden="true" />}
                      Enviar dúvida
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        )}
      </Carregado>
    </>
  )
}
