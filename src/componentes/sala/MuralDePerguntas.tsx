import { CheckIcon, Loader2Icon, ThumbsUpIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { alternarVoto, enviarPergunta, type PerguntaDaSala, type SessaoAoVivo } from '@/dados/sala'
import { autorExibido, ordenarMural, PERGUNTA_MAX, perguntaValida, type DestinoPergunta } from '@/dominio/pergunta'

type Props = {
  sessao: SessaoAoVivo
  perguntas: PerguntaDaSala[]
  aberta: boolean
  aoMudar: () => void
}

/** PRD F10: formulário de pergunta. O texto só é limpo depois da confirmação. */
function FormularioDePergunta({ sessao, aoMudar }: { sessao: SessaoAoVivo; aoMudar: () => void }) {
  const id = useId()
  const [texto, setTexto] = useState('')
  const [destino, setDestino] = useState<DestinoPergunta>('turma')
  const [anonima, setAnonima] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    if (!perguntaValida(texto)) {
      setErro(`Escreva de 3 a ${PERGUNTA_MAX} caracteres.`)
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      await enviarPergunta(sessao.id, texto.trim(), destino, sessao.permite_anonimo && anonima)
      setTexto('')
      setAnonima(false)
      toast.success(destino === 'professor' ? 'Enviada ao professor' : 'Pergunta enviada')
      aoMudar()
    } catch (falha) {
      // Seção 7: se a sessão encerrou, o texto continua no campo.
      setErro((falha as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-texto`}>Sua pergunta</Label>
        <Textarea
          id={`${id}-texto`}
          rows={3}
          maxLength={PERGUNTA_MAX}
          value={texto}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
          onChange={(e) => {
            setTexto(e.target.value)
            setErro(null)
          }}
        />
        <div className="flex justify-between gap-3">
          {erro && (
            <p id={`${id}-erro`} role="alert" className="text-[13px] font-bold text-destructive">
              {erro}
            </p>
          )}
          <p className="ml-auto text-xs text-muted-foreground">
            {texto.length}/{PERGUNTA_MAX}
          </p>
        </div>
      </div>

      <RadioGroup
        value={destino}
        onValueChange={(valor) => setDestino(valor as DestinoPergunta)}
        className="flex flex-wrap gap-5"
        aria-label="Destino da pergunta"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem id={`${id}-turma`} value="turma" />
          <Label htmlFor={`${id}-turma`} className="font-medium">
            Para a turma
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem id={`${id}-professor`} value="professor" />
          <Label htmlFor={`${id}-professor`} className="font-medium">
            Só para o professor
          </Label>
        </div>
      </RadioGroup>

      {sessao.permite_anonimo && (
        <div className="flex items-center gap-3">
          <Checkbox id={`${id}-anonima`} checked={anonima} onCheckedChange={(m) => setAnonima(m === true)} />
          <Label htmlFor={`${id}-anonima`} className="font-medium">
            Enviar anônima
          </Label>
        </div>
      )}

      <Button type="submit" disabled={enviando} className="self-start">
        {enviando && <Loader2Icon className="animate-spin" aria-hidden="true" />}
        Enviar pergunta
      </Button>
    </form>
  )
}

function CartaoDePergunta({
  pergunta,
  aberta,
  aoMudar,
}: {
  pergunta: PerguntaDaSala
  aberta: boolean
  aoMudar: () => void
}) {
  const [votando, setVotando] = useState(false)

  async function votar() {
    if (votando) return
    setVotando(true)
    try {
      await alternarVoto(pergunta.id)
      aoMudar()
    } catch (falha) {
      toast.error((falha as Error).message)
    } finally {
      setVotando(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow text-muted-foreground">{autorExibido(pergunta.anonima, pergunta.autor_nome)}</span>
            {pergunta.destino === 'professor' && <Badge variant="violet">Enviada ao professor</Badge>}
            {pergunta.status === 'respondida' && (
              <Badge variant="green">
                <CheckIcon aria-hidden="true" />
                Respondida
              </Badge>
            )}
          </div>
          <p className="break-words whitespace-pre-wrap">{pergunta.texto}</p>
          {pergunta.resposta && (
            <p className="border-l-2 border-primary pl-3 text-[13px] whitespace-pre-wrap">
              <span className="font-bold">Professor: </span>
              {pergunta.resposta}
            </p>
          )}
        </div>
        {pergunta.destino === 'turma' && (
          <Button
            variant={pergunta.votei ? 'secondary' : 'outline'}
            size="sm"
            className="h-auto min-w-14 flex-col self-start px-2 py-1.5"
            disabled={!aberta || votando}
            aria-pressed={pergunta.votei}
            aria-label={`${pergunta.votei ? 'Retirar voto' : 'Votar'} (${pergunta.votos} votos)`}
            onClick={() => void votar()}
          >
            <ThumbsUpIcon aria-hidden="true" />
            <span className="font-mono">+{pergunta.votos}</span>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

/** PRD F10 e F11: formulário e mural ordenado por votos. */
export function MuralDePerguntas({ sessao, perguntas, aberta, aoMudar }: Props) {
  const mural = ordenarMural(perguntas.filter((p) => p.status !== 'oculta'))

  return (
    <div className="flex flex-col gap-5">
      {aberta && (
        <Card>
          <CardContent>
            <FormularioDePergunta sessao={sessao} aoMudar={aoMudar} />
          </CardContent>
        </Card>
      )}
      {mural.length === 0 ? (
        <p className="text-muted-foreground">
          {aberta ? 'Nenhuma pergunta ainda. Envie a primeira.' : 'Nenhuma pergunta nesta sessão.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Mural de perguntas">
          {mural.map((pergunta) => (
            <li key={pergunta.id}>
              <CartaoDePergunta pergunta={pergunta} aberta={aberta} aoMudar={aoMudar} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
