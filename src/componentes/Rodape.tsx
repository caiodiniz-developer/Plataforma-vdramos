import { Link } from 'react-router'

const ANO = new Date().getFullYear()

/** Rodapé público: privacidade e acesso à área do aluno (PRD F1). */
export function Rodape() {
  return (
    <footer className="mt-auto border-t-2">
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4 px-4 py-8 font-mono text-xs text-muted-foreground md:px-10">
        <span>Vitor Ramos © {ANO}</span>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-6">
          <Link to="/privacidade" className="underline hover:text-foreground">
            Privacidade
          </Link>
          <Link to="/aluno/entrar" className="underline hover:text-foreground">
            Área do aluno
          </Link>
        </nav>
      </div>
    </footer>
  )
}
