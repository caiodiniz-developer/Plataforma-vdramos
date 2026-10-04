import { useEffect, useState } from 'react'

type Props = { temas: string[]; intervaloMs?: number }

/**
 * "Terminal" do hero que alterna os temas da marca, letra a letra. É
 * decorativo: o leitor de tela recebe a lista inteira de uma vez.
 */
export function TemaDigitado({ temas, intervaloMs = 2400 }: Props) {
  const [indice, setIndice] = useState(0)
  const [letras, setLetras] = useState(0)
  const tema = temas[indice] ?? ''

  useEffect(() => {
    if (temas.length === 0) return
    if (letras < tema.length) {
      const passo = setTimeout(() => setLetras((n) => n + 1), 70)
      return () => clearTimeout(passo)
    }
    const troca = setTimeout(() => {
      setIndice((i) => (i + 1) % temas.length)
      setLetras(0)
    }, intervaloMs)
    return () => clearTimeout(troca)
  }, [letras, tema, temas.length, intervaloMs])

  return (
    <p className="inline-flex items-center gap-2 border-2 bg-card px-3 py-1.5 font-mono text-sm font-bold">
      <span aria-hidden="true" className="text-muted-foreground">
        &gt;
      </span>
      <span aria-hidden="true">{tema.slice(0, letras).toLowerCase()}</span>
      <span aria-hidden="true" className="cursor-piscante -ml-1 inline-block h-4 w-2 bg-primary" />
      <span className="sr-only">{temas.join(', ')}</span>
    </p>
  )
}
