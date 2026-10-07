import {
  BarChart3Icon,
  BookOpenIcon,
  GraduationCapIcon,
  HouseIcon,
  InboxIcon,
  LayoutTemplateIcon,
  LogOutIcon,
  MenuIcon,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useSessao } from '@/contextos/Sessao'
import { sair } from '@/dados/sessao'
import { cn } from '@/lib/utils'

type Item = { rotulo: string; para: string; icone: LucideIcon; pronto: boolean }

/** Seções do admin (PRD, seção 5). As marcadas como não prontas aparecem desabilitadas. */
const ITENS: Item[] = [
  { rotulo: 'Painel', para: '/admin', icone: HouseIcon, pronto: true },
  { rotulo: 'Landing', para: '/admin/landing', icone: LayoutTemplateIcon, pronto: false },
  { rotulo: 'Mensagens de contato', para: '/admin/mensagens', icone: InboxIcon, pronto: true },
  { rotulo: 'Cursos', para: '/admin/cursos', icone: BookOpenIcon, pronto: false },
  { rotulo: 'Turmas', para: '/admin/turmas', icone: GraduationCapIcon, pronto: false },
  { rotulo: 'Relatórios', para: '/admin/relatorios', icone: BarChart3Icon, pronto: false },
]

function Navegacao({ aoNavegar }: { aoNavegar?: () => void }) {
  return (
    <nav aria-label="Painel do professor" className="flex flex-col gap-1">
      {ITENS.map((item) =>
        item.pronto ? (
          <NavLink
            key={item.para}
            to={item.para}
            end={item.para === '/admin'}
            onClick={aoNavegar}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 border-2 border-transparent px-3 py-2.5 text-sm font-bold',
                isActive ? 'border-foreground bg-secondary text-secondary-foreground' : 'hover:bg-accent',
              )
            }
          >
            <item.icone aria-hidden="true" className="size-4" />
            {item.rotulo}
          </NavLink>
        ) : (
          <span
            key={item.para}
            aria-disabled="true"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground"
          >
            <item.icone aria-hidden="true" className="size-4" />
            {item.rotulo}
            <span className="eyebrow ml-auto text-[9px]">Em breve</span>
          </span>
        ),
      )}
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
      <aside className="hidden w-64 shrink-0 flex-col gap-8 border-r-2 bg-card px-4 py-6 md:flex">
        <Link to="/" className="px-3 font-mono text-lg font-bold tracking-[-0.02em]">
          Vitor Ramos
        </Link>
        <Navegacao />
        <div className="mt-auto flex flex-col gap-2 px-3">
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
          <SheetContent side="left" className="w-[280px] border-r-2">
            <SheetHeader>
              <SheetTitle className="font-mono font-bold">Painel do professor</SheetTitle>
              <SheetDescription className="sr-only">Navegação do painel</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-6 px-4">
              <Navegacao aoNavegar={() => setMenuAberto(false)} />
              <Button size="sm" variant="outline" onClick={() => void encerrar()}>
                Sair
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <main className="flex-1 px-4 py-8 md:px-10 md:py-10">
        <Outlet />
      </main>
    </div>
  )
}
