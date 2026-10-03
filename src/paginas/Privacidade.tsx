import { Link } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Markdown } from '@/componentes/Markdown'
import { Rodape } from '@/componentes/Rodape'
import { DATA_DA_POLITICA, POLITICA_DE_PRIVACIDADE } from '@/conteudo/privacidade'
import { VERSAO_TERMO_VIGENTE } from '@/dominio/consentimento'
import { formatarData } from '@/dominio/tempo'

/** PRD, seção 5: texto longo em markdown, com versão e data no topo. */
export default function Privacidade() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-2">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between px-4 py-3 md:px-10">
          <Link to="/" className="font-mono text-lg font-bold tracking-[-0.02em]">
            Vitor Ramos
          </Link>
          <Link to="/" className="eyebrow text-muted-foreground hover:text-foreground">
            Voltar ao início
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[820px] px-4 py-12 md:px-10 md:py-16">
        <p className="eyebrow text-muted-foreground">
          Versão {VERSAO_TERMO_VIGENTE} · {formatarData(DATA_DA_POLITICA)}
        </p>
        <h1 className="mt-4 text-[36px] md:text-[56px]">Privacidade e termo de uso</h1>
        <Separator className="my-8 h-0.5 bg-border" />
        <Card>
          <CardContent>
            <Markdown>{POLITICA_DE_PRIVACIDADE}</Markdown>
          </CardContent>
        </Card>
      </main>
      <Rodape />
    </div>
  )
}
