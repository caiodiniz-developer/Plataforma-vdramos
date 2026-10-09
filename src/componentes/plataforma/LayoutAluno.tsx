import {
  BellIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  GraduationCapIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  HouseIcon,
  ListChecksIcon,
  LogOutIcon,
  MegaphoneIcon,
  MenuIcon,
  MessageSquareIcon,
  MessageSquareHeartIcon,
  ShieldIcon,
  type LucideIcon,
} from 'lucide-react'
import { createContext, useContext, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useSessao } from '@/contextos/Sessao'
import {
  assinarNotificacoes,
  marcarNotificacoesLidas,
  minhasNotificacoes,
  turmasDoAluno,
  type Notificacao,
  type TurmaDoAluno,
} from '@/dados/apoio'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'
import { cn } from '@/lib/utils'
import { iniciais } from '@/dominio/busca'
import { Carregado, FaixaDeCores, Vazio } from './Blocos'

const CHAVE_DA_TURMA = 'vr:turma-atual'

const ContextoDaTurma = createContext<TurmaDoAluno | null>(null)

/** Turma em que o aluno está navegando. Só existe dentro de `LayoutAluno`. */
// eslint-disable-next-line react-refresh/only-export-components
export function useTurmaAtual(): TurmaDoAluno {
  const turma = useContext(ContextoDaTurma)
  if (!turma) throw new Error('useTurmaAtual precisa estar dentro de LayoutAluno')
  return turma
}

type TurmasDoLayout = { turmas: TurmaDoAluno[]; atual: TurmaDoAluno; trocar: (codigo: string) => void; recarregar: () => void }
const ContextoDasTurmas = createContext<TurmasDoLayout | null>(null)

/** Todas as turmas do aluno, a atual e como trocar. Só existe dentro de `LayoutAluno`. */
// eslint-disable-next-line react-refresh/only-export-components
export function useTurmasDoAluno(): TurmasDoLayout {
  const valor = useContext(ContextoDasTurmas)
  if (!valor) throw new Error('useTurmasDoAluno precisa estar dentro de LayoutAluno')
  return valor
}

type Item = { rotulo: string; para: string; icone: LucideIcon; fim?: boolean }
type Grupo = { titulo: string; itens: Item[] }

function gruposDe(turma: TurmaDoAluno): Grupo[] {
  return [
    {
      titulo: 'Estudo',
      itens: [
        { rotulo: 'Início', para: '/aluno', icone: HouseIcon, fim: true },
        { rotulo: 'Conteúdos', para: '/aluno/conteudos', icone: BookOpenIcon },
        { rotulo: 'Atividades', para: '/aluno/atividades', icone: ClipboardListIcon },
        { rotulo: 'Questões', para: '/aluno/questoes', icone: ListChecksIcon },
      ],
    },
    {
      titulo: 'Professor',
      itens: [
        { rotulo: 'Minhas dúvidas', para: '/aluno/duvidas', icone: CircleHelpIcon },
        { rotulo: 'Mensagens', para: '/aluno/mensagens', icone: MessageSquareIcon },
        { rotulo: 'Feedback', para: '/aluno/feedback', icone: MessageSquareHeartIcon },
        { rotulo: 'Avisos', para: '/aluno/avisos', icone: MegaphoneIcon },
      ],
    },
    {
      titulo: 'Turma',
      itens: [
        { rotulo: 'Aulas presenciais', para: `/aluno/turmas/${turma.codigo}`, icone: CalendarDaysIcon },
        { rotulo: 'Minhas turmas', para: '/aluno/minhas-turmas', icone: GraduationCapIcon },
        { rotulo: 'Meus dados', para: '/aluno/meus-dados', icone: ShieldIcon },
      ],
    },
  ]
}

