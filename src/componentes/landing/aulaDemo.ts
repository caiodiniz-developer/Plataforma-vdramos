import { blocoAtivo, type TipoBloco } from '@/dominio/blocos'
import { horaParaMinutos, minutosParaHora } from '@/dominio/tempo'

export type BlocoDemo = { hora_inicio: string; duracao_min: number; tipo: TipoBloco; titulo: string }

/** Encontro de demonstração da landing: 18:45–22:45, como no cronograma de referência. */
export const BLOCOS_DEMO: BlocoDemo[] = [
  { hora_inicio: '18:45', duracao_min: 15, tipo: 'abertura', titulo: 'Abertura' },
  { hora_inicio: '19:00', duracao_min: 60, tipo: 'teoria', titulo: 'Conceitos' },
  { hora_inicio: '20:00', duracao_min: 15, tipo: 'intervalo', titulo: 'Intervalo' },
  { hora_inicio: '20:15', duracao_min: 90, tipo: 'pratica', titulo: 'Prática guiada' },
  { hora_inicio: '21:45', duracao_min: 30, tipo: 'perguntas', titulo: 'Perguntas' },
  { hora_inicio: '22:15', duracao_min: 30, tipo: 'margem', titulo: 'Margem' },
]

export type MomentoDaAula = { hora: string; indice: number; bloco: BlocoDemo | null }

/**
 * Onde a aula está quando `progresso` (0 a 1) do encontro já passou: o horário
 * no relógio e o bloco em andamento. É o que liga a rolagem da página à régua
 * do encontro na prévia da sala. No fim (progresso 1) vale o último bloco.
 */
export function momentoDaAula(blocos: BlocoDemo[], progresso: number): MomentoDaAula {
  if (blocos.length === 0) return { hora: '00:00', indice: -1, bloco: null }
  const fracao = Math.min(1, Math.max(0, Number.isFinite(progresso) ? progresso : 0))
  const inicio = horaParaMinutos(blocos[0].hora_inicio)
  const total = blocos.reduce((soma, b) => soma + b.duracao_min, 0)
  const agora = inicio + Math.round(total * fracao)
  const bloco = blocoAtivo(blocos, agora) ?? blocos[blocos.length - 1]
  return { hora: minutosParaHora(agora), indice: blocos.indexOf(bloco), bloco }
}
