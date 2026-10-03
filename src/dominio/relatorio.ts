type Celula = string | number | boolean | null | undefined

function celulaCsv(valor: Celula): string {
  if (valor === null || valor === undefined) return ''
  let texto = typeof valor === 'boolean' ? (valor ? 'sim' : 'não') : String(valor)
  // Evita que o Excel interprete o conteúdo digitado pelo aluno como fórmula.
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/**
 * PRD F21: CSV em ponto e vírgula com BOM, que o Excel em pt-BR abre direto
 * com acentos corretos.
 */
export function gerarCsv(cabecalho: string[], linhas: Celula[][]): string {
  const corpo = [cabecalho, ...linhas].map((linha) => linha.map(celulaCsv).join(';'))
  return '﻿' + corpo.join('\r\n') + '\r\n'
}

/** Mínimo de respostas para mostrar texto livre de atividade anônima (seção 7). */
export const MINIMO_ANONIMATO = 3

export function podeMostrarTextoLivre(anonima: boolean, totalRespostas: number): boolean {
  return !anonima || totalRespostas >= MINIMO_ANONIMATO
}

/** Média com uma casa; `null` sem respostas (o gráfico mostra lacuna, não zero). */
export function media(valores: number[]): number | null {
  if (valores.length === 0) return null
  const soma = valores.reduce((total, v) => total + v, 0)
  return Math.round((soma / valores.length) * 10) / 10
}

/** NPS = % de promotores (9–10) − % de detratores (0–6), de −100 a 100. */
export function nps(notas: number[]): number | null {
  if (notas.length === 0) return null
  const promotores = notas.filter((n) => n >= 9).length
  const detratores = notas.filter((n) => n <= 6).length
  return Math.round(((promotores - detratores) / notas.length) * 100)
}

export function percentual(parte: number, total: number): number | null {
  if (total === 0) return null
  return Math.round((parte / total) * 100)
}

export type SatisfacaoBloco = {
  encontro_numero: number
  tipo_bloco: 'teoria' | 'pratica'
  media: number
}

export type SatisfacaoPorEncontro = {
  encontro: string
  teoria: number | null
  pratica: number | null
}

/**
 * Dados do gráfico de barras agrupadas teoria × prática. Encontro sem
 * pesquisa de um dos tipos fica com `null` (barra ausente), nunca zero.
 */
export function satisfacaoPorEncontro(linhas: SatisfacaoBloco[]): SatisfacaoPorEncontro[] {
  const porEncontro = new Map<number, SatisfacaoPorEncontro>()
  for (const linha of linhas) {
    const atual = porEncontro.get(linha.encontro_numero) ?? {
      encontro: `Encontro ${linha.encontro_numero}`,
      teoria: null,
      pratica: null,
    }
    atual[linha.tipo_bloco] = linha.media
    porEncontro.set(linha.encontro_numero, atual)
  }
  return [...porEncontro.entries()].sort(([a], [b]) => a - b).map(([, dados]) => dados)
}
