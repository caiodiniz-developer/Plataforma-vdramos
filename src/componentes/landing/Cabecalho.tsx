import { MenuIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useSecaoAtiva } from '@/hooks/useSecaoAtiva'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

export type Ancora = { rotulo: string; href: string }

type Props = { ancoras: Ancora[] }

/** Header fixo da landing: wordmark, âncoras e acesso à área do aluno. */
export function Cabecalho({ ancoras }: Props) {
  const [menuAberto, setMenuAberto] = useState(false)
  const ativa = useSecaoAtiva(ancoras.map((a) => a.href.slice(1)))

  return (
    <header className="sticky top-0 z-20 border-b-2 bg-background">
      <div className="conteiner-landing flex h-16 items-center justify-between gap-4">
        <Link to="/" className="inline-flex min-h-11 items-center font-mono text-xl font-bold tracking-[-0.02em] whitespace-nowrap">
          Vitor Ramos
        </Link>

        <nav aria-label="Seções da página" className="hidden items-center gap-8 lg:flex">
          {ancoras.map((a) => {
            const atual = ativa === a.href.slice(1)
            return (
              <a
                key={a.rotulo}
                href={a.href}
                aria-current={atual ? 'true' : undefined}
                className={cn(
                  'eyebrow sublinhado-animado inline-flex min-h-11 items-center whitespace-nowrap transition-colors hover:text-foreground',
                  atual ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {a.rotulo}
              </a>
            )
          })}
          <Button asChild size="sm" variant="secondary">
            <Link to="/aluno/entrar">Área do aluno</Link>
          </Button>
        </nav>

        <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="lg:hidden" aria-label="Abrir menu">
              <MenuIcon />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] border-l-2">
            <SheetHeader>
              <SheetTitle className="font-mono text-lg font-bold">Vitor Ramos</SheetTitle>
              <SheetDescription className="sr-only">Navegação da página</SheetDescription>
            </SheetHeader>
            <nav aria-label="Seções da página" className="flex flex-col gap-1 px-4">
              {ancoras.map((a) => (
                <a
                  key={a.rotulo}
                  href={a.href}
                  onClick={() => setMenuAberto(false)}
                  className="eyebrow border-b border-divisor py-4"
                >
                  {a.rotulo}
                </a>
              ))}
              <Button asChild variant="secondary" className="mt-6">
                <Link to="/aluno/entrar">Área do aluno</Link>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
