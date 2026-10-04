import { ArrowUpIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

/** Fração rolada da página (0 a 1), atualizada uma vez por quadro. */
function useRolagem(): number {
  const [fracao, setFracao] = useState(0)

  useEffect(() => {
    let quadro = 0
    const medir = () => {
      quadro = 0
      const total = document.documentElement.scrollHeight - window.innerHeight
      setFracao(total > 0 ? Math.min(1, window.scrollY / total) : 0)
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

  return fracao
}

/** Barra fina de progresso de leitura, presa ao topo, e botão de voltar ao topo. */
export function ProgressoDeLeitura() {
  const fracao = useRolagem()

  return (
    <>
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-30 h-1">
        <div className="h-full origin-left bg-primary" style={{ transform: `scaleX(${fracao})` }} />
      </div>
      <Button
        size="icon"
        variant="secondary"
        aria-label="Voltar ao topo"
        onClick={() => window.scrollTo({ top: 0 })}
        className={`fixed right-4 bottom-4 z-30 transition-[opacity,transform] duration-300 md:right-8 md:bottom-8 ${
          fracao > 0.15 ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
        tabIndex={fracao > 0.15 ? 0 : -1}
      >
        <ArrowUpIcon />
      </Button>
    </>
  )
}
