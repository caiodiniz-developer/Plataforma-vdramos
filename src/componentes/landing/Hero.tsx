import { ArrowDownIcon, ArrowUpRightIcon } from 'lucide-react'
import { Fragment, useRef, type CSSProperties } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RETRATO } from '@/conteudo/galeria'
import { urlDaFoto, type PerfilPublico } from '@/dados/landing'
import { gsap, RECORTE_ABERTO, SplitText, useMovimento } from '@/lib/movimento'
import { escalaDoNome } from './escalaDoNome'

type Props = { perfil: PerfilPublico }

/** Temas do guia de marca, cada um com a cor do seu marcador. */
const TEMAS = [
  { nome: 'Dados', cor: 'bg-primary' },
  { nome: 'IA', cor: 'bg-orange' },
  { nome: 'Educação', cor: 'bg-violet' },
  { nome: 'Produto', cor: 'bg-green' },
  { nome: 'Engenharia', cor: 'bg-tinta' },
]

const CORES_DA_FAIXA = ['bg-primary', 'bg-orange', 'bg-violet', 'bg-green']

/**
 * Hero: o nome ocupa a largura da página em Ubuntu Mono; abaixo, a faixa das
 * quatro cores, a bio, os botões, os temas e o retrato.
 *
 * Movimento (só com `prefers-reduced-motion: no-preference`): as letras do
 * nome sobem em sequência, a faixa e a régua se desenham, o retrato abre por
 * recorte e, ao rolar, o nome e o retrato deslizam em velocidades diferentes.
 */
