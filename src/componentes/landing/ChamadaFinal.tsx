import { ArrowRightIcon } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { gsap, RECORTE_ABERTO, SplitText, useMovimento } from '@/lib/movimento'

/**
 * Chamada final de tela cheia em azul. Texto branco sobre o azul (4,55:1);
 * botões em Tinta e em contorno branco.
 *
 * Movimento: o painel azul abre por recorte enquanto entra na tela (preso ao
 * scroll) e as palavras do título sobem de dentro da linha.
 */
export function ChamadaFinal() {
  const raiz = useRef<HTMLElement>(null)

  useMovimento(raiz, (_condicoes, q) => {
    gsap.fromTo(
      raiz.current,
      { clipPath: 'inset(0% 7% 0% 7%)' },
      {
        clipPath: RECORTE_ABERTO,
        ease: 'none',
        scrollTrigger: { trigger: raiz.current, start: 'top bottom', end: 'top 15%', scrub: true },
      },
    )

    const palavras = SplitText.create(q('h2'), { type: 'words', mask: 'words' })
    gsap
      .timeline({ scrollTrigger: { trigger: q('h2'), start: 'top 80%', once: true } })
      .from(q('[data-regua]'), { scaleX: 0, duration: 1.2, ease: 'circ.out' }, 0)
      .from(palavras.words, { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.06 }, 0)
      .from(q('[data-apoio]'), { y: 28, autoAlpha: 0, duration: 0.8, ease: 'power2.out', stagger: 0.08 }, 0.5)
  })

  return (
    <section ref={raiz} className="bg-primary text-primary-foreground">
      <div className="conteiner-landing flex min-h-svh flex-col justify-between gap-14 py-20 md:py-28">
        <div className="flex items-center gap-4">
          <p className="eyebrow shrink-0">Próximo passo</p>
          <span aria-hidden="true" data-regua className="h-0.5 flex-1 origin-left bg-current" />
        </div>

        <h2 className="max-w-[18ch] text-[clamp(40px,8.4vw,152px)] leading-none">
          Dados e IA com rigor técnico e clareza didática.
        </h2>

        <div className="grid items-end gap-8 md:grid-cols-12">
          <p data-apoio className="max-w-[30ch] text-xl md:col-span-6 md:text-2xl">
            Conte o que sua equipe precisa: uma palestra, um treinamento ou um projeto.
          </p>
          <div className="flex flex-wrap gap-3 md:col-span-6 md:justify-end">
            <Button
              asChild
              size="lg"
              variant="secondary"
              data-apoio
              className="border-tinta bg-tinta text-papel hover:border-papel hover:bg-papel hover:text-tinta"
            >
              <a href="#contato">
                Enviar mensagem
                <ArrowRightIcon aria-hidden="true" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              data-apoio
              className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
            >
              <Link to="/aluno/entrar">Sou aluno</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
