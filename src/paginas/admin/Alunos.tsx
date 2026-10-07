import {
  EyeIcon,
  KeyRoundIcon,
  Loader2Icon,
  LockIcon,
  MailIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SearchXIcon,
  Trash2Icon,
  UnlockIcon,
  UserPlusIcon,
  UsersIcon,
} from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Busca, CabecalhoDaPagina, Carregado, Vazio } from '@/componentes/plataforma/Blocos'
import { Confirmar, type Confirmacao } from '@/componentes/plataforma/Confirmar'
import {
  criarAluno,
  definirBloqueio,
  editarAluno,
  listarAlunos,
  listarTurmas,
  redefinirSenha,
  removerAluno,
  responderAoAluno,
  type AlunoDoProfessor,
} from '@/dados/professor'
import { contem, percentualDe } from '@/dominio/busca'
import { problemaDaSenha } from '@/dominio/senha'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'
import { ROTULO_SITUACAO, VARIANTE_SITUACAO } from './situacao'

const FUSO = 'America/Sao_Paulo'
const TODAS = 'todas'

type Formulario =
  | { tipo: 'criar' }
  | { tipo: 'editar'; aluno: AlunoDoProfessor }
  | { tipo: 'redefinir'; aluno: AlunoDoProfessor }
  | { tipo: 'mensagem'; aluno: AlunoDoProfessor }

async function carregar() {
  const [alunos, turmas] = await Promise.all([listarAlunos(), listarTurmas()])
  return { alunos, turmas }
}

function nomeDe(aluno: AlunoDoProfessor) {
  return aluno.nome ?? 'Sem nome'
}

