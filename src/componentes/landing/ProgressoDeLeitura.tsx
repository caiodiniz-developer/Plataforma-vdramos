import { ArrowUpIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { rolarAte } from '@/lib/rolagem'

/** A partir de quanto da página rolada o botão de voltar ao topo aparece. */
const LIMIAR_DO_BOTAO = 0.15

/**
 * Barra fina de progresso de leitura, presa ao topo, e botão de voltar ao
 * topo. A barra responde 1:1 à rolagem da própria pessoa, então continua
 * ativa com `prefers-reduced-motion`. A largura é escrita direto no elemento,
 * uma vez por quadro: o React só re-renderiza quando o botão aparece ou some.
 */
export function ProgressoDeLeitura() {
  const barra = useRef<HTMLDivElement>(null)
  const [botaoVisivel, setBotaoVisivel] = useState(false)

  useEffect(() => {
    let quadro = 0
    const medir = () => {
      quadro = 0
      const total = document.documentElement.scrollHeight - window.innerHeight
      const fracao = total > 0 ? Math.min(1, window.scrollY / total) : 0
      if (barra.current) barra.current.style.transform = `scaleX(${fracao})`
      setBotaoVisivel(fracao > LIMIAR_DO_BOTAO)
    }
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir)
    }
    medir()
    window.addEventListener('scroll', aoRolar, { passive: true })
    window.addEventListener('resize', aoRolar)
    return () => {
      cancelAnimationFrame(quadro)
      window.removeEventListener('scroll', aoRolar)
      window.removeEventListener('resize', aoRolar)
    }
  }, [])

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-30 h-1">
        <div ref={barra} className="h-full origin-left bg-primary" style={{ transform: 'scaleX(0)' }} />
      </div>
      <Button
        size="icon"
        variant="secondary"
        aria-label="Voltar ao topo"
        onClick={() => rolarAte(0)}
        className={`fixed right-4 bottom-4 z-30 border-papel transition-[opacity,transform] duration-300 md:right-8 md:bottom-8 ${
          botaoVisivel ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
        tabIndex={botaoVisivel ? 0 : -1}
      >
        <ArrowUpIcon />
      </Button>
    </>
  )
}
