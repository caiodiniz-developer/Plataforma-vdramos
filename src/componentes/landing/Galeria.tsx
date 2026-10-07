import { useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import type { Foto } from '@/conteudo/galeria'
import { gsap, RECORTE_ABERTO, useMovimento } from '@/lib/movimento'

/**
 * Posição de cada foto na grade de 12 colunas (desktop). O padrão se repete a
 * cada cinco fotos: larguras e alturas desencontradas, com respiro entre elas.
 */
const POSICOES = [
  'md:col-span-7',
  'md:col-span-4 md:col-start-9 md:mt-48',
  'md:col-span-5 md:col-start-2',
  'md:col-span-5 md:col-start-8 md:mt-40',
  'md:col-span-8 md:col-start-3',
]

/** Deslocamento de parallax de cada posição, em px (0 = acompanha a página). */
const PARALLAX = [0, -90, -40, -120, 0]

/**
 * Galeria editorial. As fotos vêm de `src/conteudo/galeria.ts`; enquanto forem
 * ilustrações provisórias, aparecem com a etiqueta "Foto de exemplo".
 *
 * Movimento: cada moldura abre por recorte (`clip-path`) de baixo para cima
 * enquanto a imagem assenta; no desktop, as colunas deslizam em velocidades
 * diferentes ao rolar.
 */
export function Galeria({ fotos }: { fotos: Foto[] }) {
  const raiz = useRef<HTMLUListElement>(null)

  useMovimento(raiz, ({ desktop }, q) => {
    q('[data-foto]').forEach((item, i) => {
      const dentro = (seletor: string) => Array.from(item.querySelectorAll<HTMLElement>(seletor))
      gsap
        .timeline({ scrollTrigger: { trigger: item, start: 'top 85%', once: true } })
        .fromTo(
          dentro('[data-moldura]'),
          { clipPath: 'inset(100% 0% 0% 0%)' },
          { clipPath: RECORTE_ABERTO, duration: 1.3, ease: 'power3.inOut' },
          0,
        )
        .from(dentro('[data-imagem]'), { scale: 1.3, duration: 1.6, ease: 'power2.out' }, 0)
        .from(dentro('[data-regua]'), { scaleX: 0, duration: 1.1, ease: 'circ.out' }, 0.5)
        .from(dentro('figcaption'), { y: 16, autoAlpha: 0, duration: 0.7, ease: 'power2.out' }, 0.6)

      const deslocamento = PARALLAX[i % PARALLAX.length]
      if (desktop && deslocamento !== 0) {
        gsap.to(dentro('figure'), {
          y: deslocamento,
          ease: 'none',
          scrollTrigger: { trigger: item, start: 'top bottom', end: 'bottom top', scrub: true },
        })
      }
    })
  })

  if (fotos.length === 0) return null

  return (
    <ul ref={raiz} className="grid gap-x-6 gap-y-14 md:grid-cols-12 md:gap-y-24">
      {fotos.map((foto, i) => (
        <li key={foto.arquivo} data-foto className={POSICOES[i % POSICOES.length]}>
          <figure>
            <div data-moldura className="relative overflow-hidden border-2 bg-secondary">
              <img
                data-imagem
                src={foto.arquivo}
                alt={foto.alt}
                loading="lazy"
                width={1200}
                height={900}
                className="aspect-4/3 w-full object-cover"
              />
              {foto.exemplo && (
                <Badge variant="neutro" className="absolute right-3 bottom-3">
                  Foto de exemplo
                </Badge>
              )}
            </div>
            <figcaption className="flex items-baseline justify-between gap-4 pt-4 pb-3">
              <span className="font-mono text-xl font-bold md:text-2xl">{foto.legenda}</span>
              <span aria-hidden="true" className="font-mono text-sm text-muted-foreground">
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
