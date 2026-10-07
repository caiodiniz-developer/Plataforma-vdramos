import { useSyncExternalStore } from 'react'

const CONSULTA = '(min-width: 768px)'

function assinar(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA)
  consulta.addEventListener('change', avisar)
  return () => consulta.removeEventListener('change', avisar)
}

/**
 * true a partir de 768 px (o `md` do Tailwind). Serve para montar um único
 * layout por vez quando celular e desktop têm estruturas diferentes, em vez
 * de montar os dois e esconder um com CSS.
 */
export function useTelaLarga(): boolean {
  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(CONSULTA).matches,
    () => false,
  )
}
