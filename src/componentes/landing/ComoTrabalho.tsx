import { ArrowUpRightIcon } from 'lucide-react'
import { useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RETRATO_SOBRE } from '@/conteudo/galeria'
import { COMO_TRABALHO, GITHUB_URL, PERFIL_EM_T, PROPOSTA_DE_VALOR, STACK } from '@/conteudo/marca'
import { deBloco, deMascara, deRegua, gsap, RECORTE_ABERTO, SplitText, useMovimento } from '@/lib/movimento'

/**
 * "Como trabalho": a proposta de valor, os três princípios, o perfil em T e a
 * stack em destaque. O conteúdo vem de `src/conteudo/marca.ts`.
 *
 * Movimento: as palavras da proposta sobem de dentro da linha, as réguas se
 * desenham, a foto abre por recorte e assenta com zoom, e a haste do T cresce
 * de cima para baixo.
 */
export function ComoTrabalho() {
  const raiz = useRef<HTMLDivElement>(null)

  useMovimento(raiz, (_condicoes, q) => {
    // É um parágrafo, que não aceita `aria-label`: o texto fica nas próprias
    // palavras e o leitor de tela lê a frase normalmente.
    const palavras = SplitText.create(q('[data-proposta]'), { type: 'words', mask: 'words', aria: 'none' })
    gsap
      .timeline({ scrollTrigger: { trigger: raiz.current, start: 'top 80%' } })
      .from(palavras.words, { ...deMascara(), stagger: 0.05 }, 0)
      .fromTo(
        q('[data-moldura]'),
        { clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: RECORTE_ABERTO, duration: 1.3, ease: 'power3.inOut' },
        0.1,
      )
      .from(q('[data-imagem]'), { scale: 1.25, duration: 1.6, ease: 'power2.out' }, 0.1)

    q('[data-principio]').forEach((item) => {
      const dentro = (seletor: string) => Array.from(item.querySelectorAll<HTMLElement>(seletor))
      gsap
        .timeline({ scrollTrigger: { trigger: item, start: 'top 88%' } })
        .from(dentro('[data-regua]'), deRegua(), 0)
        .from(dentro('[data-conteudo]'), deBloco(28), 0.1)
    })

    gsap
      .timeline({ scrollTrigger: { trigger: q('[data-t]')[0], start: 'top 85%' } })
      .from(q('[data-t-barra]'), { scaleX: 0, duration: 0.9, ease: 'circ.out' }, 0)
      .from(q('[data-t-haste]'), { scaleY: 0, duration: 0.9, ease: 'circ.out' }, 0.35)
      .from(q('[data-t-texto]'), { ...deBloco(16), stagger: 0.06 }, 0.6)

    gsap
      .timeline({ scrollTrigger: { trigger: q('[data-stack]')[0], start: 'top 85%' } })
      .from(q('[data-stack] [data-regua]'), { ...deRegua(), stagger: 0.08 }, 0)
      .from(q('[data-grupo]'), { ...deBloco(24), stagger: 0.08 }, 0.1)
  })

  return (
    <div ref={raiz} className="flex flex-col gap-(--espaco-bloco)">
      <div className="grid gap-(--espaco-item) lg:grid-cols-12 lg:gap-x-6">
        <div className="flex flex-col gap-(--espaco-item) lg:col-span-7">
          <p data-proposta className="font-mono text-[clamp(30px,3.9vw,64px)] leading-[1.05] font-bold tracking-[-0.02em]">
            {PROPOSTA_DE_VALOR}
          </p>

          <ol>
            {COMO_TRABALHO.map((principio, i) => (
              <li key={principio.titulo} data-principio>
                <span aria-hidden="true" data-regua className="block h-0.5 origin-left bg-foreground" />
                <div data-conteudo className="grid gap-x-6 gap-y-3 py-(--espaco-miolo) md:grid-cols-7">
                  <p aria-hidden="true" className="font-mono text-sm text-muted-foreground md:col-span-1 md:pt-1.5">
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <div className="flex flex-col gap-3 md:col-span-6">
                    <h3 className="text-[clamp(22px,2.2vw,32px)] leading-[1.1]">{principio.titulo}</h3>
                    <p className="max-w-[56ch] text-[17px] leading-[1.6] text-muted-foreground">{principio.texto}</p>
                  </div>
                </div>
              </li>
            ))}
            <li aria-hidden="true" className="h-0.5 bg-foreground" />
          </ol>
        </div>

        <div className="flex flex-col gap-(--espaco-item) lg:col-span-4 lg:col-start-9">
          <figure className="w-full max-w-[360px] lg:max-w-none">
            <div data-moldura className="overflow-hidden border-2 bg-secondary">
              <img
                data-imagem
                src={RETRATO_SOBRE.arquivo}
                alt={RETRATO_SOBRE.alt}
                width={400}
                height={400}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover"
              />
            </div>
          </figure>

          {/* Perfil em T: a barra é a visão ampla; a haste, a especialidade. */}
          <div data-t className="flex flex-col">
            <p data-t-texto className="eyebrow mb-4 text-muted-foreground">
              Perfil em T
            </p>
            <ul data-t-barra className="grid origin-left grid-cols-3 bg-secondary text-secondary-foreground">
              {PERFIL_EM_T.amplitude.map((area) => (
                <li key={area} className="eyebrow px-2 py-4 text-center text-[10px] sm:text-[11px]">
                  {area}
                </li>
              ))}
            </ul>
            <p
              data-t-haste
              className="mx-auto flex min-h-36 w-1/3 origin-top items-center justify-center bg-primary px-2 py-6 text-center font-mono text-lg leading-tight font-bold text-primary-foreground"
            >
              {PERFIL_EM_T.profundidade}
            </p>
            <p data-t-texto className="mt-4 text-sm leading-normal text-muted-foreground">
              Visão ampla de negócios, liderança e educação, com profundidade em engenharia de dados.
            </p>
          </div>
        </div>
      </div>

      <div data-stack className="flex flex-col gap-(--espaco-miolo)">
        <h3 className="text-[clamp(24px,2.8vw,44px)] leading-[1.05]">Stack em destaque</h3>
        <ul className="grid gap-x-6 gap-y-(--espaco-miolo) sm:grid-cols-2 lg:grid-cols-4">
          {STACK.map((grupo) => (
            <li key={grupo.titulo} className="flex flex-col gap-4">
              <span aria-hidden="true" data-regua className="block h-0.5 origin-left bg-foreground" />
              <div data-grupo className="flex flex-col gap-4">
                <h4 className="eyebrow font-sans text-muted-foreground">{grupo.titulo}</h4>
                <ul className="flex flex-wrap gap-2.5" aria-label={grupo.titulo}>
                  {grupo.itens.map((item) => (
                    <li key={item}>
                      <Badge variant="outline">{item}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
        <div>
          <Button asChild variant="outline" data-cursor="Abrir" className="varredura hover:bg-transparent!">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              Projetos e histórico no GitHub
              <ArrowUpRightIcon aria-hidden="true" />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
