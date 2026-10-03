import { Loader2Icon } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { buscarConsentimentos, registrarConsentimento } from '@/dados/meus-dados'
import { precisaAceitarTermo, VERSAO_TERMO_VIGENTE } from '@/dominio/consentimento'
import { useConsulta } from '@/hooks/useConsulta'
import { EstadoDeErro } from './EstadoDeErro'

/**
 * Seção 7 — LGPD: quando a versão do termo muda, o aluno vê o termo novo e
 * precisa aceitar de novo antes de entrar. Envolve as telas da área do aluno.
 */
export function PortaoDoTermo({ children }: { children: ReactNode }) {
  const id = useId()
  const { dados, carregando, erro, recarregar } = useConsulta(buscarConsentimentos, [])
  const [aceite, setAceite] = useState(false)
  const [salvando, setSalvando] = useState(false)

  if (carregando && !dados) {
    return (
      <div className="mx-auto max-w-[1080px] px-4 py-14 md:px-10" aria-busy="true">
        <span className="sr-only">Carregando</span>
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (erro || !dados) {
    return (
      <div className="mx-auto max-w-[1080px] px-4 py-14 md:px-10">
        <EstadoDeErro mensagem={erro ?? 'Não foi possível carregar.'} aoTentarDeNovo={recarregar} />
      </div>
    )
  }
  if (!precisaAceitarTermo(dados)) return <>{children}</>

  async function aceitar() {
    if (salvando || !aceite) return
    setSalvando(true)
    try {
      await registrarConsentimento('uso_dados_pedagogicos', true)
      recarregar()
    } catch (falha) {
      toast.error((falha as Error).message, { action: { label: 'Tentar de novo', onClick: () => void aceitar() } })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <p className="eyebrow text-muted-foreground">Versão {VERSAO_TERMO_VIGENTE}</p>
          <CardTitle>
            <h1 className="text-[22px]">O termo de uso mudou</h1>
          </CardTitle>
          <CardDescription>Leia a nova versão e confirme o aceite para continuar.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <Checkbox id={`${id}-aceite`} checked={aceite} onCheckedChange={(marcado) => setAceite(marcado === true)} />
            <Label htmlFor={`${id}-aceite`} className="leading-snug font-medium">
              <span>
                Li e aceito o{' '}
                <Link to="/privacidade" target="_blank" className="font-bold underline">
                  termo de uso e a política de privacidade
                </Link>
                .
              </span>
            </Label>
          </div>
          <Button disabled={!aceite || salvando} onClick={() => void aceitar()} className="self-start">
            {salvando && <Loader2Icon className="animate-spin" aria-hidden="true" />}
            Continuar
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
