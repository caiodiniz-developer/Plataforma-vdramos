import { useRef } from 'react'
import { GRANDES_NUMEROS } from '@/conteudo/marca'
import { deBloco, deRegua, gsap, useMovimento } from '@/lib/movimento'
import { cn } from '@/lib/utils'
import { COR_DE_FUNDO } from './cores'

/**
 * Grandes números da carreira, para leitura rápida logo depois do hero. Os
 * valores vêm de `src/conteudo/marca.ts`.
 *
 * Movimento: a régua colorida de cada número se desenha, o bloco sobe e o
 * valor conta de zero até o número final. O número lido por leitor de tela
 * fica em um elemento estável; o que conta na tela é decorativo.
 */
export function GrandesNumeros() {
  const raiz = useRef<HTMLElement>(null)

  useMovimento(raiz, (_condicoes, q) => {
    const linha = gsap.timeline({ scrollTrigger: { trigger: raiz.current, start: 'top 78%' } })
    linha.from(q('[data-topo]'), deBloco(16), 0)

    const contadores = q('[data-numero]').map((item, i) => {
      const dentro = (seletor: string) => Array.from(item.querySelectorAll<HTMLElement>(seletor))
      const [alvo] = dentro('[data-conta]')
      const fim = Number(alvo?.dataset.valor ?? 0)
      const estado = { valor: 0 }
      const inicio = 0.1 + i * 0.09
      linha
        .from(dentro('[data-regua]'), deRegua(), inicio)
        .from(dentro('[data-bloco]'), { ...deBloco(28), stagger: 0.06 }, inicio)
        .to(
          estado,
          {
            valor: fim,
            duration: 1.4,
            ease: 'power2.out',
            onUpdate: () => {
              if (alvo) alvo.textContent = String(Math.round(estado.valor))
            },
          },
          inicio,
        )
      return { alvo, fim }
    })

    // O GSAP desfaz estilos, não textos: ao desmontar, o valor final volta.
    return () => {
      for (const { alvo, fim } of contadores) if (alvo) alvo.textContent = String(fim)
    }
  })

  return (
    <section ref={raiz} id="numeros" aria-labelledby="titulo-numeros" className="border-b-2 bg-background">
      <div className="conteiner-landing flex flex-col gap-(--espaco-item) py-(--espaco-bloco)">
        <h2 id="titulo-numeros" data-topo className="eyebrow font-sans text-muted-foreground">
          Em números
        </h2>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-(--espaco-item) lg:grid-cols-5">
          {GRANDES_NUMEROS.map((n, i) => {
            const escrito = `${n.prefixo ?? ''}${n.valor}${n.sufixo ?? ''}`
            return (
              <li
                key={n.rotulo}
                data-numero
                // Cinco itens em duas colunas: o último ocupa a linha inteira no celular.
                className={cn('flex flex-col gap-3', i === GRANDES_NUMEROS.length - 1 && 'col-span-2 lg:col-span-1')}
              >
                <span aria-hidden="true" data-regua className={cn('block h-1.5 origin-left', COR_DE_FUNDO[n.cor])} />
                <p data-bloco className="font-mono text-[clamp(56px,7.4vw,132px)] leading-none font-bold tracking-[-0.03em]">
                  <span className="sr-only">{escrito}</span>
                  <span aria-hidden="true">
                    {n.prefixo}
                    <span data-conta data-valor={n.valor}>
                      {n.valor}
                    </span>
                    {n.sufixo}
                  </span>
                </p>
                <p data-bloco className="eyebrow">
                  {n.rotulo}
                </p>
                <p data-bloco className="max-w-[32ch] text-sm leading-normal text-muted-foreground">
                  {n.detalhe}
                </p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
