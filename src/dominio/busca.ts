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
export function percentualDe(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0
}
