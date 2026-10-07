import { ArrowDownIcon, ArrowUpRightIcon } from 'lucide-react'
import { Fragment, useRef, type CSSProperties } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RETRATO } from '@/conteudo/galeria'
import { urlDaFoto, type PerfilPublico } from '@/dados/landing'
import { magnetizar, posicaoRelativa } from '@/lib/interacoes'
import {
  deBloco,
  deMascara,
  deRegua,
  embaralhar,
  gsap,
  RECORTE_ABERTO,
  SplitText,
  useMovimento,
} from '@/lib/movimento'
import { tempoRestanteDaAbertura } from './aberturaDaPagina'
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
 * Movimento: as letras do nome sobem de dentro da linha, a régua e a faixa de
 * cores se desenham, o retrato abre por recorte e assenta com zoom. Ao rolar,
 * a grade sai mais devagar que a página e, em telas largas, o nome e o retrato
 * saem em velocidades diferentes. Com ponteiro fino, o hero reage ao ponteiro
 * depois da entrada: a grade desliza, o retrato inclina, a cor da faixa sob o
 * ponteiro cresce e os botões são magnéticos.
 */
export function Hero({ perfil }: Props) {
  const raiz = useRef<HTMLElement>(null)
  const foto = urlDaFoto(perfil.foto_path)
  const retrato = foto ?? RETRATO.arquivo
  const ehExemplo = !foto && RETRATO.exemplo
  const escala = escalaDoNome(perfil.nome_exibicao)

  useMovimento(raiz, (c, q) => {
    const secao = raiz.current
    if (!secao) return
    const nome = SplitText.create(q('h1'), { type: 'chars', mask: 'chars' })

    // Espera a abertura da página terminar para o hero entrar à vista.
    const linha = gsap
      .timeline({ delay: tempoRestanteDaAbertura() })
      .from(q('[data-regua]'), deRegua(), 0)
      .from(q('[data-topo]'), { ...deBloco(16), stagger: 0.08 }, 0.05)
      .from(nome.chars, { ...deMascara(), stagger: 0.035 }, 0.1)
      .from(q('[data-cor]'), { scaleX: 0, duration: 0.9, ease: 'circ.out', stagger: 0.09 }, 0.5)
      .from(q('[data-bio]'), deBloco(28), 0.65)
      .from(q('[data-entra]'), { ...deBloco(24), stagger: 0.06 }, 0.8)
      .fromTo(
        q('[data-moldura]'),
        { clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: RECORTE_ABERTO, duration: 1.3, ease: 'power3.inOut' },
        0.5,
      )
    q('[data-embaralha]').forEach((alvo, i) => linha.add(embaralhar(alvo), 0.9 + i * 0.06))


    linha.from(q('[data-retrato]'), { scale: 1.25, duration: 1.6, ease: 'power2.out' }, 0.5)

    // Saída pelo scroll: o tempo é de quem rola, então sem curva temporal.
    const rolagem = { trigger: secao, start: 'top top', end: 'bottom top', scrub: true }
    gsap.to(q('[data-grade]'), { yPercent: 12, ease: 'none', scrollTrigger: rolagem })
    if (c.desktop) {
      gsap.to(q('h1'), { xPercent: -5, ease: 'none', scrollTrigger: rolagem })
      gsap.to(q('[data-figura]'), { yPercent: -14, ease: 'none', scrollTrigger: rolagem })
    }

    if (!c.ponteiroFino) return

    // Reações ao ponteiro: valores perseguem o alvo, sem `setState` por evento.
    const desligarMagnetismo = magnetizar(q('[data-magnetico]'))
    const [grade] = q('[data-grade-interna]')
    const [moldura] = q('[data-inclina]')
    const cores = q('[data-cor]')
    const gradeX = gsap.quickTo(grade, 'x', { duration: 0.9, ease: 'power3.out' })
    const gradeY = gsap.quickTo(grade, 'y', { duration: 0.9, ease: 'power3.out' })
    const inclinaX = gsap.quickTo(moldura, 'rotationY', { duration: 0.7, ease: 'power3.out' })
    const inclinaY = gsap.quickTo(moldura, 'rotationX', { duration: 0.7, ease: 'power3.out' })
    const crescer = cores.map((cor) => gsap.quickTo(cor, 'scaleY', { duration: 0.5, ease: 'power3.out' }))

    const aoMover = (evento: PointerEvent) => {
      const p = posicaoRelativa({ x: evento.clientX, y: evento.clientY }, secao.getBoundingClientRect())
      gradeX(p.x * -14)
      gradeY(p.y * -14)
      inclinaX(p.x * 5)
      inclinaY(p.y * -4)
      // A cor sob o ponteiro fica mais alta; as outras voltam ao tamanho normal.
      const indice = Math.min(cores.length - 1, Math.floor(((p.x + 1) / 2) * cores.length))
      crescer.forEach((definir, i) => definir(i === indice ? 2.4 : 1))
    }
    const aoSair = () => {
      gradeX(0)
      gradeY(0)
      inclinaX(0)
      inclinaY(0)
      crescer.forEach((definir) => definir(1))
    }
    secao.addEventListener('pointermove', aoMover)
    secao.addEventListener('pointerleave', aoSair)
    return () => {
      desligarMagnetismo()
      secao.removeEventListener('pointermove', aoMover)
      secao.removeEventListener('pointerleave', aoSair)
    }
  })

  const colunas = {
    '--colunas-linha': escala.colunasEmLinha,
    '--colunas-pilha': escala.colunasEmpilhado,
  } as CSSProperties

  return (
    <section ref={raiz} className="relative overflow-clip border-b-2">
      {/* Grade técnica de fundo, só decorativa. */}
      <div aria-hidden="true" data-grade className="pointer-events-none absolute inset-x-0 inset-y-[-12%]">
        <div data-grade-interna className="grade-tecnica absolute -inset-6" />
      </div>

      <div className="conteiner-landing relative flex flex-col pt-8 pb-(--espaco-bloco) md:pt-10 lg:min-h-[calc(100svh-4rem)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <p data-topo className="eyebrow shrink-0 text-muted-foreground">
            {perfil.titulo}
            {perfil.cidade && <span> · {perfil.cidade}</span>}
          </p>
          <span aria-hidden="true" data-regua className="h-0.5 min-w-10 flex-1 origin-left bg-foreground" />
          <a
            data-topo
            data-cursor="Rolar"
            href="#frentes"
            className="eyebrow hidden min-h-11 shrink-0 items-center gap-2 text-muted-foreground transition-colors hover:text-foreground md:flex"
          >
            Role para conhecer
            <ArrowDownIcon aria-hidden="true" className="size-4" />
          </a>
        </div>

        <h1 className="nome-gigante mt-(--espaco-item) lg:mt-auto lg:pt-(--espaco-item)" style={colunas}>
          {escala.palavras.map((palavra, i) => (
            <Fragment key={i}>
              {i > 0 && ' '}
              <span className="block md:inline">{palavra}</span>
            </Fragment>
          ))}
        </h1>

        {/* Faixa das quatro cores da marca, como no cartão do guia. */}
        <div aria-hidden="true" className="mt-6 flex h-2 items-start md:mt-8 md:h-3">
          {CORES_DA_FAIXA.map((cor) => (
            <div key={cor} data-cor className={`h-full flex-1 origin-top-left ${cor}`} />
          ))}
        </div>

        <div className="mt-(--espaco-item) grid gap-(--espaco-item) lg:grid-cols-12 lg:gap-x-6">
          <div className="flex flex-col gap-(--espaco-miolo) lg:col-span-5">
            <p data-bio className="max-w-[34ch] text-xl leading-[1.4] md:text-2xl xl:text-[28px]">
              {perfil.bio}
            </p>
            <div className="flex flex-wrap gap-4">
              {perfil.linkedin_url && (
                <span data-entra className="inline-flex">
                  <Button asChild size="lg" data-magnetico data-cursor="Abrir" className="varredura hover:bg-primary!">
                    <a href={perfil.linkedin_url} target="_blank" rel="noopener noreferrer">
                      LinkedIn
                      <ArrowUpRightIcon aria-hidden="true" />
                      <span className="sr-only">(abre em nova aba)</span>
                    </a>
                  </Button>
                </span>
              )}
              <span data-entra className="inline-flex">
                <Button asChild size="lg" variant="outline" data-magnetico className="varredura hover:bg-transparent!">
                  <a href="#contato">Contato</a>
                </Button>
              </span>
            </div>
          </div>

          <ul aria-label="Temas" className="flex flex-col self-end border-t-2 border-divisor lg:col-span-2 lg:col-start-7">
            {TEMAS.map((tema, i) => (
              <li
                key={tema.nome}
                data-entra
                className="flex items-center gap-3 border-b-2 border-divisor py-3.5 font-mono text-lg font-bold"
              >
                <span aria-hidden="true" className={`size-3 shrink-0 ${tema.cor}`} />
                {tema.nome}
                <span aria-hidden="true" data-embaralha className="ml-auto text-xs font-normal text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </li>
            ))}
          </ul>

          <figure
            data-figura
            className="relative w-full max-w-[320px] self-end perspective-[900px] lg:col-span-3 lg:col-start-10 lg:max-w-none"
          >
            <div data-inclina>
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
            </div>
          </figure>
        </div>
      </div>
    </section>
  )
}
