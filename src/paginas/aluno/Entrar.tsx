import { Loader2Icon, TriangleAlertIcon } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { useSessao } from '@/contextos/Sessao'
import { cadastrar, confirmarCodigo, verificarIds, type IdsDeAcesso } from '@/dados/acesso'
import { emailValido } from '@/dominio/email'

type Etapa = 'ids' | 'cadastro' | 'codigo'

const ESPERA_REENVIO_S = 60

function Enviar({ ocupado, children }: { ocupado: boolean; children: string }) {
  return (
    <Button type="submit" disabled={ocupado}>
      {ocupado && <Loader2Icon className="animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  )
}

/**
 * PRD F3 e F4: entrada do aluno em até três etapas — IDs, cadastro (só no
 * primeiro acesso) e código de 6 dígitos enviado por e-mail.
 */
export default function Entrar() {
  const id = useId()
  const navegar = useNavigate()
  const { recarregar } = useSessao()

  const [etapa, setEtapa] = useState<Etapa>('ids')
  const [primeiroAcesso, setPrimeiroAcesso] = useState(false)
  const [ids, setIds] = useState<IdsDeAcesso>({ matricula: '', codigoTurma: '' })
  const [cadastro, setCadastro] = useState({ nome: '', email: '', aceiteTermo: false, querComunicacao: false })
  const [emailMascarado, setEmailMascarado] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [espera, setEspera] = useState(0)

  // Contagem para liberar "Reenviar código" (60 s, seção 7).
  useEffect(() => {
    if (espera <= 0) return
    const relogio = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(relogio)
  }, [espera])

  const totalEtapas = primeiroAcesso ? 3 : 2
  const numeroEtapa = etapa === 'ids' ? 1 : etapa === 'cadastro' ? 2 : totalEtapas

  async function executar(acao: () => Promise<void>) {
    if (ocupado) return
    setOcupado(true)
    setErro(null)
    try {
      await acao()
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  function irParaCodigo(mascarado: string) {
    setEmailMascarado(mascarado)
    setCodigo('')
    setEspera(ESPERA_REENVIO_S)
    setEtapa('codigo')
  }

  function aoEnviarIds(evento: FormEvent) {
    evento.preventDefault()
    if (ids.matricula.trim() === '' || ids.codigoTurma.trim() === '') {
      setErro('Informe o ID do aluno e o ID da turma.')
      return
    }
    void executar(async () => {
      const resultado = await verificarIds(ids)
      if (resultado.etapa === 'cadastro') {
        setPrimeiroAcesso(true)
        setEtapa('cadastro')
      } else {
        irParaCodigo(resultado.emailMascarado)
      }
    })
  }

  function aoEnviarCadastro(evento: FormEvent) {
    evento.preventDefault()
    if (cadastro.nome.trim() === '') return setErro('Informe seu nome completo.')
    if (!emailValido(cadastro.email)) return setErro('Confira o e-mail informado.')
    if (!cadastro.aceiteTermo) return setErro('É preciso aceitar o termo de uso para continuar.')
    void executar(async () => {
      const resultado = await cadastrar(ids, cadastro)
      if (resultado.etapa === 'codigo') irParaCodigo(resultado.emailMascarado)
    })
  }

  function aoEnviarCodigo(evento: FormEvent) {
    evento.preventDefault()
    if (codigo.length !== 6) return setErro('Informe o código de 6 dígitos.')
    void executar(async () => {
      try {
        const codigoTurma = await confirmarCodigo(ids, codigo)
        await recarregar()
        navegar(`/aluno/turmas/${codigoTurma}`, { replace: true })
      } catch (falha) {
        // Campo cheio não aceita novos dígitos: limpa para o aluno digitar de novo.
        setCodigo('')
        throw falha
      }
    })
  }

  function reenviar() {
    void executar(async () => {
      const resultado = primeiroAcesso ? await cadastrar(ids, cadastro) : await verificarIds(ids)
      if (resultado.etapa === 'codigo') irParaCodigo(resultado.emailMascarado)
    })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-2">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between px-4 py-3 md:px-10">
          <Link to="/" className="font-mono text-lg font-bold tracking-[-0.02em]">
            Vitor Ramos
          </Link>
          <span className="eyebrow text-muted-foreground">Área do aluno</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center px-4 py-12">
        <Card>
          <CardHeader>
            <p className="eyebrow text-muted-foreground" aria-live="polite">
              Etapa {numeroEtapa} de {totalEtapas}
            </p>
            <Progress value={(numeroEtapa / totalEtapas) * 100} aria-label="Progresso da entrada" className="h-1.5" />
            <CardTitle>
              <h1 className="text-[22px]">
                {etapa === 'ids' && 'Entrar na turma'}
                {etapa === 'cadastro' && 'Seu cadastro'}
                {etapa === 'codigo' && 'Código de acesso'}
              </h1>
            </CardTitle>
            <CardDescription>
              {etapa === 'ids' && 'Use o ID de aluno e o ID da turma informados pelo professor.'}
              {etapa === 'cadastro' && 'Este é seu primeiro acesso. Confirme seus dados para continuar.'}
              {etapa === 'codigo' && `Enviamos um código de 6 dígitos para ${emailMascarado}. Ele vale por 10 minutos.`}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            {erro && (
              <Alert variant="destructive" className="bg-card">
                <TriangleAlertIcon aria-hidden="true" />
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}

            {etapa === 'ids' && (
              <form onSubmit={aoEnviarIds} noValidate className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${id}-matricula`}>ID do aluno</Label>
                  <Input
                    id={`${id}-matricula`}
                    autoComplete="off"
                    autoCapitalize="characters"
                    value={ids.matricula}
                    onChange={(e) => setIds({ ...ids, matricula: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${id}-turma`}>ID da turma</Label>
                  <Input
                    id={`${id}-turma`}
                    autoComplete="off"
                    autoCapitalize="characters"
                    placeholder="Ex.: EXCIA-CPS-2610"
                    value={ids.codigoTurma}
                    onChange={(e) => setIds({ ...ids, codigoTurma: e.target.value })}
                  />
                </div>
                <Enviar ocupado={ocupado}>Continuar</Enviar>
              </form>
            )}

            {etapa === 'cadastro' && (
              <form onSubmit={aoEnviarCadastro} noValidate className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${id}-nome`}>Nome completo</Label>
                  <Input
                    id={`${id}-nome`}
                    autoComplete="name"
                    value={cadastro.nome}
                    onChange={(e) => setCadastro({ ...cadastro, nome: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${id}-email`}>E-mail</Label>
                  <Input
                    id={`${id}-email`}
                    type="email"
                    autoComplete="email"
                    value={cadastro.email}
                    onChange={(e) => setCadastro({ ...cadastro, email: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">O código de acesso chega neste e-mail.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`${id}-termo`}
                    checked={cadastro.aceiteTermo}
                    onCheckedChange={(marcado) => setCadastro({ ...cadastro, aceiteTermo: marcado === true })}
                  />
                  <Label htmlFor={`${id}-termo`} className="leading-snug font-medium">
                    <span>
                      Li e aceito o{' '}
                      <Link to="/privacidade" target="_blank" className="font-bold underline">
                        termo de uso e a política de privacidade
                      </Link>
                      .
                    </span>
                  </Label>
                </div>
                {/* LGPD: comunicação é opcional e nunca vem ligada. */}
                <div className="flex items-start justify-between gap-4 border-t border-divisor pt-4">
                  <Label htmlFor={`${id}-comunicacao`} className="leading-snug font-medium">
                    Quero receber comunicações do professor por e-mail
                  </Label>
                  <Switch
                    id={`${id}-comunicacao`}
                    checked={cadastro.querComunicacao}
                    onCheckedChange={(ligado) => setCadastro({ ...cadastro, querComunicacao: ligado })}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Enviar ocupado={ocupado}>Enviar código</Enviar>
                  <Button type="button" variant="link" onClick={() => setEtapa('ids')}>
                    Voltar
                  </Button>
                </div>
              </form>
            )}

            {etapa === 'codigo' && (
              <form onSubmit={aoEnviarCodigo} noValidate className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${id}-codigo`}>Código</Label>
                  <InputOTP
                    id={`${id}-codigo`}
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    value={codigo}
                    onChange={setCodigo}
                    aria-invalid={erro ? true : undefined}
                  >
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((indice) => (
                        <InputOTPSlot key={indice} index={indice} className="size-11 border-2 text-lg font-bold" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Enviar ocupado={ocupado}>Entrar</Enviar>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="link" disabled={espera > 0 || ocupado} onClick={reenviar}>
                    {espera > 0 ? `Reenviar código em ${espera} s` : 'Reenviar código'}
                  </Button>
                  <Button type="button" variant="link" onClick={() => setEtapa('ids')}>
                    Trocar os IDs
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
