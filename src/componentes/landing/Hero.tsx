import { ArrowUpRightIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { urlDaFoto, type PerfilPublico } from '@/dados/landing'

type Props = { perfil: PerfilPublico }

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

/** Faixa das quatro cores da marca, como no cartão do guia. */
function FaixaDeAcentos() {
  return (
    <div aria-hidden="true" className="flex h-1.5">
      <div className="flex-1 bg-primary" />
      <div className="flex-1 bg-orange" />
      <div className="flex-1 bg-violet" />
      <div className="flex-1 bg-green" />
    </div>
  )
}

export function Hero({ perfil }: Props) {
  const foto = urlDaFoto(perfil.foto_path)

  return (
    <section className="mx-auto grid w-full max-w-[1080px] items-center gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr] md:px-10 md:py-20">
      <div className="flex flex-col gap-6">
        <p className="eyebrow text-muted-foreground">{perfil.titulo}</p>
        <h1 className="text-[36px] md:text-[56px]">{perfil.nome_exibicao}</h1>
        <p className="max-w-[520px] text-base md:text-lg">{perfil.bio}</p>
        {perfil.cidade && <p className="text-[13px] text-muted-foreground">{perfil.cidade}</p>}
        <div className="flex flex-wrap gap-3.5">
          {perfil.linkedin_url && (
            <Button asChild>
              <a href={perfil.linkedin_url} target="_blank" rel="noopener noreferrer">
                LinkedIn
                <ArrowUpRightIcon aria-hidden="true" />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            </Button>
          )}
          <Button asChild variant="outline">
            <a href="#contato">Contato</a>
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-md border-2 md:mx-0 md:justify-self-end">
        <Avatar className="aspect-square h-auto w-full rounded-none">
          {foto && <AvatarImage src={foto} alt={`Foto de ${perfil.nome_exibicao}`} className="object-cover" />}
          <AvatarFallback className="rounded-none bg-secondary font-mono text-[56px] font-bold text-secondary-foreground">
            {iniciais(perfil.nome_exibicao)}
          </AvatarFallback>
        </Avatar>
        <FaixaDeAcentos />
      </div>
    </section>
  )
}
