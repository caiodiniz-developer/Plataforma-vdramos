import { Link2Icon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { marcacaoDeLink, partesDoTexto } from '@/dominio/links'
import { cn } from '@/lib/utils'

/**
 * Texto de mensagem, dúvida ou aviso com os links clicáveis. O conteúdo é
 * mostrado como texto puro: só o que `partesDoTexto` reconhece como endereço
 * http(s) vira âncora, sempre em nova aba.
 */
export function TextoComLinks({ texto, className, claro = false }: { texto: string; className?: string; claro?: boolean }) {
  return (
    <p className={cn('break-words whitespace-pre-wrap', className)}>
      {partesDoTexto(texto).map((parte, indice) =>
        parte.tipo === 'texto' ? (
          parte.texto
        ) : (
          <a
            key={indice}
            href={parte.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('font-semibold underline underline-offset-[3px]', claro ? 'text-inherit' : 'text-foreground hover:text-muted-foreground')}
          >
            {parte.texto}
          </a>
        ),
      )}
    </p>
  )
}

/**
 * Botão "Inserir link": pede o texto e o endereço e entrega o trecho pronto
 * para quem controla o campo acrescentar. Dá para inserir quantos quiser.
 */
export function InserirLink({ aoInserir, className }: { aoInserir: (trecho: string) => void; className?: string }) {
  const id = useId()
  const [aberto, setAberto] = useState(false)
  const [rotulo, setRotulo] = useState('')
  const [endereco, setEndereco] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function fechar() {
    setAberto(false)
    setRotulo('')
    setEndereco('')
    setErro(null)
  }

  function confirmar(evento: FormEvent) {
    evento.preventDefault()
    // O diálogo fica dentro de outro formulário: o envio não pode subir.
    evento.stopPropagation()
    const trecho = marcacaoDeLink(rotulo, endereco)
    if (!trecho) return setErro('Informe um endereço válido, como https://exemplo.com.')
    aoInserir(trecho)
    fechar()
  }

  return (
    <>
      <Button type="button" size="sm" variant="ghost" className={className} onClick={() => setAberto(true)}>
        <Link2Icon aria-hidden="true" />
        Inserir link
      </Button>
      <Dialog open={aberto} onOpenChange={(a) => (a ? setAberto(true) : fechar())}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="font-mono text-[20px] font-bold">Inserir link</DialogTitle>
            <DialogDescription>O link entra no fim do texto. Repita para incluir outros.</DialogDescription>
          </DialogHeader>
          <form onSubmit={confirmar} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-endereco`}>Endereço</Label>
              <Input id={`${id}-endereco`} inputMode="url" placeholder="https://" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-rotulo`}>Texto do link (opcional)</Label>
              <Input id={`${id}-rotulo`} maxLength={120} placeholder="Ex.: Apostila da aula" value={rotulo} onChange={(e) => setRotulo(e.target.value)} />
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
              <Button type="submit">Inserir</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Acrescenta o trecho do link ao texto, separando com espaço quando precisa. */
// eslint-disable-next-line react-refresh/only-export-components
export function comLink(texto: string, trecho: string): string {
  return texto === '' || /\s$/.test(texto) ? texto + trecho : `${texto} ${trecho}`
}
