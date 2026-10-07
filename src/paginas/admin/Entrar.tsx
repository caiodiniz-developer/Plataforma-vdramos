import { Loader2Icon, TriangleAlertIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSessao } from '@/contextos/Sessao'
import { entrarComoAdmin } from '@/dados/sessao'

/** PRD F14: login do professor com e-mail e senha; exige papel admin. */
export default function EntrarAdmin() {
  const id = useId()
  const navegar = useNavigate()
  const { recarregar } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (ocupado) return
    if (email.trim() === '' || senha === '') {
      setErro('Informe e-mail e senha.')
      return
    }
    setOcupado(true)
    setErro(null)
    try {
      await entrarComoAdmin(email, senha)
      await recarregar()
      navegar('/admin', { replace: true })
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="plataforma flex min-h-screen flex-col">
      <header className="border-b-2">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between px-4 py-3 md:px-10">
          <Link to="/" className="font-mono text-lg font-bold tracking-[-0.02em]">
            Vitor Ramos
          </Link>
          <span className="eyebrow text-muted-foreground">Painel do professor</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-[22px]">Entrar</h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-5">
              {erro && (
                <Alert variant="destructive" className="bg-card">
                  <TriangleAlertIcon aria-hidden="true" />
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-email`}>E-mail</Label>
                <Input
                  id={`${id}-email`}
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-senha`}>Senha</Label>
                <Input
                  id={`${id}-senha`}
                  type="password"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={ocupado} variant="secondary">
                {ocupado && <Loader2Icon className="animate-spin" aria-hidden="true" />}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
