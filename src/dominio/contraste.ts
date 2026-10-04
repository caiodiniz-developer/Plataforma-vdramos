/**
 * Contraste WCAG 2.x entre duas cores hexadecimais. Usado nos testes para
 * garantir que as combinações de cor da interface seguem a revisão de marca
 * do PRD (seção 9).
 */
function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contraste(cor1: string, cor2: string): number {
  const [clara, escura] = [luminancia(cor1), luminancia(cor2)].sort((a, b) => b - a)
  return (clara + 0.05) / (escura + 0.05)
}

/** AA: 4,5:1 para texto comum; 3:1 para texto grande (≥ 24 px, ou ≥ 18,7 px em negrito). */
export function passaAA(texto: string, fundo: string, grande = false): boolean {
  return contraste(texto, fundo) >= (grande ? 3 : 4.5)
}

export const CORES = {
  papel: '#f4f2ee',
  tinta: '#181a1e',
  branco: '#ffffff',
  principal: '#2f6fed',
  laranja: '#d9711c',
  roxo: '#8b5cf6',
  verde: '#1f9d55',
  neutroClaro: '#5a5a56',
  neutroEscuro: '#c9c9c4',
  cardEscuro: '#22252a',
  destrutivo: '#b3261e',
} as const
