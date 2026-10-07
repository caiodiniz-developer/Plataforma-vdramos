import { useRef } from 'react'
import { gsap, ScrollTrigger, useMovimento } from '@/lib/movimento'

const ITENS = [
  { texto: 'Dados', cor: 'bg-primary' },
  { texto: 'Inteligência artificial', cor: 'bg-orange' },
  { texto: 'Educação', cor: 'bg-violet' },
  { texto: 'Produto', cor: 'bg-green' },
  { texto: 'Engenharia', cor: 'bg-neutro' },
  { texto: 'Letramento em dados', cor: 'bg-primary' },
  { texto: 'Rigor técnico', cor: 'bg-orange' },
  { texto: 'Clareza didática', cor: 'bg-violet' },
]

function Sequencia() {
  return (
    <ul className="flex shrink-0 items-center gap-[0.5em] pr-[0.5em]">
      {ITENS.map((item) => (
        <li key={item.texto} className="flex items-center gap-[0.5em] whitespace-nowrap">
          <span>{item.texto}</span>
          <span className={`size-[0.28em] ${item.cor}`} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Faixa em Tinta com os temas em letra grande. Decorativa (`aria-hidden`): os
 * mesmos temas aparecem como lista no hero.
 *
 * Movimento: rola sozinha em velocidade constante e reage à rolagem da página
 * — acelera com a velocidade do scroll e inverte o sentido quando a pessoa
 * rola para cima. Fica parada fora da tela e com `prefers-reduced-motion`.
 */
export function FaixaDeTemas() {
  const raiz = useRef<HTMLDivElement>(null)

  useMovimento(raiz, (_condicoes, q) => {
    const laco = gsap.to(q('[data-trilho]'), { xPercent: -50, ease: 'none', duration: 38, repeat: -1 })
    // Começa longe do zero para poder andar para trás sem bater no início.
    laco.totalTime(laco.duration() * 50)

    ScrollTrigger.create({
      trigger: raiz.current,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => laco.paused(!self.isActive),
      onUpdate: (self) => {
        const velocidade = self.getVelocity()
        const sentido = velocidade < 0 ? -1 : 1
        const impulso = Math.min(7, Math.abs(velocidade) / 220)
        gsap.to(laco, {
          timeScale: sentido * (1 + impulso),
          duration: 0.25,
          overwrite: true,
          onComplete: () => gsap.to(laco, { timeScale: sentido, duration: 0.9, overwrite: true }),
        })
      },
    })
  })

  return (
    <div
      ref={raiz}
      aria-hidden="true"
      className="overflow-hidden border-b-2 bg-secondary py-5 font-mono text-[clamp(44px,8.5vw,136px)] leading-none font-bold text-secondary-foreground md:py-8"
    >
      <div data-trilho className="flex w-max">
        <Sequencia />
        <Sequencia />
      </div>
    </div>
  )
}
