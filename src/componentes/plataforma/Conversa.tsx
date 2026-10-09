import { Loader2Icon, SendIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatarDataHora } from '@/dominio/tempo'
import { comLink, InserirLink, TextoComLinks } from './Links'
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
        <ol className="flex max-h-[55vh] min-h-[220px] flex-col gap-4 overflow-y-auto border-2 p-4" aria-label="Mensagens">
          {mensagens.map((m) => {
            const minha = m.autor === eu
            return (
              <li key={m.id} className={cn('flex max-w-[88%] items-start gap-2', minha ? 'flex-row-reverse self-end' : 'self-start')}>
                <span
                  aria-hidden="true"
                  className={cn(
                    'destaque mt-5 flex size-9 shrink-0 items-center justify-center text-xs',
                    minha ? 'bg-primary text-primary-foreground' : 'bg-tinta text-papel',
                  )}
                >
                  {(minha ? 'Você' : nomeDoOutro)[0]}
                </span>
                <div className={cn('flex min-w-0 flex-col gap-1', minha ? 'items-end' : 'items-start')}>
                  <span className="eyebrow text-[10px] text-muted-foreground">{minha ? 'Você' : nomeDoOutro}</span>
                  <TextoComLinks
                    texto={m.texto}
                    claro={minha}
                    className={cn('border-2 px-3 py-2 text-[15px]', minha ? 'border-primary bg-primary text-primary-foreground' : 'border-divisor bg-muted')}
                  />
                  <span className="font-mono text-[11px] text-muted-foreground">{formatarDataHora(m.created_at, 'America/Sao_Paulo')}</span>
                </div>
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <InserirLink aoInserir={(trecho) => setTexto((atual) => comLink(atual, trecho))} />
          <Button type="submit" disabled={enviando || texto.trim() === ''}>
            {enviando ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <SendIcon aria-hidden="true" />}
            Enviar
          </Button>
        </div>
      </form>
    </div>
  )
}
