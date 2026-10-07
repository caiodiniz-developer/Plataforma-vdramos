import {
  BookOpenIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  GraduationCapIcon,
  HouseIcon,
  InboxIcon,
  ListChecksIcon,
  LogOutIcon,
  MegaphoneIcon,
  MenuIcon,
  MessageSquareIcon,
  MessagesSquareIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useSessao } from '@/contextos/Sessao'
import { sair } from '@/dados/sessao'
import { cn } from '@/lib/utils'

type Item = { rotulo: string; para: string; icone: LucideIcon }
type Grupo = { titulo: string; itens: Item[] }

/** Seções do painel do professor, agrupadas por assunto. */
const GRUPOS: Grupo[] = [
  {
    titulo: 'Geral',
    itens: [
      { rotulo: 'Painel', para: '/admin', icone: HouseIcon },
      { rotulo: 'Alunos', para: '/admin/alunos', icone: UsersIcon },
      { rotulo: 'Turmas', para: '/admin/turmas', icone: GraduationCapIcon },
    ],
  },
  {
    titulo: 'Ensino',
    itens: [
      { rotulo: 'Conteúdos', para: '/admin/conteudos', icone: BookOpenIcon },
      { rotulo: 'Atividades', para: '/admin/atividades', icone: ClipboardListIcon },
      { rotulo: 'Questões', para: '/admin/questoes', icone: ListChecksIcon },
    ],
  },
  {
    titulo: 'Comunicação',
    itens: [
      { rotulo: 'Dúvidas', para: '/admin/duvidas', icone: CircleHelpIcon },
      { rotulo: 'Mensagens', para: '/admin/conversas', icone: MessagesSquareIcon },
      { rotulo: 'Feedbacks', para: '/admin/feedbacks', icone: MessageSquareIcon },
      { rotulo: 'Avisos', para: '/admin/avisos', icone: MegaphoneIcon },
      { rotulo: 'Contatos do site', para: '/admin/mensagens', icone: InboxIcon },
    ],
  },
]

function Navegacao({ aoNavegar }: { aoNavegar?: () => void }) {
  return (
    <nav aria-label="Painel do professor" className="flex flex-col gap-5">
      {GRUPOS.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-1">
          <p className="eyebrow px-3 pb-1 text-[10px] text-muted-foreground">{grupo.titulo}</p>
          {grupo.itens.map((item) => (
            <NavLink
              key={item.para}
              to={item.para}
              end={item.para === '/admin'}
              onClick={aoNavegar}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 border-2 border-transparent px-3 py-2 text-sm font-semibold',
                  isActive ? 'border-foreground bg-secondary text-secondary-foreground' : 'hover:bg-accent',
                )
              }
            >
              <item.icone aria-hidden="true" className="size-4" />
              {item.rotulo}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

/** Estrutura do admin: barra lateral e área principal. */
export function LayoutAdmin() {
  const navegar = useNavigate()
  const { perfil, recarregar } = useSessao()
  const [menuAberto, setMenuAberto] = useState(false)

  async function encerrar() {
    await sair()
    await recarregar()
    navegar('/admin/entrar', { replace: true })
  }

  return (
    <div className="plataforma flex min-h-screen flex-col md:flex-row">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r-2 bg-card px-4 py-6 md:flex">
        <Link to="/" className="px-3 font-mono text-lg font-bold tracking-[-0.02em]">
          Vitor Ramos
        </Link>
        <Navegacao />
        <div className="mt-auto flex flex-col gap-2 px-3 pt-4">
          {perfil && <p className="truncate text-xs text-muted-foreground">{perfil.email}</p>}
          <Button size="sm" variant="outline" onClick={() => void encerrar()}>
            <LogOutIcon aria-hidden="true" />
            Sair
          </Button>
        </div>
      </aside>

      <header className="flex items-center justify-between border-b-2 px-4 py-3 md:hidden">
        <Link to="/" className="font-mono text-lg font-bold">
          Vitor Ramos
        </Link>
        <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" aria-label="Abrir menu">
              <MenuIcon />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="plataforma w-[280px] overflow-y-auto border-r-2">
            <SheetHeader>
              <SheetTitle className="font-mono font-bold">Painel do professor</SheetTitle>
              <SheetDescription className="sr-only">Navegação do painel</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-6 px-4 pb-6">
              <Navegacao aoNavegar={() => setMenuAberto(false)} />
              <Button size="sm" variant="outline" onClick={() => void encerrar()}>
                Sair
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <main className="min-w-0 flex-1 px-4 py-8 md:px-10 md:py-10">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
