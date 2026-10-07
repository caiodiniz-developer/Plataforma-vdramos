import { Loader2Icon, SendIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatarDataHora } from '@/dominio/tempo'
import { cn } from '@/lib/utils'

export type MensagemDaConversa = { id: string; autor: 'aluno' | 'professor'; texto: string; created_at: string }

type Props = {
  mensagens: MensagemDaConversa[]
  /** De que lado está quem usa a tela. */
  eu: 'aluno' | 'professor'
  /** Nome exibido nas mensagens do outro lado. */
  nomeDoOutro: string
  aoEnviar: (texto: string) => Promise<void>
  vazio: string
}

/**
 * Conversa privada entre um aluno e o professor, usada dos dois lados. O
 * texto é mostrado como texto puro; o campo só é limpo depois que o servidor
 * confirma o envio.
 */
export function Conversa({ mensagens, eu, nomeDoOutro, aoEnviar, vazio }: Props) {
  const id = useId()
  const fim = useRef<HTMLDivElement>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'nearest' })
  }, [mensagens.length])

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando || texto.trim() === '') return
    setEnviando(true)
    setErro(null)
    try {
      await aoEnviar(texto)
      setTexto('')
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {mensagens.length === 0 ? (
        <p className="border-2 border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ol className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto border-2 p-4" aria-label="Mensagens">
          {mensagens.map((m) => {
            const minha = m.autor === eu
            return (
              <li key={m.id} className={cn('flex max-w-[85%] flex-col gap-1', minha ? 'self-end items-end' : 'self-start items-start')}>
                <span className="eyebrow text-[10px] text-muted-foreground">{minha ? 'Você' : nomeDoOutro}</span>
                <p
                  className={cn(
                    'border-2 px-3 py-2 text-[15px] break-words whitespace-pre-wrap',
                    minha ? 'border-secondary bg-secondary text-secondary-foreground' : 'bg-muted',
                  )}
                >
                  {m.texto}
                </p>
                <span className="font-mono text-[11px] text-muted-foreground">{formatarDataHora(m.created_at, 'America/Sao_Paulo')}</span>
              </li>
            )
          })}
          <div ref={fim} />
        </ol>
      )}

      <form onSubmit={enviar} noValidate className="flex flex-col gap-2">
        <Label htmlFor={`${id}-texto`} className="sr-only">
          Escreva sua mensagem
        </Label>
        <Textarea
          id={`${id}-texto`}
          rows={3}
          maxLength={2000}
          placeholder="Escreva sua mensagem"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        {erro && (
          <p role="alert" className="text-[13px] font-semibold text-destructive">
            {erro}
          </p>
        )}
        <Button type="submit" disabled={enviando || texto.trim() === ''} className="self-end">
          {enviando ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <SendIcon aria-hidden="true" />}
          Enviar
        </Button>
      </form>
    </div>
  )
}
