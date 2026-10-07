import { useRef } from 'react'
import { gsap, useMovimento } from '@/lib/movimento'

/** Onde o cursor decorativo some: dentro de campos, vale só o cursor do sistema. */
const CAMPOS = 'input, textarea, select, [role="combobox"], [role="listbox"], [contenteditable="true"]'

/**
 * Cursor decorativo (só com ponteiro fino): um quadrado pequeno que
 * segue o ponteiro com atraso e, sobre elementos marcados com `data-cursor`,
 * abre uma etiqueta curta ("Ver", "Abrir", "Conversar").
 *
 * Não substitui nada: o cursor do sistema continua visível em toda a página,
 * o elemento é `aria-hidden` e não recebe eventos (`pointer-events: none`).
 */
export function CursorPersonalizado() {
  const raiz = useRef<HTMLDivElement>(null)

  useMovimento(raiz, (c, q) => {
    const caixa = raiz.current
    if (!c.ponteiroFino || !caixa) return
    const [ponto] = q('[data-ponto]')
    const [etiqueta] = q('[data-etiqueta]')
    const [texto] = q('[data-texto]')

    gsap.set(caixa, { opacity: 0 })
    gsap.set(etiqueta, { scale: 0, transformOrigin: 'left top' })
    const pontoX = gsap.quickTo(ponto, 'x', { duration: 0.25, ease: 'power3.out' })
    const pontoY = gsap.quickTo(ponto, 'y', { duration: 0.25, ease: 'power3.out' })
    const etiquetaX = gsap.quickTo(etiqueta, 'x', { duration: 0.5, ease: 'power3.out' })
    const etiquetaY = gsap.quickTo(etiqueta, 'y', { duration: 0.5, ease: 'power3.out' })

    let rotulo = ''
    let visivel = false
    const aoMover = (evento: PointerEvent) => {
      if (evento.pointerType !== 'mouse') return
      pontoX(evento.clientX)
      pontoY(evento.clientY)
      etiquetaX(evento.clientX + 18)
      etiquetaY(evento.clientY + 18)

      const alvo = evento.target instanceof Element ? evento.target : null
      const emCampo = Boolean(alvo?.closest(CAMPOS))
      if (visivel === emCampo) {
        visivel = !emCampo
        gsap.to(caixa, { opacity: visivel ? 1 : 0, duration: 0.2, overwrite: true })
      }

      const novo = emCampo ? '' : (alvo?.closest<HTMLElement>('[data-cursor]')?.dataset.cursor ?? '')
      if (novo === rotulo) return
      rotulo = novo
      if (novo) texto.textContent = novo
      gsap.to(etiqueta, { scale: novo ? 1 : 0, duration: novo ? 0.35 : 0.2, ease: novo ? 'back.out(1.6)' : 'power2.in', overwrite: 'auto' })
      gsap.to(ponto, { scale: novo ? 0.4 : 1, duration: 0.25, overwrite: 'auto' })
    }
    const aoSairDaJanela = () => {
      visivel = false
      gsap.to(caixa, { opacity: 0, duration: 0.2, overwrite: true })
    }

    window.addEventListener('pointermove', aoMover, { passive: true })
    document.documentElement.addEventListener('pointerleave', aoSairDaJanela)
    return () => {
      window.removeEventListener('pointermove', aoMover)
      document.documentElement.removeEventListener('pointerleave', aoSairDaJanela)
    }
  })

  return (
    <div ref={raiz} aria-hidden="true" className="pointer-events-none fixed top-0 left-0 z-40 hidden opacity-0 [@media(hover:hover)_and_(pointer:fine)]:block">
      {/* Quadrado azul com contorno Papel: aparece sobre Papel, Tinta e azul. */}
      <span data-ponto className="absolute -top-2 -left-2 size-4 rounded-[2px] border-2 border-papel bg-primary" />
      <span
        data-etiqueta
        className="eyebrow absolute top-0 left-0 border-2 border-papel bg-tinta px-2.5 py-1.5 whitespace-nowrap text-papel"
      >
        <span data-texto />
      </span>
    </div>
  )
}
