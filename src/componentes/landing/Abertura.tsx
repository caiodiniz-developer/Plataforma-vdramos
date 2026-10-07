import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CONSULTAS, gsap, SplitText, useGSAP } from '@/lib/movimento'
import { nivelDeMovimento } from '@/lib/nivelDeMovimento'
import {
  deveAbrir,
  DURACAO_DA_ABERTURA,
  marcarAberturaVista,
  registrarFimDaAbertura,
  textoDoContador,
} from './aberturaDaPagina'

const CORES = ['bg-primary', 'bg-orange', 'bg-violet', 'bg-green']

/** Tempo da cortina subindo, no fim da abertura (o hero começa a entrar junto). */
const SAIDA = 0.6

function guardaDaSessao(): Storage | undefined {
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

/**
 * Abertura da página (nível completo, primeira carga da sessão): cortina em
 * Tinta com contador, o nome se montando e a faixa das quatro cores; em cerca
 * de 1,6 s ela sobe e entrega para o hero.
 *
 * É decorativa (`aria-hidden`) e não segura ninguém: clique, toque ou qualquer
 * tecla pula; o conteúdo da página já está montado por baixo e legível por
 * leitor de tela; e um temporizador tira a cortina mesmo se a animação falhar.
 */
export function Abertura() {
  const raiz = useRef<HTMLDivElement>(null)
  const [aberta, setAberta] = useState(
    // `matchMedia('all')` só casa em navegador de verdade: nos testes de tela não há abertura.
    () => window.matchMedia(CONSULTAS.tela).matches && deveAbrir(nivelDeMovimento(), guardaDaSessao()),
  )

  // Rede de segurança: a cortina sai de qualquer jeito.
  useEffect(() => {
    if (!aberta) return
    const prazo = window.setTimeout(() => setAberta(false), (DURACAO_DA_ABERTURA + 1) * 1000)
    return () => window.clearTimeout(prazo)
  }, [aberta])

  useGSAP(
    () => {
      const cortina = raiz.current
      if (!aberta || !cortina) return
      marcarAberturaVista(guardaDaSessao())
      registrarFimDaAbertura(performance.now() + (DURACAO_DA_ABERTURA - SAIDA) * 1000)

      const contador = cortina.querySelector<HTMLElement>('[data-contador]')
      const letras = SplitText.create(cortina.querySelector('[data-nome]'), { type: 'chars', mask: 'chars', aria: 'none' })
      const contagem = { progresso: 0 }
      const entrada = DURACAO_DA_ABERTURA - SAIDA

      const linha = gsap
        .timeline({ onComplete: () => setAberta(false) })
        .to(contagem, {
          progresso: 1,
          duration: entrada,
          ease: 'power2.inOut',
          onUpdate: () => {
            if (contador) contador.textContent = textoDoContador(contagem.progresso)
          },
        })
        .from(letras.chars, { yPercent: 110, duration: 0.8, ease: 'expo.out', stagger: 0.03 }, 0.05)
        .from(cortina.querySelectorAll('[data-cor]'), { scaleX: 0, duration: entrada, ease: 'power2.inOut', stagger: 0.04 }, 0)
        .addLabel('sair')
        .to(cortina, { clipPath: 'inset(0% 0% 100% 0%)', duration: SAIDA, ease: 'power3.inOut' })

      const pular = () => {
        if (linha.time() < linha.labels.sair) {
          registrarFimDaAbertura(performance.now())
          linha.seek('sair')
        }
      }
      window.addEventListener('pointerdown', pular)
      window.addEventListener('keydown', pular)
      return () => {
        window.removeEventListener('pointerdown', pular)
        window.removeEventListener('keydown', pular)
      }
    },
    { scope: raiz, dependencies: [aberta] },
  )

  if (!aberta) return null

  return (
    <div
      ref={raiz}
      aria-hidden="true"
      data-abertura
      style={{ clipPath: 'inset(0% 0% 0% 0%)' }}
      className="fixed inset-0 z-50 flex cursor-pointer flex-col justify-between bg-secondary text-secondary-foreground"
    >
      <div className="conteiner-landing flex items-center justify-between pt-8">
        <span className="eyebrow">Dados · IA · Educação</span>
        <span className="eyebrow">Toque para pular</span>
      </div>
      <p
        data-nome
        className="conteiner-landing nome-gigante font-mono font-bold tracking-[-0.02em]"
        style={{ '--colunas-pilha': 11, '--colunas-linha': 11 } as CSSProperties}
      >
        Vitor Ramos
      </p>
      <div>
        <div className="conteiner-landing flex items-end justify-between pb-6">
          <span data-contador className="font-mono text-[clamp(48px,9vw,144px)] leading-none font-bold tabular-nums">
            000
          </span>
          <span className="eyebrow pb-3">Carregando a página</span>
        </div>
        <div className="flex h-3">
          {CORES.map((cor) => (
            <div key={cor} data-cor className={`flex-1 origin-left ${cor}`} />
          ))}
        </div>
      </div>
    </div>
  )
}
