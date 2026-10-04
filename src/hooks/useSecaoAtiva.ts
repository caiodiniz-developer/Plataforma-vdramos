import { useEffect, useState } from 'react'

/**
 * Qual das seções (pelos ids) está no meio da tela agora. Alimenta o
 * destaque da âncora no cabeçalho. Sem IntersectionObserver, nada é destacado.
 */
export function useSecaoAtiva(ids: string[]): string | null {
  const [ativa, setAtiva] = useState<string | null>(null)
  const chave = ids.join('|')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const elementos = chave
      .split('|')
      .map((id) => document.getElementById(id))
      .filter((e): e is HTMLElement => e !== null)
    if (elementos.length === 0) return

    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.find((e) => e.isIntersecting)
        if (visivel) setAtiva(visivel.target.id)
      },
      // Faixa estreita no meio da tela: só uma seção por vez.
      { rootMargin: '-45% 0px -50% 0px' },
    )
    elementos.forEach((e) => observador.observe(e))
    return () => observador.disconnect()
  }, [chave])

  return ativa
}
