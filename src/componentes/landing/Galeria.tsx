import { useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import type { Foto } from '@/conteudo/galeria'
import { deBloco, deRegua, embaralhar, gsap, RECORTE_ABERTO, ScrollTrigger, useMovimento } from '@/lib/movimento'

/**
 * Posição de cada foto na grade de 12 colunas (desktop). O padrão se repete a
 * cada cinco fotos: larguras e alturas desencontradas, com respiro entre elas.
 */
const POSICOES = [
  'md:col-span-7',
  'md:col-span-4 md:col-start-9 md:mt-[22vw]',
  'md:col-span-5 md:col-start-2',
  'md:col-span-5 md:col-start-8 md:mt-[16vw]',
  'md:col-span-8 md:col-start-3',
]

/** Deslocamento de parallax de cada posição, em px (0 = acompanha a página). */
const PARALLAX = [0, -110, -50, -140, 0]

/**
 * Galeria editorial. As fotos vêm de `src/conteudo/galeria.ts`; enquanto forem
 * ilustrações provisórias, aparecem com a etiqueta "Foto de exemplo".
 *
 * Movimento: a moldura abre por recorte enquanto a imagem assenta com zoom, a
 * legenda entra em seguida, as molduras inclinam de leve com a velocidade da
 * rolagem e, em telas largas, as colunas deslizam em velocidades diferentes.
 * No hover (CSS): a faixa azul da base recua, a legenda desliza.
 */
export function Galeria({ fotos }: { fotos: Foto[] }) {
  const raiz = useRef<HTMLUListElement>(null)

  useMovimento(raiz, (c, q) => {
    q('[data-foto]').forEach((item, i) => {
      const dentro = (seletor: string) => Array.from(item.querySelectorAll<HTMLElement>(seletor))
      const linha = gsap
        .timeline({ scrollTrigger: { trigger: item, start: 'top 85%' } })
        .fromTo(
          dentro('[data-moldura]'),
          { clipPath: 'inset(100% 0% 0% 0%)' },
          { clipPath: RECORTE_ABERTO, duration: 1.3, ease: 'power3.inOut' },
          0,
        )
        .from(dentro('[data-regua]'), deRegua(), 0.5)
        .from(dentro('figcaption'), deBloco(16), 0.6)
      dentro('[data-embaralha]').forEach((alvo) => linha.add(embaralhar(alvo), 0.6))

      linha.from(dentro('[data-imagem]'), { scale: 1.3, duration: 1.6, ease: 'power2.out' }, 0)

      const deslocamento = PARALLAX[i % PARALLAX.length]
      if (c.desktop && deslocamento !== 0) {
        gsap.to(dentro('figure'), {
          y: deslocamento,
          ease: 'none',
          scrollTrigger: { trigger: item, start: 'top bottom', end: 'bottom top', scrub: true },
        })
      }
    })

    // Inclinação leve conforme a velocidade da rolagem; volta a zero quando ela para.
    const inclinar = gsap.quickTo(q('[data-inclina]'), 'skewY', { duration: 0.6, ease: 'power3.out' })
    ScrollTrigger.create({
      trigger: raiz.current,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => inclinar(gsap.utils.clamp(-3, 3, self.getVelocity() / -700)),
      onLeave: () => inclinar(0),
      onLeaveBack: () => inclinar(0),
    })
    const assentar = () => inclinar(0)
    ScrollTrigger.addEventListener('scrollEnd', assentar)
    return () => ScrollTrigger.removeEventListener('scrollEnd', assentar)
  })

  if (fotos.length === 0) return null

  return (
    <ul ref={raiz} className="grid gap-x-6 gap-y-(--espaco-bloco) md:grid-cols-12">
      {fotos.map((foto, i) => (
        <li key={foto.arquivo} data-foto className={POSICOES[i % POSICOES.length]}>
          <figure data-cursor="Ver" className="group">
            <div data-inclina>
              <div data-moldura className="relative overflow-hidden border-2 bg-secondary">
                {/* O zoom do hover fica no invólucro: a imagem em si é animada pelo GSAP. */}
                <span className="block transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.1,1)] group-hover:scale-[1.05]">
                <img
                  data-imagem
                  src={foto.arquivo}
                  alt={foto.alt}
                  loading="lazy"
                  width={1200}
                  height={900}
                  className="aspect-4/3 w-full object-cover"
                />
                </span>
                {/* Faixa azul na base da foto: recua no hover. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-2 origin-bottom bg-primary transition-transform duration-500 ease-[cubic-bezier(0.7,0,0.2,1)] group-hover:scale-y-0"
                />
                {foto.exemplo && (
                  <Badge variant="neutro" className="absolute right-3 bottom-5">
                    Foto de exemplo
                  </Badge>
                )}
              </div>
            </div>
            <figcaption className="flex items-baseline justify-between gap-4 pt-5 pb-4">
              <span className="font-mono text-xl font-bold transition-transform duration-500 ease-[cubic-bezier(0.2,0.7,0.1,1)] group-hover:translate-x-3 md:text-2xl">
                {foto.legenda}
              </span>
              <span aria-hidden="true" data-embaralha className="font-mono text-sm text-muted-foreground">
                {String(i + 1).padStart(2, '0')} / {String(fotos.length).padStart(2, '0')}
              </span>
            </figcaption>
            <span aria-hidden="true" data-regua className="block h-0.5 origin-left bg-foreground" />
          </figure>
        </li>
      ))}
    </ul>
  )
}
