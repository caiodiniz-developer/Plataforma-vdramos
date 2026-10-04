import { Loader2Icon, MegaphoneIcon, PinIcon, SendIcon } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { enviarMensagem, type MensagemDaSala, type SessaoAoVivo } from '@/dados/sala'
import { esperaParaEnviar, MENSAGEM_MAX, mensagemValida, ordenarFeed, trechosDaMensagem } from '@/dominio/mensagem'
import { formatarDataHora } from '@/dominio/tempo'
import { cn } from '@/lib/utils'

/** Texto puro; só http(s) vira link, sempre com noopener noreferrer (seção 7). */
function TextoDaMensagem({ texto }: { texto: string }) {
  return (
    <p className="break-words whitespace-pre-wrap">
      {trechosDaMensagem(texto).map((trecho, indice) =>
        trecho.tipo === 'link' ? (
          <a key={indice} href={trecho.valor} target="_blank" rel="noopener noreferrer" className="font-bold underline">
            {trecho.valor}
          </a>
        ) : (
          <span key={indice}>{trecho.valor}</span>
        ),
      )}
    </p>
  )
}

type Props = {
  sessao: SessaoAoVivo
  mensagens: MensagemDaSala[]
  aberta: boolean
  fuso: string
  aoMudar: () => void
}

/** PRD F12: feed com fixadas no topo, aviso do professor em destaque e envio limitado. */
export function FeedDeMensagens({ sessao, mensagens, aberta, fuso, aoMudar }: Props) {
  const id = useId()
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ultimoEnvio, setUltimoEnvio] = useState<number | null>(null)
  const [espera, setEspera] = useState(0)

  useEffect(() => {
    if (ultimoEnvio === null) return
    const atualizar = () => setEspera(Math.ceil(esperaParaEnviar(ultimoEnvio, Date.now()) / 1000))
    atualizar()
    const relogio = setInterval(atualizar, 500)
    return () => clearInterval(relogio)
  }, [ultimoEnvio])

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando || espera > 0) return
    if (!mensagemValida(texto)) {
      setErro(`Escreva de 1 a ${MENSAGEM_MAX} caracteres.`)
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      await enviarMensagem(sessao.id, texto.trim())
      setTexto('')
      setUltimoEnvio(Date.now())
      aoMudar()
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const feed = ordenarFeed(mensagens)
  const podeEnviar = aberta && sessao.chat_ativo

  return (
    <div className="flex flex-col gap-4">
      {feed.length === 0 ? (
        <p className="text-muted-foreground">
          {podeEnviar ? 'Nenhuma mensagem ainda. Escreva a primeira.' : 'Nenhuma mensagem nesta sessão.'}
        </p>
      ) : (
        <ol className="flex flex-col gap-3" aria-label="Mensagens da turma">
          {feed.map((m) => (
            <li
              key={m.id}
              className={cn(
                'flex flex-col gap-1 border-2 bg-card px-[18px] py-3',
                m.tipo === 'aviso' && 'border-primary',
                m.fixada && 'bg-accent',
              )}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {m.tipo === 'aviso' && <MegaphoneIcon className="size-3.5" aria-hidden="true" />}
                {m.fixada && <PinIcon className="size-3.5" aria-hidden="true" />}
                <span className="font-bold">{m.autor_nome}</span>
                {m.tipo === 'aviso' && <span className="eyebrow">Aviso</span>}
                {m.fixada && <span className="eyebrow">Fixada</span>}
                <span className="ml-auto font-mono text-muted-foreground">
                  {formatarDataHora(m.created_at, fuso).slice(-5)}
                </span>
              </div>
              <TextoDaMensagem texto={m.texto} />
            </li>
          ))}
        </ol>
      )}

      {podeEnviar ? (
        <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-2">
          <Label htmlFor={`${id}-mensagem`} className="sr-only">
            Mensagem para a turma
          </Label>
          <div className="flex gap-2">
            <Input
              id={`${id}-mensagem`}
              placeholder="Mensagem para a turma"
              maxLength={MENSAGEM_MAX}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value)
                setErro(null)
              }}
            />
            <Button type="submit" disabled={enviando || espera > 0} aria-label="Enviar mensagem">
              {enviando ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <SendIcon aria-hidden="true" />}
              {espera > 0 ? `${espera} s` : 'Enviar'}
            </Button>
          </div>
          {erro && (
            <p role="alert" className="text-[13px] font-bold text-destructive">
              {erro}
            </p>
          )}
        </form>
      ) : (
        aberta && <p className="text-[13px] text-muted-foreground">O professor desativou as mensagens nesta sessão.</p>
      )}
    </div>
  )
}
