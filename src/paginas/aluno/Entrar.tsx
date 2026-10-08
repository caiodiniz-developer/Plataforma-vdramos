import { BookOpenIcon, CircleHelpIcon, EyeIcon, EyeOffIcon, ListChecksIcon, Loader2Icon, TriangleAlertIcon, type LucideIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FaixaDeCores, Selo, type Cor } from '@/componentes/plataforma/Blocos'
import { useSessao } from '@/contextos/Sessao'
import { cadastrar, entrar } from '@/dados/acesso'
import { SENHA_MINIMA, validarCadastro, type CadastroDeAluno, type ErrosDeCadastro } from '@/dominio/senha'

const DESTAQUES: { titulo: string; texto: string; icone: LucideIcon; cor: Cor }[] = [
  { titulo: 'Conteúdos e aulas extras', texto: 'O material que o professor publica para a sua turma.', icone: BookOpenIcon, cor: 'laranja' },
  { titulo: 'Questões e atividades', texto: 'Pratique e veja a correção na hora.', icone: ListChecksIcon, cor: 'azul' },
  { titulo: 'Dúvidas direto com o professor', texto: 'Só você e ele veem a conversa.', icone: CircleHelpIcon, cor: 'verde' },
]

function Enviar({ ocupado, children }: { ocupado: boolean; children: string }) {
  return (
    <Button type="submit" disabled={ocupado} className="w-full">
      {ocupado && <Loader2Icon className="animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  )
}

function Aviso({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null
  return (
    <Alert variant="destructive" className="bg-card">
      <TriangleAlertIcon aria-hidden="true" />
      <AlertDescription>{mensagem}</AlertDescription>
    </Alert>
  )
}

function ErroDoCampo({ id, mensagem }: { id: string; mensagem?: string }) {
  if (!mensagem) return null
  return (
    <p id={id} className="text-[13px] font-semibold text-destructive">
      {mensagem}
    </p>
  )
}

/** Campo de senha com botão de mostrar/ocultar. */
function CampoDeSenha({
  id,
  rotulo,
  valor,
  aoMudar,
  autoComplete,
  erro,
  ajuda,
}: {
  id: string
  rotulo: string
  valor: string
  aoMudar: (valor: string) => void
  autoComplete: string
  erro?: string
  ajuda?: string
}) {
  const [visivel, setVisivel] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visivel ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined}
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? `Ocultar ${rotulo.toLowerCase()}` : `Mostrar ${rotulo.toLowerCase()}`}
          aria-pressed={visivel}
          className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {visivel ? <EyeOffIcon className="size-4" aria-hidden="true" /> : <EyeIcon className="size-4" aria-hidden="true" />}
        </button>
      </div>
      {ajuda && !erro && (
        <p id={`${id}-ajuda`} className="text-xs text-muted-foreground">
          {ajuda}
        </p>
      )}
      <ErroDoCampo id={`${id}-erro`} mensagem={erro} />
    </div>
  )
}

const CADASTRO_VAZIO: CadastroDeAluno = {
  nome: '',
  matricula: '',
  codigoTurma: '',
  senha: '',
  confirmacao: '',
  aceiteTermo: false,
}

/**
 * Entrada da área do aluno: entrar com ID do aluno + ID da turma + senha, ou
 * criar a conta no primeiro acesso. Só cria conta quem está na lista de IDs
 * que o professor cadastrou para a turma.
 */
