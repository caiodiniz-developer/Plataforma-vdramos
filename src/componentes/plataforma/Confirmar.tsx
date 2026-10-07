import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export type Confirmacao = {
  titulo: string
  texto: string
  acao: string
  /** Ações que não têm volta usam o botão destrutivo. */
  destrutiva?: boolean
  executar: () => Promise<void>
  sucesso: string
}

/**
 * Diálogo de confirmação para ações que mudam o acesso ou apagam dados.
 * Fica aberto enquanto a ação roda e só fecha quando o servidor confirma.
 */
export function Confirmar({ pedido, aoFechar }: { pedido: Confirmacao | null; aoFechar: (feito: boolean) => void }) {
  const [executando, setExecutando] = useState(false)

  async function confirmar() {
    if (!pedido || executando) return
    setExecutando(true)
    try {
      await pedido.executar()
      toast.success(pedido.sucesso)
      aoFechar(true)
    } catch (falha) {
      toast.error((falha as Error).message)
    } finally {
      setExecutando(false)
    }
  }

  return (
    <AlertDialog open={pedido !== null} onOpenChange={(aberto) => !aberto && !executando && aoFechar(false)}>
      <AlertDialogContent className="plataforma">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-mono text-[20px] font-bold">{pedido?.titulo}</AlertDialogTitle>
          <AlertDialogDescription>{pedido?.texto}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={executando}>Cancelar</AlertDialogCancel>
          <Button variant={pedido?.destrutiva ? 'destructive' : 'default'} disabled={executando} onClick={() => void confirmar()}>
            {executando && <Loader2Icon className="animate-spin" aria-hidden="true" />}
            {pedido?.acao}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
