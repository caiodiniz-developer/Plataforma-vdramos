import { TriangleAlertIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type Props = { mensagem: string; aoTentarDeNovo?: () => void }

/** Falha de rede ou do servidor, sempre com a ação "Tentar de novo". */
export function EstadoDeErro({ mensagem, aoTentarDeNovo }: Props) {
  return (
    <Alert variant="destructive" className="bg-card">
      <TriangleAlertIcon aria-hidden="true" />
      <AlertTitle>Não foi possível carregar</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>{mensagem}</span>
        {aoTentarDeNovo && (
          <Button size="sm" variant="outline" onClick={aoTentarDeNovo}>
            Tentar de novo
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
