import { useEffect, useRef, useState } from 'react'

/**
 * Indica quando o elemento entrou na tela (uma vez só). Sem
 * IntersectionObserver no navegador, considera visível de imediato, para o
 * conteúdo nunca ficar escondido.
 */
export function useVisivel<T extends Element>(margem = '0px 0px -10% 0px') {
  const ref = useRef<T>(null)
  const [visivel, setVisivel] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const elemento = ref.current
    if (!elemento || visivel) return
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisivel(true)
          observador.disconnect()
        }
      },
      { rootMargin: margem },
    )
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [margem, visivel])

  return { ref, visivel }
}
