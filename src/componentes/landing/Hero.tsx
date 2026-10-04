import { ArrowDownIcon, ArrowUpRightIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RETRATO } from '@/conteudo/galeria'
import { urlDaFoto, type PerfilPublico } from '@/dados/landing'
import { varianteDaTag } from '@/dominio/experiencia'
import { TemaDigitado } from './TemaDigitado'

type Props = { perfil: PerfilPublico }

const TEMAS = ['Dados', 'IA', 'Educação', 'Produto', 'Engenharia']

/** Faixa das quatro cores da marca, como no cartão do guia. Cresce ao entrar. */
function FaixaDeAcentos() {
  return (
    <div aria-hidden="true" className="flex h-2">
      {['bg-primary', 'bg-orange', 'bg-violet', 'bg-green'].map((cor, i) => (
        <div key={cor} className={`animar-crescer-x flex-1 ${cor}`} style={{ animationDelay: `${600 + i * 120}ms` }} />
      ))}
    </div>
  )
}

/** Título com cada palavra subindo em sequência. */
function TituloAnimado({ texto }: { texto: string }) {
  return (
    <h1 className="text-[44px] leading-[1.02] sm:text-[56px] lg:text-[72px]" aria-label={texto}>
      {texto.split(' ').map((palavra, i) => (
        <span key={i} aria-hidden="true" className="inline-block overflow-hidden pr-[0.25em] align-bottom">
          <span className="animar-subir inline-block" style={{ animationDelay: `${150 + i * 110}ms` }}>
            {palavra}
          </span>
        </span>
      ))}
    </h1>
  )
}

export function Hero({ perfil }: Props) {
  const foto = urlDaFoto(perfil.foto_path)
  const retrato = foto ?? RETRATO.arquivo
  const ehExemplo = !foto && RETRATO.exemplo

  return (
    <section className="relative overflow-hidden border-b-2">
      {/* Grade técnica de fundo, só decorativa. */}
      <div aria-hidden="true" className="grade-tecnica animar-aparecer pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid w-full max-w-[1080px] items-center gap-12 px-4 py-14 md:grid-cols-[1.35fr_1fr] md:px-10 md:py-24">
        <div className="flex flex-col gap-7">
          <div className="animar-subir flex flex-wrap items-center gap-3">
            <p className="eyebrow text-muted-foreground">{perfil.titulo}</p>
            {perfil.cidade && <span className="eyebrow text-muted-foreground">· {perfil.cidade}</span>}
          </div>

          <TituloAnimado texto={perfil.nome_exibicao} />

          <p className="animar-subir max-w-[540px] text-lg md:text-xl" style={{ animationDelay: '450ms' }}>
            {perfil.bio}
          </p>

          <div className="animar-subir" style={{ animationDelay: '550ms' }}>
            <TemaDigitado temas={TEMAS} />
          </div>

          <div className="animar-subir flex flex-wrap gap-3.5" style={{ animationDelay: '650ms' }}>
            {perfil.linkedin_url && (
              <Button asChild size="lg">
                <a href={perfil.linkedin_url} target="_blank" rel="noopener noreferrer">
                  LinkedIn
                  <ArrowUpRightIcon aria-hidden="true" />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              </Button>
            )}
            <Button asChild size="lg" variant="outline">
              <a href="#contato">Contato</a>
            </Button>
          </div>

          <ul className="animar-subir flex flex-wrap gap-2.5" aria-label="Temas" style={{ animationDelay: '750ms' }}>
            {TEMAS.map((tema) => (
              <li key={tema}>
                <Badge variant={varianteDaTag(tema)}>{tema}</Badge>
              </li>
            ))}
          </ul>
        </div>

        <figure className="animar-subir relative mx-auto w-full max-w-[360px] md:mx-0 md:justify-self-end" style={{ animationDelay: '300ms' }}>
          <div className="overflow-hidden border-2 bg-secondary">
            <img
              src={retrato}
              alt={foto ? `Foto de ${perfil.nome_exibicao}` : RETRATO.alt}
              width={900}
              height={1100}
              className="aspect-[9/11] w-full object-cover"
            />
            <FaixaDeAcentos />
          </div>
          <figcaption className="mt-3 flex items-center justify-between gap-3 font-mono text-xs text-muted-foreground">
            <span>vitorramos.com</span>
            {ehExemplo && <Badge variant="neutro">Foto de exemplo</Badge>}
          </figcaption>
        </figure>
      </div>

      <a
        href="#frentes"
        className="relative mx-auto mb-8 hidden w-fit items-center gap-2 eyebrow text-muted-foreground hover:text-foreground md:flex"
      >
        <ArrowDownIcon aria-hidden="true" className="size-4 animate-bounce" />
        Role para conhecer
      </a>
    </section>
  )
}
