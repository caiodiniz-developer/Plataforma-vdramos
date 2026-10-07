import { ArrowRightIcon } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { magnetizar } from '@/lib/interacoes'
import { deBloco, deMascara, deRegua, gsap, RECORTE_ABERTO, SplitText, useMovimento } from '@/lib/movimento'

/**
 * Chamada final de tela cheia em azul. Texto branco sobre o azul (4,55:1);
 * botões em Tinta e em contorno branco.
 *
 * Movimento: o painel azul abre por recorte preso à rolagem (a troca Papel →
 * azul não é um corte seco), a régua se desenha, as palavras do título sobem
 * de dentro da linha e, com ponteiro fino, os botões são magnéticos.
 */
export function ChamadaFinal() {
  const raiz = useRef<HTMLElement>(null)

  useMovimento(raiz, (c, q) => {
    // Troca Papel → azul por recorte, presa à rolagem.
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
      .timeline({ scrollTrigger: { trigger: q('h2'), start: 'top 80%' } })
      .from(q('[data-regua]'), deRegua(), 0)
      .from(palavras.words, { ...deMascara(), stagger: 0.06 }, 0)
      .from(q('[data-apoio]'), { ...deBloco(28), stagger: 0.08 }, 0.5)

    if (c.ponteiroFino) return magnetizar(q('[data-magnetico]'))
  })

  return (
    <section ref={raiz} className="bg-primary text-primary-foreground">
      <div className="conteiner-landing flex min-h-svh flex-col justify-between gap-(--espaco-bloco) py-(--espaco-secao)">
        <div className="flex items-center gap-4">
          <p className="eyebrow shrink-0">Próximo passo</p>
          <span aria-hidden="true" data-regua className="h-0.5 flex-1 origin-left bg-current" />
        </div>

        <h2 className="max-w-[18ch] text-[clamp(40px,8.4vw,152px)] leading-none">
          Dados e IA com rigor técnico e clareza didática.
        </h2>

        <div className="grid items-end gap-(--espaco-item) md:grid-cols-12">
          <p data-apoio className="max-w-[30ch] text-xl leading-[1.4] md:col-span-6 md:text-2xl">
            Conte o que sua equipe precisa: uma palestra, um treinamento ou um projeto.
          </p>
          <div className="flex flex-wrap gap-4 md:col-span-6 md:justify-end">
            <span data-apoio className="inline-flex">
              <Button
                asChild
                size="lg"
                variant="secondary"
                data-magnetico
                className="varredura border-tinta bg-tinta text-papel [--varre:var(--papel)] hover:border-papel hover:bg-tinta! hover:text-tinta"
              >
                <a href="#contato">
                  Enviar mensagem
                  <ArrowRightIcon aria-hidden="true" />
                </a>
              </Button>
            </span>
            <span data-apoio className="inline-flex">
              <Button
                asChild
                size="lg"
                variant="outline"
                data-magnetico
                className="varredura border-primary-foreground text-primary-foreground [--varre:#ffffff] hover:bg-transparent! hover:text-primary"
              >
                <Link to="/aluno/entrar">Sou aluno</Link>
              </Button>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