/** Formulários de criar, editar, redefinir senha e enviar mensagem. */
function FormularioDoAluno({
  formulario,
  turmas,
  aoFechar,
}: {
  formulario: Formulario
  turmas: { id: string; codigo: string }[]
  aoFechar: (feito: boolean) => void
}) {
  const id = useId()
  const aluno = formulario.tipo === 'criar' ? null : formulario.aluno
  const [turmaId, setTurmaId] = useState(turmas[0]?.id ?? '')
  const [nome, setNome] = useState(aluno?.nome ?? '')
  const [matricula, setMatricula] = useState(aluno?.matricula ?? '')
  const [senha, setSenha] = useState('')
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const TITULO = { criar: 'Novo aluno', editar: 'Editar aluno', redefinir: 'Redefinir senha', mensagem: 'Enviar mensagem' }[formulario.tipo]
  const DESCRICAO = {
    criar: 'O aluno entra com o ID, o ID da turma e a senha. Sem senha inicial, ele cria a própria no primeiro acesso.',
    editar: 'O ID é o que o aluno digita para entrar.',
    redefinir: `Defina uma nova senha para ${aluno ? nomeDe(aluno) : ''} e avise o aluno.`,
    mensagem: `Mensagem privada para ${aluno ? nomeDe(aluno) : ''}. Só vocês dois veem.`,
  }[formulario.tipo]

  function validar(): string | null {
    if (formulario.tipo === 'criar' || formulario.tipo === 'editar') {
      if (nome.trim().length < 3) return 'Informe o nome completo do aluno.'
      if (matricula.trim().length < 2) return 'Informe o ID do aluno.'
    }
    if (formulario.tipo === 'criar' && !turmaId) return 'Escolha a turma.'
    if (formulario.tipo === 'redefinir' || (formulario.tipo === 'criar' && senha !== '')) return problemaDaSenha(senha)
    if (formulario.tipo === 'mensagem' && texto.trim() === '') return 'Escreva a mensagem.'
    return null
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    const problema = validar()
    if (problema) return setErro(problema)
    setEnviando(true)
    setErro(null)
    try {
      if (formulario.tipo === 'criar') {
        await criarAluno({ turmaId, matricula, nome, senha })
        toast.success('Aluno criado', {
          description: senha === '' ? 'Ele cria a própria senha no primeiro acesso.' : 'Ele já pode entrar com o ID, a turma e a senha.',
        })
      } else if (formulario.tipo === 'editar') {
        await editarAluno(formulario.aluno, { nome, matricula })
        toast.success('Dados do aluno atualizados')
      } else if (formulario.tipo === 'redefinir') {
        await redefinirSenha(formulario.aluno.aluno_autorizado_id, senha)
        toast.success('Senha redefinida')
      } else {
        await responderAoAluno(formulario.aluno.inscricao_id!, texto)
        toast.success('Mensagem enviada')
      }
      aoFechar(true)
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const comDados = formulario.tipo === 'criar' || formulario.tipo === 'editar'
  const comSenha = formulario.tipo === 'criar' || formulario.tipo === 'redefinir'

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar(false)}>
      <DialogContent className="plataforma max-h-[92vh] min-h-0 overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-[22px] font-bold">{TITULO}</DialogTitle>
          <DialogDescription>{DESCRICAO}</DialogDescription>
        </DialogHeader>
        <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
          {comDados && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-nome`}>Nome completo</Label>
                <Input id={`${id}-nome`} maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${id}-matricula`}>ID do aluno</Label>
                  <Input
                    id={`${id}-matricula`}
                    maxLength={30}
                    className="font-mono uppercase"
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                  />
                </div>
                {formulario.tipo === 'criar' && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${id}-turma`}>Turma</Label>
                    <Select value={turmaId} onValueChange={setTurmaId}>
                      <SelectTrigger id={`${id}-turma`}>
                        <SelectValue placeholder="Escolha" />
                      </SelectTrigger>
                      <SelectContent>
                        {turmas.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.codigo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </>
          )}
          {comSenha && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-senha`}>{formulario.tipo === 'criar' ? 'Senha inicial (opcional)' : 'Nova senha'}</Label>
              <Input
                id={`${id}-senha`}
                type="text"
                autoComplete="off"
                maxLength={72}
                className="font-mono"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                aria-describedby={`${id}-dica`}
              />
              <p id={`${id}-dica`} className="text-xs text-muted-foreground">
                Ao menos 8 caracteres, com letras e números. Ela é guardada com hash: depois de salvar, ninguém consegue ler.
              </p>
            </div>
          )}
          {formulario.tipo === 'mensagem' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-texto`}>Mensagem</Label>
              <Textarea id={`${id}-texto`} rows={5} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} />
            </div>
          )}
          {erro && (
            <p role="alert" className="text-[13px] font-semibold text-destructive">
              {erro}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => aoFechar(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando && <Loader2Icon className="animate-spin" aria-hidden="true" />}
              {formulario.tipo === 'mensagem' ? 'Enviar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Gestão de alunos: lista, busca, criação, edição, bloqueio e remoção. */
export default function Alunos() {
  const navegar = useNavigate()
  const consulta = useConsulta(carregar, [])
  const [busca, setBusca] = useState('')
  const [turma, setTurma] = useState(TODAS)
  const [situacao, setSituacao] = useState(TODAS)
  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)

  function pedirBloqueio(aluno: AlunoDoProfessor) {
    const bloquear = aluno.ativo
    setConfirmacao({
      titulo: bloquear ? `Bloquear ${nomeDe(aluno)}?` : `Desbloquear ${nomeDe(aluno)}?`,
      texto: bloquear
        ? 'O aluno perde o acesso na hora e vê o aviso de conta bloqueada ao tentar entrar. Os dados dele continuam guardados.'
        : 'O aluno volta a entrar normalmente com a mesma senha.',
      acao: bloquear ? 'Bloquear' : 'Desbloquear',
      executar: () => definirBloqueio(aluno.aluno_autorizado_id, bloquear),
      sucesso: bloquear ? 'Aluno bloqueado' : 'Aluno desbloqueado',
    })
  }

  function pedirRemocao(aluno: AlunoDoProfessor) {
    setConfirmacao({
      titulo: `Remover ${nomeDe(aluno)}?`,
      texto: 'A conta, as respostas, as dúvidas e as mensagens deste aluno são apagadas. Esta ação não pode ser desfeita.',
      acao: 'Remover aluno',
      destrutiva: true,
      executar: () => removerAluno(aluno.aluno_autorizado_id),
      sucesso: 'Aluno removido',
    })
  }

  return (
    <>
      <CabecalhoDaPagina rotulo="Geral" titulo="Alunos" descricao="Quem pode entrar na plataforma, em qual turma e como está indo.">
        <Busca valor={busca} aoMudar={setBusca} rotulo="Pesquisar por nome ou ID" />
        <Button onClick={() => setFormulario({ tipo: 'criar' })}>
          <UserPlusIcon aria-hidden="true" />
          Novo aluno
        </Button>
      </CabecalhoDaPagina>

      <Carregado consulta={consulta} linhas={5}>
        {({ alunos, turmas }) => {
          const visiveis = alunos.filter(
            (a) =>
              contem(busca, a.nome, a.matricula, a.turma_codigo) &&
              (turma === TODAS || a.turma_id === turma) &&
              (situacao === TODAS || a.situacao === situacao),
          )

          return (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={turma} onValueChange={setTurma}>
                  <SelectTrigger aria-label="Filtrar por turma" className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODAS}>Todas as turmas</SelectItem>
                    {turmas.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.codigo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={situacao} onValueChange={setSituacao}>
                  <SelectTrigger aria-label="Filtrar por status" className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODAS}>Todos os status</SelectItem>
                    <SelectItem value="ativo">Ativos</SelectItem>
                    <SelectItem value="bloqueado">Bloqueados</SelectItem>
                    <SelectItem value="sem_conta">Sem conta</SelectItem>
                  </SelectContent>
                </Select>
                <p className="ml-auto text-sm text-muted-foreground">
                  <span className="destaque text-base text-foreground">{visiveis.length}</span> de {alunos.length}
                </p>
              </div>

              {alunos.length === 0 ? (
                <Vazio icone={UsersIcon} titulo="Nenhum aluno ainda" texto="Crie o primeiro aluno para ele entrar na plataforma.">
                  <Button size="sm" onClick={() => setFormulario({ tipo: 'criar' })} disabled={turmas.length === 0}>
                    Novo aluno
                  </Button>
                  {turmas.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Antes, crie uma turma em{' '}
                      <Link to="/admin/turmas" className="underline underline-offset-[3px]">
                        Turmas
                      </Link>
                      .
                    </p>
                  )}
                </Vazio>
              ) : visiveis.length === 0 ? (
                <Vazio icone={SearchXIcon} titulo="Ninguém neste filtro" texto="Troque o filtro ou o termo da pesquisa." />
              ) : (
                <div className="overflow-x-auto border-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Turma</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Progresso</TableHead>
                        <TableHead>Último acesso</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visiveis.map((a) => (
                        <TableRow key={a.aluno_autorizado_id}>
                          <TableCell className="font-semibold">
                            <Link to={`/admin/alunos/${a.aluno_autorizado_id}`} className="hover:underline">
                              {nomeDe(a)}
                            </Link>
                          </TableCell>
                          <TableCell className="font-mono text-[13px]">{a.matricula}</TableCell>
                          <TableCell className="font-mono text-[13px]">{a.turma_codigo}</TableCell>
                          <TableCell>
                            <Badge variant={VARIANTE_SITUACAO[a.situacao]}>{ROTULO_SITUACAO[a.situacao]}</Badge>
                          </TableCell>
                          <TableCell className="text-[13px] whitespace-nowrap">
                            {a.inscricao_id ? (
                              <>
                                {a.atividades_realizadas} {a.atividades_realizadas === 1 ? 'atividade' : 'atividades'}
                                {a.questoes_respondidas > 0 && ` · ${percentualDe(a.questoes_corretas, a.questoes_respondidas)}% de acerto`}
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-[12px] whitespace-nowrap">
                            {a.ultimo_acesso_em ? formatarDataHora(a.ultimo_acesso_em, FUSO) : <span className="text-muted-foreground">Nunca</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon-sm" variant="ghost" aria-label={`Ações de ${nomeDe(a)}`}>
                                  <MoreHorizontalIcon />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => navegar(`/admin/alunos/${a.aluno_autorizado_id}`)}>
                                  <EyeIcon aria-hidden="true" />
                                  Ver perfil
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setFormulario({ tipo: 'editar', aluno: a })}>
                                  <PencilIcon aria-hidden="true" />
                                  Editar
                                </DropdownMenuItem>
                                {a.inscricao_id && (
                                  <>
                                    <DropdownMenuItem onSelect={() => setFormulario({ tipo: 'mensagem', aluno: a })}>
                                      <MailIcon aria-hidden="true" />
                                      Enviar mensagem
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setFormulario({ tipo: 'redefinir', aluno: a })}>
                                      <KeyRoundIcon aria-hidden="true" />
                                      Redefinir senha
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => pedirBloqueio(a)}>
                                  {a.ativo ? <LockIcon aria-hidden="true" /> : <UnlockIcon aria-hidden="true" />}
                                  {a.ativo ? 'Bloquear' : 'Desbloquear'}
                                </DropdownMenuItem>
                                <DropdownMenuItem variant="destructive" onSelect={() => pedirRemocao(a)}>
                                  <Trash2Icon aria-hidden="true" />
                                  Remover
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {formulario && (
                <FormularioDoAluno
                  formulario={formulario}
                  turmas={turmas}
                  aoFechar={(feito) => {
                    setFormulario(null)
                    if (feito) consulta.recarregar()
                  }}
                />
              )}
            </>
          )
        }}
      </Carregado>

      <Confirmar
        pedido={confirmacao}
        aoFechar={(feito) => {
          setConfirmacao(null)
          if (feito) consulta.recarregar()
        }}
      />
    </>
  )
}
