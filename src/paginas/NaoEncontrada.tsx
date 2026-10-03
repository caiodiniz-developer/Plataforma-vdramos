import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Rodape } from '@/componentes/Rodape'

export default function NaoEncontrada() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col items-start justify-center gap-6 px-4 py-20 md:px-10">
        <p className="eyebrow text-muted-foreground">Erro 404</p>
        <h1 className="text-[36px] md:text-[56px]">Página não encontrada</h1>
        <p className="max-w-[520px]">O endereço pode ter mudado ou não existe mais.</p>
        <Button asChild variant="secondary">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </main>
      <Rodape />
    </div>
  )
}
