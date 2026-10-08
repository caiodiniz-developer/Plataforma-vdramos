/** Texto sem acentos e em minúsculas, para comparar na busca. */
function limpar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** `true` quando algum dos textos contém o termo, ignorando acentos e maiúsculas. Termo vazio casa com tudo. */
export function contem(termo: string, ...textos: (string | null | undefined)[]): boolean {
  const alvo = limpar(termo.trim())
  if (alvo === '') return true
  return textos.some((texto) => limpar(texto ?? '').includes(alvo))
}

/** Percentual inteiro de `parte` em `total` (0 quando não há total). */
/** Até duas letras para o avatar: primeira do primeiro nome e do último. "Ana Souza" → "AS". */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  const letras = partes.length === 1 ? [partes[0]] : [partes[0], partes[partes.length - 1]]
  return letras.map((p) => p[0]!.toUpperCase()).join('')
}

export function percentualDe(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0
}