export function Hero({ perfil }: Props) {
  const raiz = useRef<HTMLElement>(null)
  const foto = urlDaFoto(perfil.foto_path)
  const retrato = foto ?? RETRATO.arquivo
  const ehExemplo = !foto && RETRATO.exemplo
  const escala = escalaDoNome(perfil.nome_exibicao)

  useMovimento(raiz, ({ desktop }, q) => {
    const nome = SplitText.create(q('h1'), { type: 'chars', mask: 'chars' })

    gsap
      .timeline({ defaults: { ease: 'expo.out' } })
      .from(q('[data-regua]'), { scaleX: 0, duration: 1.2, ease: 'circ.out' }, 0)
      .from(q('[data-topo]'), { y: 16, opacity: 0, duration: 0.8, stagger: 0.08 }, 0.05)
      .from(nome.chars, { yPercent: 110, duration: 1.2, stagger: 0.035 }, 0.1)
      .from(q('[data-cor]'), { scaleX: 0, duration: 0.9, ease: 'circ.out', stagger: 0.09 }, 0.55)
      .from(q('[data-bio]'), { clipPath: 'inset(0% 0% 100% 0%)', y: 28, duration: 1.1 }, 0.7)
      .from(q('[data-entra]'), { y: 24, opacity: 0, duration: 0.8, stagger: 0.06 }, 0.85)
      .fromTo(
        q('[data-moldura]'),
        { clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: RECORTE_ABERTO, duration: 1.3, ease: 'power3.inOut' },
        0.5,
      )
      .from(q('[data-retrato]'), { scale: 1.25, duration: 1.6, ease: 'power2.out' }, 0.5)

    // Saída pelo scroll: o tempo é de quem rola, então sem curva temporal.
    const rolagem = { trigger: raiz.current, start: 'top top', end: 'bottom top', scrub: true }
    gsap.to(q('[data-grade]'), { yPercent: 12, ease: 'none', scrollTrigger: rolagem })
    if (desktop) {
      gsap.to(q('h1'), { xPercent: -5, ease: 'none', scrollTrigger: rolagem })
      gsap.to(q('[data-figura]'), { yPercent: -14, ease: 'none', scrollTrigger: rolagem })
    }
  })

  const colunas = {
    '--colunas-linha': escala.colunasEmLinha,
    '--colunas-pilha': escala.colunasEmpilhado,
  } as CSSProperties

  return (
    <section ref={raiz} className="relative overflow-x-clip overflow-y-clip border-b-2">
      {/* Grade técnica de fundo, só decorativa. */}
      <div aria-hidden="true" data-grade className="grade-tecnica pointer-events-none absolute inset-x-0 inset-y-[-12%]" />

      <div className="conteiner-landing relative flex flex-col pt-6 pb-12 md:pt-8 md:pb-16 lg:min-h-[calc(100svh-4rem)]">
        <div className="flex items-center gap-4">
          <p data-topo className="eyebrow shrink-0 text-muted-foreground">
            {perfil.titulo}
            {perfil.cidade && <span> · {perfil.cidade}</span>}
          </p>
          <span aria-hidden="true" data-regua className="h-0.5 flex-1 origin-left bg-foreground" />
          <a
            data-topo
            href="#frentes"
            className="eyebrow hidden min-h-11 shrink-0 items-center gap-2 text-muted-foreground hover:text-foreground sm:flex"
          >
            Role para conhecer
            <ArrowDownIcon aria-hidden="true" className="size-4" />
          </a>
        </div>

        <h1 className="nome-gigante mt-8 lg:mt-auto lg:pt-10" style={colunas}>
          {escala.palavras.map((palavra, i) => (
            <Fragment key={i}>
              {i > 0 && ' '}
              <span className="block md:inline">{palavra}</span>
            </Fragment>
          ))}
        </h1>

        {/* Faixa das quatro cores da marca, como no cartão do guia. */}
        <div aria-hidden="true" className="mt-4 flex h-2 md:mt-6 md:h-3">
          {CORES_DA_FAIXA.map((cor) => (
            <div key={cor} data-cor className={`flex-1 origin-left ${cor}`} />
          ))}
        </div>

        <div className="mt-8 grid gap-10 md:mt-12 lg:grid-cols-12 lg:gap-6">
          <div className="flex flex-col gap-8 lg:col-span-6">
            <p data-bio className="max-w-[34ch] text-xl leading-[1.35] md:text-2xl xl:text-[28px]">
              {perfil.bio}
            </p>
            <div className="flex flex-wrap gap-3.5">
              {perfil.linkedin_url && (
                <Button asChild size="lg" data-entra>
                  <a href={perfil.linkedin_url} target="_blank" rel="noopener noreferrer">
                    LinkedIn
                    <ArrowUpRightIcon aria-hidden="true" />
                    <span className="sr-only">(abre em nova aba)</span>
                  </a>
                </Button>
              )}
              <Button asChild size="lg" variant="outline" data-entra>
                <a href="#contato">Contato</a>
              </Button>
            </div>
          </div>

          <ul aria-label="Temas" className="flex flex-col self-end border-t-2 border-divisor lg:col-span-3 lg:col-start-7">
            {TEMAS.map((tema, i) => (
              <li
                key={tema.nome}
                data-entra
                className="flex items-center gap-3 border-b-2 border-divisor py-2.5 font-mono text-lg font-bold"
              >
                <span aria-hidden="true" className={`size-3 shrink-0 ${tema.cor}`} />
                {tema.nome}
                <span aria-hidden="true" className="ml-auto text-xs font-normal text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </li>
            ))}
          </ul>

          <figure data-figura className="relative w-full max-w-[320px] self-end lg:col-span-3 lg:max-w-none">
            <div data-moldura className="relative overflow-hidden border-2 bg-secondary">
              <img
                data-retrato
                src={retrato}
                alt={foto ? `Foto de ${perfil.nome_exibicao}` : RETRATO.alt}
                width={900}
                height={1100}
                className="aspect-9/11 w-full object-cover"
              />
              {ehExemplo && (
                <Badge variant="neutro" className="absolute right-3 bottom-3">
                  Foto de exemplo
                </Badge>
              )}
            </div>
          </figure>
        </div>
      </div>
    </section>
  )
}
