/**
 * Conversão entre o instante guardado no banco (ISO, UTC) e o valor de um
 * campo `datetime-local`, que é hora local do navegador sem fuso.
 */
export function paraCampoDeData(instante: string | null): string {
  if (!instante) return ''
  const data = new Date(instante)
  if (Number.isNaN(data.getTime())) return ''
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function paraInstante(campo: string): string | null {
  if (campo === '') return null
  const data = new Date(campo)
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}
