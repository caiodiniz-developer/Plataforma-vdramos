import { gsap } from './movimento'

/**
 * Botão magnético: enquanto o ponteiro está sobre o elemento, ele se desloca
 * uma fração da distância até o ponteiro; ao sair, volta ao lugar. Devolve a
 * função que desliga os ouvintes (os tweens são desfeitos pelo contexto do GSAP).
 */
export function magnetizar(elementos: HTMLElement[], forca = 0.28): () => void {
  const desligar = elementos.map((elemento) => {
    const moverX = gsap.quickTo(elemento, 'x', { duration: 0.35, ease: 'power3.out' })
    const moverY = gsap.quickTo(elemento, 'y', { duration: 0.35, ease: 'power3.out' })
    const aoMover = (evento: PointerEvent) => {
      const caixa = elemento.getBoundingClientRect()
      moverX((evento.clientX - (caixa.left + caixa.width / 2)) * forca)
      moverY((evento.clientY - (caixa.top + caixa.height / 2)) * forca)
    }
    const aoSair = () => {
      moverX(0)
      moverY(0)
    }
    elemento.addEventListener('pointermove', aoMover)
    elemento.addEventListener('pointerleave', aoSair)
    return () => {
      elemento.removeEventListener('pointermove', aoMover)
      elemento.removeEventListener('pointerleave', aoSair)
    }
  })
  return () => desligar.forEach((parar) => parar())
}

/**
 * Posição do ponteiro dentro de uma área, de -1 a 1 em cada eixo (0 no
 * centro). Base das reações ao ponteiro no hero.
 */
export function posicaoRelativa(
  ponto: { x: number; y: number },
  caixa: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  if (caixa.width <= 0 || caixa.height <= 0) return { x: 0, y: 0 }
  const limitar = (valor: number) => Math.max(-1, Math.min(1, valor))
  return {
    x: limitar(((ponto.x - caixa.left) / caixa.width) * 2 - 1),
    y: limitar(((ponto.y - caixa.top) / caixa.height) * 2 - 1),
  }
}
