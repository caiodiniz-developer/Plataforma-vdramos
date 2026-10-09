import { Loader2Icon, MailIcon } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { buscarConsentimentos, buscarEmailDeContato, registrarConsentimento, salvarEmailDeContato } from '@/dados/meus-dados'
import { emailValido, precisaAceitarTermo, precisaResponderComunicacao, VERSAO_TERMO_VIGENTE } from '@/dominio/consentimento'
import { useConsulta } from '@/hooks/useConsulta'
import { EstadoDeErro } from './EstadoDeErro'

/**
 * Pergunta, uma única vez e antes do portal, se o aluno quer receber
 * comunicações do professor por e-mail. O e-mail é opcional: só é exigido de
 * quem responde que quer receber. Dizer "não" também encerra a pergunta.
 */
function PerguntaDeComunicacao({ aoResponder }: { aoResponder: () => void }) {
  const id = useId()
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<'sim' | 'nao' | null>(null)

  // Quem informou o e-mail no cadastro já encontra o campo preenchido.
  useEffect(() => {
    let ativo = true
    buscarEmailDeContato()
      .then((gravado) => ativo && gravado && setEmail((atual) => atual || gravado))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  async function responder(quer: boolean) {
    if (salvando) return
    const informado = email.trim()
    if (quer && informado === '') return setErro('Para receber, informe um e-mail.')
    if (informado !== '' && !emailValido(informado)) return setErro('Confira o e-mail informado.')
    setSalvando(quer ? 'sim' : 'nao')
    setErro(null)
    try {
      if (informado !== '') await salvarEmailDeContato(informado)
      await registrarConsentimento('comunicacao_professor', quer)
      aoResponder()
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setSalvando(null)
    }
  }

  return (
    <main className="plataforma mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <p className="eyebrow text-muted-foreground">Antes de entrar</p>
          <CardTitle>
            <h1 className="text-[22px]">Quer receber comunicações do professor?</h1>
          </CardTitle>
          <CardDescription>
            Avisos de aula, prazos e materiais podem chegar também no seu e-mail. Você escolhe agora e pode mudar quando quiser em Meus dados.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-email`}>Seu e-mail (opcional)</Label>
            <Input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={`${id}-ajuda`}
            />
            <p id={`${id}-ajuda`} className="text-xs text-muted-foreground">
              Usado só para as comunicações que você autorizar. Não é o seu login: você continua entrando com ID, turma e senha.
            </p>
          </div>
          {erro && (
            <p role="alert" className="text-[13px] font-semibold text-destructive">
              {erro}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button disabled={salvando !== null} onClick={() => void responder(true)}>
              {salvando === 'sim' ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <MailIcon aria-hidden="true" />}
              Quero receber
            </Button>
            <Button variant="outline" disabled={salvando !== null} onClick={() => void responder(false)}>
              {salvando === 'nao' && <Loader2Icon className="animate-spin" aria-hidden="true" />}
              Agora não
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

/**
 * Seção 7 — LGPD: quando a versão do termo muda, o aluno vê o termo novo e
 * precisa aceitar de novo antes de entrar. Depois do termo, pergunta uma vez
 * sobre as comunicações do professor. Envolve as telas da área do aluno.
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
  if (!precisaAceitarTermo(dados)) {
    return precisaResponderComunicacao(dados) ? <PerguntaDeComunicacao aoResponder={recarregar} /> : <>{children}</>
  }

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
    <main className="plataforma mx-auto flex min-h-screen w-full max-w-[520px] flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <p className="eyebrow text-muted-foreground">Versão {VERSAO_TERMO_VIGENTE}</p>
          <CardTitle>
            <h1 className="text-[22px]">{dados.length === 0 ? 'Antes de começar' : 'O termo de uso mudou'}</h1>
          </CardTitle>
          <CardDescription>
            {dados.length === 0
              ? 'Leia o termo de uso e confirme o aceite para acessar a plataforma.'
              : 'Leia a nova versão e confirme o aceite para continuar.'}
          </CardDescription>
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
