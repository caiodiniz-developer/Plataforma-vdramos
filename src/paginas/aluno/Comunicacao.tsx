import { Loader2Icon, MegaphoneIcon, MessageSquareHeartIcon, MessageSquareIcon } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CabecalhoDaPagina, Carregado, Vazio } from '@/componentes/plataforma/Blocos'
import { Conversa } from '@/componentes/plataforma/Conversa'
import { useTurmaAtual } from '@/componentes/plataforma/LayoutAluno'
import { TextoComLinks } from '@/componentes/plataforma/Links'
import {
  assinarMudancas,
  enviarFeedback,
  enviarMensagemAoProfessor,
  listarAvisos,
  marcarMensagensLidas,
  meusFeedbacks,
  minhasMensagens,
  ROTULO_TIPO_FEEDBACK,
  type TipoFeedback,
} from '@/dados/apoio'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'

const FUSO = 'America/Sao_Paulo'

/** Conversa privada do aluno com o professor. */
export function Mensagens() {
  const turma = useTurmaAtual()
  const consulta = useConsulta(() => minhasMensagens(turma.inscricao_id), [turma.inscricao_id])
  const total = consulta.dados?.length ?? 0
  const { recarregar } = consulta

  // A resposta do professor aparece na conversa aberta, sem recarregar a página.
  useEffect(
    () => assinarMudancas('mensagem_privada', recarregar, `inscricao_id=eq.${turma.inscricao_id}`),
    [turma.inscricao_id, recarregar],
  )

  // Abrir a conversa marca como lidas as respostas do professor.
  useEffect(() => {
    if (total > 0) marcarMensagensLidas().catch(() => {})
  }, [total])

  return (
    <>
      <CabecalhoDaPagina
        rotulo="Professor"
        titulo="Mensagens"
        icone={MessageSquareIcon}
        cor="roxo"
        descricao="Conversa privada com o professor. Nenhum colega vê o que você escreve aqui."
      />
      <Carregado consulta={consulta}>
        {(mensagens) => (
          <Conversa
            eu="aluno"
            nomeDoOutro="Professor"
            mensagens={mensagens}
            vazio="Nenhuma mensagem ainda. Escreva para o professor quando precisar."
            aoEnviar={async (texto) => {
              await enviarMensagemAoProfessor(turma.inscricao_id, texto)
              consulta.recarregar()
            }}
          />
        )}
      </Carregado>
    </>
  )
}

/** Feedback do aluno para o professor. */
export function Feedback() {
  const id = useId()
  const turma = useTurmaAtual()
  const consulta = useConsulta(() => meusFeedbacks(turma.id), [turma.id])
  const [tipo, setTipo] = useState<TipoFeedback>('sugestao')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    if (texto.trim().length < 3) return setErro('Escreva o seu feedback.')
    setEnviando(true)
    setErro(null)
    try {
      await enviarFeedback(turma, tipo, texto)
      setTexto('')
      toast.success('Feedback enviado', { description: 'Obrigado por ajudar a melhorar as aulas.' })
      consulta.recarregar()
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <CabecalhoDaPagina
        rotulo="Professor"
        titulo="Feedback"
        icone={MessageSquareHeartIcon}
        cor="verde"
        descricao="Conte o que está difícil, o que pode melhorar ou como foi uma aula. Só o professor lê."
      />
      <Card>
        <CardContent>
          <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:max-w-[360px]">
              <Label htmlFor={`${id}-tipo`}>Sobre o quê</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoFeedback)}>
                <SelectTrigger id={`${id}-tipo`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROTULO_TIPO_FEEDBACK) as TipoFeedback[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {ROTULO_TIPO_FEEDBACK[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-texto`}>Seu feedback</Label>
              <Textarea id={`${id}-texto`} rows={4} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} />
            </div>
            {erro && (
              <p role="alert" className="text-[13px] font-semibold text-destructive">
                {erro}
              </p>
            )}
            <Button type="submit" disabled={enviando} className="self-start">
              {enviando && <Loader2Icon className="animate-spin" aria-hidden="true" />}
              Enviar feedback
            </Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="titulo-enviados" className="flex flex-col gap-4">
        <h2 id="titulo-enviados" className="text-[19px]">
          Enviados
        </h2>
        <Carregado consulta={consulta} linhas={2}>
          {(feedbacks) =>
            feedbacks.length === 0 ? (
              <Vazio icone={MessageSquareHeartIcon} titulo="Nenhum feedback enviado" />
            ) : (
              <ul className="flex flex-col gap-3">
                {feedbacks.map((f) => (
                  <li key={f.id} className="flex flex-col gap-2 border-2 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{ROTULO_TIPO_FEEDBACK[f.tipo]}</Badge>
                      <span className="ml-auto font-mono text-xs text-muted-foreground">{formatarDataHora(f.created_at, FUSO)}</span>
                    </div>
                    <p className="text-[15px] whitespace-pre-wrap">{f.texto}</p>
                  </li>
                ))}
              </ul>
            )
          }
        </Carregado>
      </section>
    </>
  )
}

/** Comunicados do professor para a turma. */
export function Avisos() {
  const turma = useTurmaAtual()
  const consulta = useConsulta(() => listarAvisos(turma.id), [turma.id])

  return (
    <>
      <CabecalhoDaPagina rotulo="Turma" titulo="Avisos" descricao="Comunicados do professor para a sua turma." icone={MegaphoneIcon} cor="verde" />
      <Carregado consulta={consulta}>
        {(avisos) =>
          avisos.length === 0 ? (
            <Vazio icone={MegaphoneIcon} titulo="Nenhum aviso" texto="Quando o professor publicar um aviso, você recebe uma notificação." />
          ) : (
            <ul className="flex flex-col gap-4">
              {avisos.map((a) => (
                <li key={a.id}>
                  <Card className="border-l-8 border-l-green">
                    <CardContent className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={a.turma_id ? 'outline' : 'default'}>{a.turma_id ? `Turma ${turma.codigo}` : 'Todos os alunos'}</Badge>
                        <span className="ml-auto font-mono text-xs text-muted-foreground">{formatarDataHora(a.created_at, FUSO)}</span>
                      </div>
                      <h2 className="text-[19px]">{a.titulo}</h2>
                      <TextoComLinks texto={a.texto} className="text-[15px]" />
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )
        }
      </Carregado>
    </>
  )
}