/** Menu da área do aluno, sobre o fundo Tinta da barra lateral. */
function Navegacao({ turma, aoNavegar }: { turma: TurmaDoAluno; aoNavegar?: () => void }) {
  return (
    <nav aria-label="Área do aluno" className="flex flex-col gap-5">
      {gruposDe(turma).map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-1">
          <p className="eyebrow px-3 pb-1 text-[10px] text-papel/70">{grupo.titulo}</p>
          {grupo.itens.map((item) => (
            <NavLink
              key={item.para}
              to={item.para}
              end={item.fim}
              onClick={aoNavegar}
              className={({ isActive }) =>
                cn(
                  'group flex min-h-10 items-center gap-3 border-l-4 px-3 text-sm font-semibold transition-colors',
                  isActive ? 'border-primary bg-papel text-tinta' : 'border-transparent text-papel hover:border-papel/40 hover:bg-papel/10',
                )
              }
            >
              <item.icone aria-hidden="true" className="size-4 shrink-0" />
              {item.rotulo}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

/** Sino com as notificações do aluno; novas chegam em tempo real. */
function Notificacoes({ perfilId }: { perfilId: string }) {
  const navegar = useNavigate()
  const consulta = useConsulta(minhasNotificacoes, [])
  const { recarregar } = consulta
  useEffect(() => assinarNotificacoes(perfilId, recarregar), [perfilId, recarregar])

  const naoLidas = (consulta.dados ?? []).filter((n) => !n.lida_em).length

  async function abrir(notificacao: Notificacao) {
    if (!notificacao.lida_em) await marcarNotificacoesLidas([notificacao.id]).catch(() => {})
    recarregar()
    if (notificacao.link) navegar(notificacao.link)
  }

  async function lerTodas() {
    await marcarNotificacoesLidas().catch(() => {})
    recarregar()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label={naoLidas > 0 ? `Notificações: ${naoLidas} não lidas` : 'Notificações'}
        >
          <BellIcon />
          {naoLidas > 0 && (
            <span
              aria-hidden="true"
              className="destaque absolute -top-2 -right-2 flex min-w-5 items-center justify-center bg-primary px-1 text-[11px] leading-5 text-primary-foreground"
            >
              {naoLidas > 9 ? '9+' : naoLidas}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-[min(360px,calc(100vw-2rem))] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between gap-3">
          <span className="eyebrow">Notificações</span>
          {naoLidas > 0 && (
            <button type="button" onClick={() => void lerTodas()} className="cursor-pointer text-xs font-semibold underline">
              Marcar todas como lidas
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(consulta.dados ?? []).length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhuma notificação por enquanto.</p>
        ) : (
          (consulta.dados ?? []).map((n) => (
            <DropdownMenuItem key={n.id} onSelect={() => void abrir(n)} className="flex cursor-pointer items-start gap-3 py-3">
              <span aria-hidden="true" className={cn('mt-1.5 size-2 shrink-0', n.lida_em ? 'bg-transparent' : 'bg-primary')} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={cn('text-sm leading-snug', !n.lida_em && 'font-semibold')}>{n.titulo}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {formatarDataHora(n.created_at, 'America/Sao_Paulo')}
                  {!n.lida_em && <span className="sr-only"> (não lida)</span>}
                </span>
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Estrutura da área do aluno: navegação lateral, seletor de turma (quando o
 * aluno está em mais de uma), notificações e sair. Entrega a turma atual às
 * páginas pelo contexto.
 */
export function LayoutAluno() {
  const { perfil, encerrar } = useSessao()
  const consulta = useConsulta(turmasDoAluno, [])
  const [escolhida, setEscolhida] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(CHAVE_DA_TURMA)
    } catch {
      return null
    }
  })
  const [menuAberto, setMenuAberto] = useState(false)

  function trocarTurma(codigo: string) {
    setEscolhida(codigo)
    try {
      window.localStorage.setItem(CHAVE_DA_TURMA, codigo)
    } catch {
      // Sem armazenamento, a escolha vale enquanto a página estiver aberta.
    }
  }

  return (
    <div className="plataforma min-h-svh">
      <Carregado consulta={consulta} linhas={4}>
        {(turmas) => {
          if (turmas.length === 0) {
            return (
              <main className="mx-auto flex min-h-svh max-w-[520px] flex-col justify-center gap-4 px-4">
                <Vazio
                  titulo="Você ainda não está em uma turma"
                  texto="Seu acesso pode ter sido bloqueado ou a turma ainda não foi liberada. Fale com o professor."
                >
                  <Button variant="outline" onClick={() => void encerrar()}>
                    Sair
                  </Button>
                </Vazio>
              </main>
            )
          }
          const turma = turmas.find((t) => t.codigo === escolhida) ?? turmas[0]

          const seletor = turmas.length > 1 && (
            <Select value={turma.codigo} onValueChange={trocarTurma}>
              <SelectTrigger size="sm" aria-label="Trocar de turma" className="w-full border-papel/60 bg-tinta text-papel [&_svg]:text-papel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {turmas.map((t) => (
                  <SelectItem key={t.codigo} value={t.codigo}>
                    {t.codigo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )

          const identidade = (
            <div className="flex flex-col border-2 border-papel/30">
              <FaixaDeCores />
              <div className="flex flex-col gap-1 px-3 py-3">
                <p className="eyebrow text-[10px] text-papel/70">Turma</p>
                <p className="destaque text-lg text-papel">{turma.codigo}</p>
                <p className="text-xs text-papel/80">{turma.nome_curso}</p>
              </div>
            </div>
          )

          const sair = (
            <Button
              size="sm"
              variant="outline"
              className="border-papel/60 text-papel hover:border-papel hover:bg-papel hover:text-tinta"
              onClick={() => void encerrar()}
            >
              <LogOutIcon aria-hidden="true" />
              Sair
            </Button>
          )

          return (
            <ContextoDasTurmas.Provider value={{ turmas, atual: turma, trocar: trocarTurma, recarregar: consulta.recarregar }}>
            <ContextoDaTurma.Provider value={turma}>
              <div className="flex min-h-svh flex-col md:flex-row">
                <aside className="sticky top-0 hidden h-svh w-[272px] shrink-0 flex-col gap-6 overflow-y-auto bg-tinta px-4 py-6 text-papel md:flex">
                  <Link to="/aluno" className="px-3 font-mono text-xl font-bold tracking-[-0.02em] text-papel">
                    Vitor Ramos
                  </Link>
                  {identidade}
                  {seletor}
                  <Navegacao turma={turma} />
                  <div className="mt-auto flex flex-col gap-3 border-t-2 border-papel/20 pt-4">{sair}</div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                  <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b-2 bg-background px-4 py-3 md:px-10">
                    <div className="flex items-center gap-3 md:hidden">
                      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
                        <SheetTrigger asChild>
                          <Button size="icon" variant="outline" aria-label="Abrir menu">
                            <MenuIcon />
                          </Button>
                        </SheetTrigger>
                        <SheetContent
                          side="left"
                          className="w-[290px] overflow-y-auto border-r-0 bg-tinta text-papel [&>button]:text-papel"
                        >
                          <SheetHeader>
                            <SheetTitle className="font-mono font-bold text-papel">Área do aluno</SheetTitle>
                            <SheetDescription className="sr-only">Navegação da área do aluno</SheetDescription>
                          </SheetHeader>
                          <div className="flex flex-col gap-5 px-4 pb-6">
                            {identidade}
                            {seletor}
                            <Navegacao turma={turma} aoNavegar={() => setMenuAberto(false)} />
                            {sair}
                          </div>
                        </SheetContent>
                      </Sheet>
                      <span className="destaque text-base">{turma.codigo}</span>
                    </div>
                    <p className="eyebrow hidden text-muted-foreground md:block">Plataforma de apoio às aulas</p>
                    {perfil && (
                      <div className="flex items-center gap-3">
                        <Notificacoes perfilId={perfil.id} />
                        <span className="hidden text-right text-sm leading-tight sm:block">
                          <span className="block font-semibold">{perfil.nome}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{turma.codigo}</span>
                        </span>
                        <span aria-hidden="true" className="destaque flex size-11 items-center justify-center bg-tinta text-sm text-papel">
                          {iniciais(perfil.nome)}
                        </span>
                      </div>
                    )}
                  </header>

                  <main className="surgir mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-8 px-4 py-8 md:px-10 md:py-10">
                    <Outlet />
                  </main>
                </div>
              </div>
            </ContextoDaTurma.Provider>
            </ContextoDasTurmas.Provider>
          )
        }}
      </Carregado>
    </div>
  )
}
