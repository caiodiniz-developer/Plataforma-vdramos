/** Horários do banco chegam como "HH:MM" ou "HH:MM:SS" (tipo `time`). */
export function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`Hora inválida: ${hora}`)
  }
  return h * 60 + m
}

export function minutosParaHora(minutos: number): string {
  const total = ((minutos % 1440) + 1440) % 1440
  const h = String(Math.floor(total / 60)).padStart(2, '0')
  const m = String(total % 60).padStart(2, '0')
  return `${h}:${m}`
}

/** "18:45:00" → "18:45" (exibição em 24h). */
export function formatarHora(hora: string): string {
  return minutosParaHora(horaParaMinutos(hora))
}

/** "2026-10-14" → "14/10/2026". */
export function formatarData(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

const DIAS_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]

/** Dia da semana de uma data de calendário, sem depender de fuso. */
export function diaDaSemana(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-').map(Number)
  return DIAS_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()]
}

export type MomentoLocal = {
  /** Data de calendário no fuso, "AAAA-MM-DD". */
  data: string
  /** Minutos desde a meia-noite no fuso. */
  minutos: number
}

/**
 * Converte um instante para a data e a hora locais de um fuso IANA.
 * Usado para "próximo encontro" e "bloco ativo", que o PRD manda calcular
 * no fuso da turma, não no do aparelho do aluno.
 */
export function momentoNoFuso(instante: Date, fuso: string): MomentoLocal {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante)
  const p = (tipo: string) => partes.find((x) => x.type === tipo)!.value
  return {
    data: `${p('year')}-${p('month')}-${p('day')}`,
    minutos: Number(p('hour')) * 60 + Number(p('minute')),
  }
}

/** Timestamp UTC do banco exibido como "DD/MM/AAAA HH:MM" no fuso da turma. */
export function formatarDataHora(instanteIso: string, fuso: string): string {
  const m = momentoNoFuso(new Date(instanteIso), fuso)
  return `${formatarData(m.data)} ${minutosParaHora(m.minutos)}`
}
