import {
  BellIcon,
  BookOpenIcon,
  CalendarDaysIcon,
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
import { Carregado, Vazio } from './Blocos'

const CHAVE_DA_TURMA = 'vr:turma-atual'

const ContextoDaTurma = createContext<TurmaDoAluno | null>(null)

/** Turma em que o aluno está navegando. Só existe dentro de `LayoutAluno`. */
// eslint-disable-next-line react-refresh/only-export-components
export function useTurmaAtual(): TurmaDoAluno {
  const turma = useContext(ContextoDaTurma)
  if (!turma) throw new Error('useTurmaAtual precisa estar dentro de LayoutAluno')
  return turma
}

type Item = { rotulo: string; para: string; icone: LucideIcon; fim?: boolean }

const ITENS: Item[] = [
  { rotulo: 'Início', para: '/aluno', icone: HouseIcon, fim: true },
  { rotulo: 'Conteúdos', para: '/aluno/conteudos', icone: BookOpenIcon },
  { rotulo: 'Atividades', para: '/aluno/atividades', icone: ClipboardListIcon },
  { rotulo: 'Questões', para: '/aluno/questoes', icone: ListChecksIcon },
  { rotulo: 'Minhas dúvidas', para: '/aluno/duvidas', icone: CircleHelpIcon },
  { rotulo: 'Mensagens', para: '/aluno/mensagens', icone: MessageSquareIcon },
  { rotulo: 'Feedback', para: '/aluno/feedback', icone: MessageSquareHeartIcon },
  { rotulo: 'Avisos', para: '/aluno/avisos', icone: MegaphoneIcon },
]

function Navegacao({ turma, aoNavegar }: { turma: TurmaDoAluno; aoNavegar?: () => void }) {
  const itens: Item[] = [
    ...ITENS,
    { rotulo: 'Aulas presenciais', para: `/aluno/turmas/${turma.codigo}`, icone: CalendarDaysIcon },
    { rotulo: 'Meus dados', para: '/aluno/meus-dados', icone: ShieldIcon },
  ]
  return (
    <nav aria-label="Área do aluno" className="flex flex-col gap-1">
      {itens.map((item) => (
        <NavLink
          key={item.para}
          to={item.para}
          end={item.fim}
          onClick={aoNavegar}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 items-center gap-3 border-2 border-transparent px-3 text-sm font-semibold transition-colors',
              isActive ? 'border-foreground bg-secondary text-secondary-foreground' : 'hover:bg-accent',
            )
          }
        >
          <item.icone aria-hidden="true" className="size-4 shrink-0" />
          {item.rotulo}
        </NavLink>
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
              <SelectTrigger size="sm" aria-label="Trocar de turma" className="w-full">
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
            <div className="flex flex-col gap-1 border-2 bg-muted px-3 py-3">
              <p className="eyebrow text-muted-foreground">Turma</p>
              <p className="destaque text-base">{turma.codigo}</p>
              <p className="text-xs text-muted-foreground">{turma.nome_curso}</p>
            </div>
          )

          return (
            <ContextoDaTurma.Provider value={turma}>
              <div className="flex min-h-svh flex-col md:flex-row">
                <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r-2 px-4 py-6 md:flex">
                  <Link to="/aluno" className="px-3 font-mono text-lg font-bold tracking-[-0.02em]">
                    Vitor Ramos
                  </Link>
                  {identidade}
                  {seletor}
                  <Navegacao turma={turma} />
                  <div className="mt-auto flex flex-col gap-2 px-1">
                    {perfil && <p className="truncate text-sm font-semibold">{perfil.nome}</p>}
                    <Button size="sm" variant="outline" onClick={() => void encerrar()}>
                      <LogOutIcon aria-hidden="true" />
                      Sair
                    </Button>
                  </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                  <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b-2 bg-background px-4 py-3 md:justify-end md:px-10">
                    <div className="flex items-center gap-3 md:hidden">
                      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
                        <SheetTrigger asChild>
                          <Button size="icon" variant="outline" aria-label="Abrir menu">
                            <MenuIcon />
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="plataforma w-[290px] overflow-y-auto border-r-2">
                          <SheetHeader>
                            <SheetTitle className="font-mono font-bold">Área do aluno</SheetTitle>
                            <SheetDescription className="sr-only">Navegação da área do aluno</SheetDescription>
                          </SheetHeader>
                          <div className="flex flex-col gap-5 px-4 pb-6">
                            {identidade}
                            {seletor}
                            <Navegacao turma={turma} aoNavegar={() => setMenuAberto(false)} />
                            <Button size="sm" variant="outline" onClick={() => void encerrar()}>
                              <LogOutIcon aria-hidden="true" />
                              Sair
                            </Button>
                          </div>
                        </SheetContent>
                      </Sheet>
                      <span className="destaque text-base">{turma.codigo}</span>
                    </div>
                    {perfil && <Notificacoes perfilId={perfil.id} />}
                  </header>

                  <main className="mx-auto flex w-full max-w-[1040px] flex-1 flex-col gap-8 px-4 py-8 md:px-10 md:py-10">
                    <Outlet />
                  </main>
                </div>
              </div>
            </ContextoDaTurma.Provider>
          )
        }}
      </Carregado>
    </div>
  )
}
