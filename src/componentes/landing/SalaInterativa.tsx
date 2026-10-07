import {
  CalendarRangeIcon,
  ChartColumnIcon,
  FileSpreadsheetIcon,
  FolderOpenIcon,
  MessageCircleQuestionIcon,
  PresentationIcon,
  ThumbsUpIcon,
  type LucideIcon,
} from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CabecalhoDeSecao } from '@/componentes/Secao'
import { ReguaDoEncontro } from '@/componentes/turma/ReguaDoEncontro'
import { magnetizar } from '@/lib/interacoes'
import { deBloco, deMascara, deRegua, embaralhar, gsap, RECORTE_ABERTO, SplitText, useMovimento } from '@/lib/movimento'
import { BLOCOS_DEMO, momentoDaAula } from './aulaDemo'

/**
 * Recursos da sala. `entrada` é o ponto da aula (0 a 1) em que o recurso
 * aparece na prévia: a régua no começo, a pergunta quando a prática começa,
 * o quiz mais adiante e os materiais perto do fim.
 */
const RECURSOS: { icone: LucideIcon; titulo: string; texto: string; entrada: number }[] = [
  {
    icone: CalendarRangeIcon,
    titulo: 'Calendário com a régua do encontro',
    texto: 'Cada aula dividida em abertura, teoria, prática e perguntas, com horário e duração.',
    entrada: 0,
  },
  {
    icone: MessageCircleQuestionIcon,
    titulo: 'Perguntas durante a aula',
    texto: 'Para a turma ou só para o professor, com opção de enviar sem o nome e votar nas mais importantes.',
    entrada: 0.36,
  },
  {
    icone: ChartColumnIcon,
    titulo: 'Quizzes e pesquisas',
    texto: 'Respostas em tempo real, com correção na hora e resultado projetado para a turma.',
    entrada: 0.58,
  },
  {
    icone: FolderOpenIcon,
    titulo: 'Materiais por encontro',
    texto: 'Planilhas, slides e links liberados no momento certo do curso.',
    entrada: 0.8,
  },
]

/** Passos de uma aula, na ordem em que acontecem (PRD, seção 6 — "Aula ao vivo"). */
const PASSOS: { titulo: string; texto: string; cor: string }[] = [
  {
    titulo: 'Calendário',
    texto: 'Você vê os encontros da turma e a régua de cada aula, com o horário de cada bloco.',
    cor: 'bg-papel',
  },
  {
    titulo: 'Aula ao vivo',
    texto: 'Quando o professor abre a sessão, a sala ao vivo fica disponível para a turma.',
    cor: 'bg-primary',
  },
  {
    titulo: 'Perguntas',
    texto: 'Você pergunta para a turma ou só para o professor e vota nas perguntas da turma.',
    cor: 'bg-violet',
  },
  {
    titulo: 'Quiz',
    texto: 'Ao fim de um bloco, você responde dentro do tempo e o resultado é projetado.',
    cor: 'bg-orange',
  },
  {
    titulo: 'Materiais',
    texto: 'Planilhas, slides e links ficam organizados por encontro.',
    cor: 'bg-green',
  },
]

const RESULTADO_DEMO = [
  { opcao: '$', percentual: 72, correta: true },
  { opcao: '#', percentual: 18, correta: false },
  { opcao: '&', percentual: 10, correta: false },
]

const MATERIAIS_DEMO: { icone: LucideIcon; nome: string }[] = [
  { icone: FileSpreadsheetIcon, nome: 'Planilha de exercícios' },
  { icone: PresentationIcon, nome: 'Slides do encontro' },
]

const VOTOS_DEMO = 12
const FIM = momentoDaAula(BLOCOS_DEMO, 1)

/**
 * Prévia ilustrativa da sala ao vivo. Sem animação, mostra o encontro
 * completo: régua cheia, relógio no horário de término, pergunta, quiz e
 * materiais. O relógio e o "bloco em andamento" são decorativos
 * (`aria-hidden`): o horário do encontro já está escrito no cabeçalho.
 */
