import { horaParaMinutos, minutosParaHora } from './tempo'

export const TIPOS_BLOCO = [
  'abertura',
  'teoria',
  'pratica',
  'perguntas',
  'intervalo',
  'margem',
] as const

export type TipoBloco = (typeof TIPOS_BLOCO)[number]

export const ROTULO_TIPO_BLOCO: Record<TipoBloco, string> = {
  abertura: 'Abertura',
  teoria: 'Teoria',
  pratica: 'Prática',
  perguntas: 'Perguntas',
  intervalo: 'Intervalo',
  margem: 'Margem',
}

type BlocoComDuracao = { duracao_min: number }

/**
 * PRD F18: ao salvar, a hora de início de cada bloco é a soma das durações
 * anteriores a partir do início do encontro. A ordem do array é a ordem final.
 */
export function recalcularBlocos<T extends BlocoComDuracao>(
  horaInicioEncontro: string,
  blocos: T[],
): (T & { ordem: number; hora_inicio: string })[] {
  let cursor = horaParaMinutos(horaInicioEncontro)
  return blocos.map((bloco, indice) => {
    const hora_inicio = minutosParaHora(cursor)
    cursor += bloco.duracao_min
    return { ...bloco, ordem: indice + 1, hora_inicio }
  })
}

export type ConferenciaDuracao = {
  totalBlocos: number
  totalEncontro: number
  /** Positivo: blocos passam do fim. Negativo: sobra tempo sem bloco. */
  diferenca: number
  fecha: boolean
}

/** Aviso não bloqueante quando a soma dos blocos não fecha com o encontro. */
export function conferirDuracao(
  horaInicio: string,
  horaFim: string,
  blocos: BlocoComDuracao[],
): ConferenciaDuracao {
  const totalEncontro = horaParaMinutos(horaFim) - horaParaMinutos(horaInicio)
  const totalBlocos = blocos.reduce((soma, b) => soma + b.duracao_min, 0)
  const diferenca = totalBlocos - totalEncontro
  return { totalBlocos, totalEncontro, diferenca, fecha: diferenca === 0 }
}

type BlocoAgendado = { hora_inicio: string; duracao_min: number }

/**
 * PRD F10: a pergunta guarda o bloco cujo intervalo contém o horário atual
 * (início inclusivo, fim exclusivo). Fora de qualquer bloco, retorna null.
 */
export function blocoAtivo<T extends BlocoAgendado>(blocos: T[], minutosAgora: number): T | null {
  return (
    blocos.find((b) => {
      const inicio = horaParaMinutos(b.hora_inicio)
      return minutosAgora >= inicio && minutosAgora < inicio + b.duracao_min
    }) ?? null
  )
}

/** Largura proporcional de cada bloco na régua do encontro, em %. */
export function proporcoesDaRegua(blocos: BlocoComDuracao[]): number[] {
  const total = blocos.reduce((soma, b) => soma + b.duracao_min, 0)
  if (total === 0) return blocos.map(() => 0)
  return blocos.map((b) => (b.duracao_min / total) * 100)
}
