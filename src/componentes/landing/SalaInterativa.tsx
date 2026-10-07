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
import { gsap, useMovimento } from '@/lib/movimento'
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
      className="flex flex-col gap-4 bg-background p-5 text-foreground md:p-7"
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

      <div aria-hidden="true" className="flex items-end justify-between gap-4 border-y-2 py-3">
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div data-cartao="pergunta" className="flex gap-3 border-2 p-3">
            <div className="flex-1">
              <p className="eyebrow text-muted-foreground">Anônimo</p>
              <p className="text-[14px]">Quando usar referência absoluta em vez de relativa?</p>
            </div>
            <span className="flex h-fit flex-col items-center border-2 px-2 py-1 font-mono text-xs font-bold tabular-nums">
              <ThumbsUpIcon aria-hidden="true" className="size-3.5" />
              <span data-votos>+{VOTOS_DEMO}</span>
            </span>
          </div>

          <div data-cartao="materiais" className="flex flex-col gap-2 border-2 p-3">
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

        <div data-cartao="quiz" className="flex flex-col gap-2 border-2 p-3">
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

/**
 * Seção em Tinta que apresenta a sala de aula interativa e leva à área do aluno.
 *
 * Movimento: a rolagem faz a aula passar. No desktop, em telas altas, a seção
 * fica fixa enquanto a régua do encontro se preenche bloco a bloco, o relógio
 * anda de 18:45 a 22:45 e a pergunta, o quiz e os materiais entram no momento
 * em que cada recurso é usado. Em telas menores, a mesma sequência toca uma
 * vez quando a prévia entra na tela, sem fixar nada.
 */
export function SalaInterativa({ numero }: { numero?: string }) {
  const raiz = useRef<HTMLElement>(null)

  useMovimento(raiz, ({ desktop, alto }, q) => {
    const fixa = desktop && alto
    const [relogio] = q('[data-relogio]')
    const [agora] = q('[data-agora]')
    const [votos] = q('[data-votos]')
    const blocos = q('[data-regua-demo] [role="img"] > *')
    const minutos = BLOCOS_DEMO.reduce((soma, b) => soma + b.duracao_min, 0)
    // A linha do tempo tem 10 unidades: com scrub, é a distância de rolagem
    // que conta; sem scrub, `timeScale` acerta a duração real.
    const DURACAO = 10

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
        ? { trigger: q('[data-palco]'), start: 'top top', end: '+=220%', pin: true, scrub: 0.6, anticipatePin: 1 }
        : { trigger: q('[data-previa]'), start: 'top 70%', once: true },
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
    const fechado = { clipPath: 'inset(0% 0% 100% 0%)', y: 20 }
    const aberto = { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 0.9 }
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

    if (!fixa) linha.timeScale(DURACAO / 3.5)
    mostrar(0)
    votos.textContent = '+0'

    // O GSAP desfaz estilos, mas não textos: devolve o estado final escrito.
    return () => {
      mostrar(1)
      votos.textContent = `+${VOTOS_DEMO}`
    }
  })

  return (
    <section ref={raiz} id="sala-de-aula" className="overflow-x-clip bg-secondary text-secondary-foreground">
      <div data-palco className="flex flex-col justify-center py-20 lg:min-h-svh lg:pt-24 lg:pb-10">
        <div className="conteiner-landing grid items-center gap-12 lg:grid-cols-12 lg:gap-10 xl:gap-16">
          <div className="flex flex-col gap-7 lg:col-span-5">
            <CabecalhoDeSecao numero={numero} titulo="Sala de aula interativa" tamanho="medio" />
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
            <Button asChild className="self-start hover:border-papel hover:bg-papel hover:text-tinta">
              <Link to="/aluno/entrar">Entrar na área do aluno</Link>
            </Button>
          </div>
          <div className="lg:col-span-7">
            <PreviaDaSala />
          </div>
        </div>
      </div>
    </section>
  )
}