function PreviaDaSala() {
  return (
    <div
      data-previa
      role="group"
      aria-label="Prévia ilustrativa da sala de aula"
      className="flex flex-col gap-5 bg-background p-5 text-foreground md:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow text-muted-foreground">Encontro 1 · 18:45–22:45</p>
          <p className="font-mono text-lg font-bold">Estruturação de dados</p>
        </div>
        <Badge>
          <span aria-hidden="true" className="size-1.5 animate-pulse bg-primary-foreground" />
          Ao vivo
        </Badge>
      </div>

      <div aria-hidden="true" className="flex items-end justify-between gap-4 border-y-2 py-4">
        <span data-relogio className="font-mono text-[clamp(44px,5vw,76px)] leading-none font-bold tabular-nums">
          {FIM.hora}
        </span>
        <span className="flex flex-col items-end">
          <span className="eyebrow text-muted-foreground">Bloco em andamento</span>
          <span data-agora className="font-mono text-lg leading-tight font-bold">
            {FIM.bloco?.titulo}
          </span>
        </span>
      </div>

      <div data-regua-demo className="relative">
        <ReguaDoEncontro blocos={BLOCOS_DEMO} />
        {/* Agulha do horário: corre sobre a régua conforme a aula passa. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-1.5 h-11 overflow-x-clip">
          <div data-agulha className="h-full w-full border-r-2 border-foreground" />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div data-cartao="pergunta" className="flex gap-3 border-2 p-4">
            <div className="flex-1">
              <p className="eyebrow text-muted-foreground">Anônimo</p>
              <p className="text-[14px]">Quando usar referência absoluta em vez de relativa?</p>
            </div>
            <span className="flex h-fit flex-col items-center border-2 px-2 py-1 font-mono text-xs font-bold tabular-nums">
              <ThumbsUpIcon aria-hidden="true" className="size-3.5" />
              <span data-votos>+{VOTOS_DEMO}</span>
            </span>
          </div>

          <div data-cartao="materiais" className="flex flex-col gap-2 border-2 p-4">
            <p className="eyebrow text-muted-foreground">Materiais do encontro</p>
            <ul className="flex flex-col gap-1.5">
              {MATERIAIS_DEMO.map((material) => (
                <li key={material.nome} className="flex items-center gap-2 text-[14px] font-bold">
                  <material.icone aria-hidden="true" className="size-4 shrink-0" />
                  {material.nome}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div data-cartao="quiz" className="flex flex-col gap-2 border-2 p-4">
          <p className="eyebrow text-muted-foreground">Quiz · resultado da turma</p>
          <p className="text-[14px] font-bold">Qual símbolo fixa uma referência?</p>
          <ul className="flex flex-col gap-2">
            {RESULTADO_DEMO.map((r) => (
              <li key={r.opcao} className="flex items-center gap-3 text-[13px]">
                <span className="w-4 font-mono font-bold">{r.opcao}</span>
                <span className="h-3 flex-1 border-2 bg-background">
                  <span
                    data-barra
                    className={`block h-full origin-left ${r.correta ? 'bg-green' : 'bg-neutro'}`}
                    style={{ width: `${r.percentual}%` }}
                  />
                </span>
                <span className="w-10 text-right font-mono">{r.percentual}%</span>
                {/* A cor não é a única pista: a correta tem rótulo em texto. */}
                <span className="w-14 text-xs font-bold">{r.correta ? 'Correta' : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/** "Como é uma aula": os cinco passos, do calendário aos materiais. */
function PassosDaAula() {
  return (
    <div data-passos className="conteiner-landing pt-(--espaco-bloco) pb-(--espaco-secao)">
      <div className="flex items-center gap-4">
        <h3 className="shrink-0 text-[clamp(26px,3vw,44px)] leading-none">Como é uma aula</h3>
        <span aria-hidden="true" data-regua-passos className="h-0.5 flex-1 origin-left bg-current" />
      </div>
      <ol className="mt-(--espaco-item) grid gap-x-8 gap-y-(--espaco-item) sm:grid-cols-2 lg:grid-cols-5">
        {PASSOS.map((passo, i) => (
          <li key={passo.titulo} data-passo className="flex flex-col gap-4">
            <span aria-hidden="true" data-barra-passo className={`block h-2 origin-left ${passo.cor}`} />
            <span aria-hidden="true" data-embaralha className="font-mono text-sm text-neutro">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h4 className="font-mono text-2xl leading-tight font-bold">{passo.titulo}</h4>
            <p className="text-[15px] leading-[1.6] text-neutro">{passo.texto}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * Seção em Tinta que apresenta a sala de aula interativa e leva à área do aluno.
 *
 * Movimento — a aula passa na prévia:
 *  - completo, em telas largas e altas: a seção fica fixa e a rolagem conduz a
 *    aula. A régua do encontro se preenche bloco a bloco, o relógio anda de
 *    18:45 a 22:45 e a pergunta, o quiz e os materiais entram no momento em
 *    que cada recurso é usado. Rolar para cima retrocede.
 *  - essencial (e telas menores): nada é fixado. A mesma sequência toca
 *    sozinha, uma vez, quando a prévia entra na tela.
 * A seção entra por recorte preso à rolagem (só no completo) e os passos de
 * "Como é uma aula" aparecem um a um.
 */
export function SalaInterativa({ numero }: { numero?: string }) {
  const raiz = useRef<HTMLElement>(null)

  useMovimento(raiz, (c, q) => {
    const fixa = c.completo && c.desktop && c.alto
    const [relogio] = q('[data-relogio]')
    const [agora] = q('[data-agora]')
    const [votos] = q('[data-votos]')
    const blocos = q('[data-regua-demo] [role="img"] > *')
    const minutos = BLOCOS_DEMO.reduce((soma, b) => soma + b.duracao_min, 0)
    // A linha do tempo tem 10 unidades: com scrub, é a distância de rolagem
    // que conta; sem scrub, `timeScale` acerta a duração real.
    const DURACAO = 10

    if (c.completo) {
      // Troca Papel → Tinta por recorte, presa à rolagem.
      gsap.fromTo(
        raiz.current,
        { clipPath: 'inset(0% 6% 0% 6%)' },
        {
          clipPath: RECORTE_ABERTO,
          ease: 'none',
          scrollTrigger: { trigger: raiz.current, start: 'top bottom', end: 'top 25%', scrub: true },
        },
      )
    }

    const mostrar = (progresso: number) => {
      const momento = momentoDaAula(BLOCOS_DEMO, progresso)
      if (relogio.textContent !== momento.hora) relogio.textContent = momento.hora
      const titulo = momento.bloco?.titulo ?? ''
      if (agora.textContent !== titulo) agora.textContent = titulo
    }

    const aula = { progresso: 0, votos: 0 }
    const linha = gsap.timeline({
      // O tempo aqui é de quem rola: nenhuma curva temporal.
      defaults: { ease: 'none' },
      scrollTrigger: fixa
        ? {
            trigger: q('[data-palco]'),
            start: 'top top',
            end: '+=220%',
            pin: true,
            // Com a rolagem suave ligada (ponteiro fino), o scrub fica colado: suavizar duas vezes atrasa.
            scrub: c.ponteiroFino ? true : 0.5,
            anticipatePin: 1,
          }
        : { trigger: q('[data-previa]'), start: 'top 70%' },
    })

    linha
      .to(aula, { progresso: 1, duration: DURACAO, onUpdate: () => mostrar(aula.progresso) }, 0)
      .fromTo(q('[data-agulha]'), { xPercent: -100 }, { xPercent: 0, duration: DURACAO }, 0)

    let cursor = 0
    BLOCOS_DEMO.forEach((bloco, i) => {
      const duracao = (bloco.duracao_min / minutos) * DURACAO
      linha.fromTo(blocos[i], { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: duracao }, cursor)
      cursor += duracao
    })

    q('[data-marcador]').forEach((marcador, i) => {
      linha.fromTo(marcador, { scaleY: 0 }, { scaleY: 1, duration: 1.2 }, RECURSOS[i].entrada * DURACAO)
    })

    const entrada = (recurso: number) => RECURSOS[recurso].entrada * DURACAO
    const fechado = { clipPath: 'inset(0% 0% 100% 0%)', y: c.completo ? 20 : 8 }
    const aberto = { clipPath: RECORTE_ABERTO, y: 0, duration: 0.9 }
    linha
      .fromTo(q('[data-cartao="pergunta"]'), fechado, aberto, entrada(1))
      .to(
        aula,
        { votos: VOTOS_DEMO, duration: 1.6, onUpdate: () => (votos.textContent = `+${Math.round(aula.votos)}`) },
        entrada(1) + 0.5,
      )
      .fromTo(q('[data-cartao="quiz"]'), fechado, aberto, entrada(2))
      .fromTo(q('[data-barra]'), { scaleX: 0 }, { scaleX: 1, duration: 1.2, stagger: 0.2 }, entrada(2) + 0.5)
      .fromTo(q('[data-cartao="materiais"]'), fechado, aberto, entrada(3))

    if (!fixa) linha.timeScale(DURACAO / (c.completo ? 3.5 : 3))
    mostrar(0)
    votos.textContent = '+0'

    // "Como é uma aula": título, régua e os passos, um a um.
    const titulo = SplitText.create(q('[data-passos] h3'), { type: 'words', mask: 'words' })
    gsap
      .timeline({ scrollTrigger: { trigger: q('[data-passos]'), start: 'top 80%' } })
      .from(titulo.words, { ...deMascara(c), stagger: 0.06 }, 0)
      .from(q('[data-regua-passos]'), deRegua(c), 0.1)
    q('[data-passo]').forEach((passo, i) => {
      const dentro = (seletor: string) => Array.from(passo.querySelectorAll<HTMLElement>(seletor))
      const entradaDoPasso = gsap
        .timeline({ scrollTrigger: { trigger: passo, start: 'top 88%' }, delay: c.desktop ? i * 0.1 : 0 })
        .from(dentro('[data-barra-passo]'), { scaleX: 0, duration: c.completo ? 0.9 : 0.6, ease: 'circ.out' }, 0)
        .from(dentro('h4, p'), { ...deBloco(c, 24), stagger: 0.08 }, 0.15)
      dentro('[data-embaralha]').forEach((alvo) => entradaDoPasso.add(embaralhar(alvo, c), 0.1))
    })

    const desligarMagnetismo = c.completo && c.ponteiroFino ? magnetizar(q('[data-magnetico]')) : undefined

    // O GSAP desfaz estilos, mas não textos: devolve o estado final escrito.
    return () => {
      desligarMagnetismo?.()
      mostrar(1)
      votos.textContent = `+${VOTOS_DEMO}`
    }
  })

  return (
    <section ref={raiz} id="sala-de-aula" className="bg-secondary text-secondary-foreground">
      <div data-palco className="flex flex-col justify-center py-(--espaco-secao) lg:min-h-svh lg:pt-24 lg:pb-8">
        <div className="conteiner-landing grid items-center gap-(--espaco-bloco) lg:grid-cols-12 lg:gap-x-6">
          <div className="flex flex-col gap-6 lg:col-span-5">
            <CabecalhoDeSecao numero={numero} titulo="Sala de aula interativa" tamanho="medio" className="gap-5!" />
            <p className="max-w-[46ch] text-lg">
              Os cursos têm uma sala de aula própria. Você acompanha o calendário, acessa os materiais e participa da
              aula pelo celular ou pelo computador.
            </p>
            <ul className="flex flex-col gap-4">
              {RECURSOS.map((recurso) => (
                <li key={recurso.titulo} className="relative flex gap-4 pl-5">
                  <span aria-hidden="true" data-marcador className="absolute inset-y-0 left-0 w-0.5 origin-top bg-primary" />
                  <recurso.icone aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <h3 className="text-[17px]">{recurso.titulo}</h3>
                    <p className="text-[14px] leading-normal text-neutro">{recurso.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
            <span className="inline-flex self-start">
              <Button asChild data-magnetico className="varredura [--varre:var(--papel)] hover:border-papel hover:bg-primary! hover:text-tinta">
                <Link to="/aluno/entrar">Entrar na área do aluno</Link>
              </Button>
            </span>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <PreviaDaSala />
          </div>
        </div>
      </div>
      <PassosDaAula />
    </section>
  )
}