export default function Entrar() {
  const id = useId()
  const navegar = useNavigate()
  const { recarregar } = useSessao()

  const [aba, setAba] = useState<'entrar' | 'criar'>('entrar')
  const [login, setLogin] = useState({ matricula: '', codigoTurma: '', senha: '' })
  const [cadastro, setCadastro] = useState<CadastroDeAluno>(CADASTRO_VAZIO)
  const [errosDoCadastro, setErrosDoCadastro] = useState<ErrosDeCadastro>({})
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function executar(acao: () => Promise<unknown>) {
    if (ocupado) return
    setOcupado(true)
    setErro(null)
    try {
      await acao()
      await recarregar()
      navegar('/aluno', { replace: true })
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  function aoEntrar(evento: FormEvent) {
    evento.preventDefault()
    if (login.matricula.trim() === '' || login.codigoTurma.trim() === '' || login.senha === '') {
      setErro('Informe o ID do aluno, o ID da turma e a senha.')
      return
    }
    void executar(() => entrar({ matricula: login.matricula, codigoTurma: login.codigoTurma }, login.senha))
  }

  function aoCriar(evento: FormEvent) {
    evento.preventDefault()
    const encontrados = validarCadastro(cadastro)
    setErrosDoCadastro(encontrados)
    if (Object.keys(encontrados).length > 0) {
      setErro(null)
      return
    }
    void executar(() =>
      cadastrar(
        { matricula: cadastro.matricula, codigoTurma: cadastro.codigoTurma },
        { nome: cadastro.nome, senha: cadastro.senha, aceiteTermo: cadastro.aceiteTermo },
      ),
    )
  }

  function alterarCadastro<C extends keyof CadastroDeAluno>(campo: C, valor: CadastroDeAluno[C]) {
    setCadastro((atual) => ({ ...atual, [campo]: valor }))
    setErrosDoCadastro((atuais) => ({ ...atuais, [campo]: undefined }))
  }

  const campo = (nome: keyof CadastroDeAluno) => ({
    id: `${id}-c-${nome}`,
    'aria-invalid': errosDoCadastro[nome] ? true : undefined,
    'aria-describedby': errosDoCadastro[nome] ? `${id}-c-${nome}-erro` : undefined,
  })

  return (
    <div className="plataforma flex min-h-screen flex-col lg:flex-row">
      <aside className="flex flex-col bg-tinta text-papel lg:sticky lg:top-0 lg:h-screen lg:w-[46%] lg:max-w-[640px]">
        <div className="flex flex-1 flex-col gap-8 px-5 py-6 md:px-12 md:py-10">
          <Link to="/" className="font-mono text-xl font-bold tracking-[-0.02em] text-papel">
            Vitor Ramos
          </Link>
          <div className="flex flex-col gap-4 lg:my-auto">
            <p className="eyebrow text-papel/80">Plataforma de apoio às aulas</p>
            <p className="font-mono text-[30px] leading-[1.05] font-bold tracking-[-0.02em] text-papel md:text-[52px]">
              O que você viu em sala continua aqui.
            </p>
            <ul className="mt-4 hidden flex-col gap-4 lg:flex">
              {DESTAQUES.map((d) => (
                <li key={d.titulo} className="flex items-center gap-4">
                  <Selo icone={d.icone} cor={d.cor} />
                  <span className="flex flex-col">
                    <span className="font-semibold text-papel">{d.titulo}</span>
                    <span className="text-sm text-papel/80">{d.texto}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <FaixaDeCores />
      </aside>

      <main className="surgir mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-4 py-10 md:px-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-[26px]">Área do aluno</h1>
            </CardTitle>
            <CardDescription>
              Use o ID de aluno e o ID da turma que o professor passou em sala.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs
              value={aba}
              onValueChange={(valor) => {
                setAba(valor as 'entrar' | 'criar')
                setErro(null)
              }}
              className="gap-5"
            >
              <TabsList className="w-full">
                <TabsTrigger value="entrar">Entrar</TabsTrigger>
                <TabsTrigger value="criar">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="entrar">
                <form onSubmit={aoEntrar} noValidate className="flex flex-col gap-5">
                  <Aviso mensagem={erro} />
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${id}-matricula`}>ID do aluno</Label>
                    <Input
                      id={`${id}-matricula`}
                      autoComplete="username"
                      autoCapitalize="characters"
                      value={login.matricula}
                      onChange={(e) => setLogin({ ...login, matricula: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${id}-turma`}>ID da turma</Label>
                    <Input
                      id={`${id}-turma`}
                      autoComplete="off"
                      autoCapitalize="characters"
                      placeholder="Ex.: TURMA-001"
                      value={login.codigoTurma}
                      onChange={(e) => setLogin({ ...login, codigoTurma: e.target.value })}
                    />
                  </div>
                  <CampoDeSenha
                    id={`${id}-senha`}
                    rotulo="Senha"
                    autoComplete="current-password"
                    valor={login.senha}
                    aoMudar={(senha) => setLogin({ ...login, senha })}
                  />
                  <Enviar ocupado={ocupado}>Entrar</Enviar>
                  <p className="text-[13px] text-muted-foreground">
                    Primeiro acesso?{' '}
                    <button type="button" onClick={() => setAba('criar')} className="cursor-pointer font-semibold text-foreground underline">
                      Crie sua conta
                    </button>
                    . Esqueceu a senha? Peça ao professor para redefinir.
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="criar">
                <form onSubmit={aoCriar} noValidate className="flex flex-col gap-5">
                  <Aviso mensagem={erro} />
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${id}-c-nome`}>Nome completo</Label>
                    <Input
                      {...campo('nome')}
                      autoComplete="name"
                      value={cadastro.nome}
                      onChange={(e) => alterarCadastro('nome', e.target.value)}
                    />
                    <ErroDoCampo id={`${id}-c-nome-erro`} mensagem={errosDoCadastro.nome} />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`${id}-c-matricula`}>ID do aluno</Label>
                      <Input
                        {...campo('matricula')}
                        autoComplete="username"
                        autoCapitalize="characters"
                        value={cadastro.matricula}
                        onChange={(e) => alterarCadastro('matricula', e.target.value)}
                      />
                      <ErroDoCampo id={`${id}-c-matricula-erro`} mensagem={errosDoCadastro.matricula} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`${id}-c-codigoTurma`}>ID da turma</Label>
                      <Input
                        {...campo('codigoTurma')}
                        autoComplete="off"
                        autoCapitalize="characters"
                        placeholder="Ex.: TURMA-001"
                        value={cadastro.codigoTurma}
                        onChange={(e) => alterarCadastro('codigoTurma', e.target.value)}
                      />
                      <ErroDoCampo id={`${id}-c-codigoTurma-erro`} mensagem={errosDoCadastro.codigoTurma} />
                    </div>
                  </div>
                  <CampoDeSenha
                    id={`${id}-c-senha`}
                    rotulo="Senha"
                    autoComplete="new-password"
                    valor={cadastro.senha}
                    aoMudar={(senha) => alterarCadastro('senha', senha)}
                    erro={errosDoCadastro.senha}
                    ajuda={`Ao menos ${SENHA_MINIMA} caracteres, com letras e números.`}
                  />
                  <CampoDeSenha
                    id={`${id}-c-confirmacao`}
                    rotulo="Confirmar senha"
                    autoComplete="new-password"
                    valor={cadastro.confirmacao}
                    aoMudar={(senha) => alterarCadastro('confirmacao', senha)}
                    erro={errosDoCadastro.confirmacao}
                  />
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        {...campo('aceiteTermo')}
                        checked={cadastro.aceiteTermo}
                        onCheckedChange={(marcado) => alterarCadastro('aceiteTermo', marcado === true)}
                      />
                      <Label htmlFor={`${id}-c-aceiteTermo`} className="leading-snug font-normal">
                        <span>
                          Li e aceito o{' '}
                          <Link to="/privacidade" target="_blank" className="font-semibold underline">
                            termo de uso e a política de privacidade
                          </Link>
                          .
                        </span>
                      </Label>
                    </div>
                    <ErroDoCampo id={`${id}-c-aceiteTermo-erro`} mensagem={errosDoCadastro.aceiteTermo} />
                  </div>
                  <Enviar ocupado={ocupado}>Criar conta</Enviar>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
