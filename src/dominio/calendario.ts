import { horaParaMinutos, momentoNoFuso } from './tempo'

export type EncontroAgendado = {
  id: string
  numero: number
  data: string
  hora_inicio: string
  hora_fim: string
  titulo: string
  descricao: string | null
  local: string | null
}

/**
 * Próximo encontro no fuso da turma: o primeiro que ainda não terminou.
 * Um encontro em andamento continua sendo "o próximo" até a hora de fim.
 */
export function proximoEncontro<T extends Pick<EncontroAgendado, 'data' | 'hora_fim'>>(
  encontros: T[],
  agora: Date,
  fuso: string,
): T | null {
  const local = momentoNoFuso(agora, fuso)
  const futuros = encontros
    .filter(
      (e) =>
        e.data > local.data ||
        (e.data === local.data && horaParaMinutos(e.hora_fim) > local.minutos),
    )
    .sort((a, b) => a.data.localeCompare(b.data))
  return futuros[0] ?? null
}

function escaparTexto(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** RFC 5545: linhas de até 75 octetos; continuação começa com um espaço. */
function dobrarLinha(linha: string): string {
  const codificador = new TextEncoder()
  if (codificador.encode(linha).length <= 75) return linha
  const partes: string[] = []
  let atual = ''
  for (const caractere of linha) {
    const limite = partes.length === 0 ? 75 : 74
    if (codificador.encode(atual + caractere).length > limite) {
      partes.push(atual)
      atual = caractere
    } else {
      atual += caractere
    }
  }
  partes.push(atual)
  return partes.join('\r\n ')
}

function dataHoraLocal(data: string, hora: string): string {
  const [h, m] = hora.split(':')
  return `${data.replace(/-/g, '')}T${h}${m}00`
}

function carimboUtc(instante: Date): string {
  return instante.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Deslocamento do fuso em relação a UTC numa data, no formato "-0300". */
function deslocamento(fuso: string, data: string): string {
  const meioDiaUtc = new Date(`${data}T12:00:00Z`)
  const local = momentoNoFuso(meioDiaUtc, fuso)
  let minutos = local.minutos - 12 * 60
  if (local.data > data) minutos += 1440
  if (local.data < data) minutos -= 1440
  const sinal = minutos < 0 ? '-' : '+'
  const abs = Math.abs(minutos)
  return `${sinal}${String(Math.floor(abs / 60)).padStart(2, '0')}${String(abs % 60).padStart(2, '0')}`
}

export type DadosCalendario = {
  nomeCurso: string
  codigoTurma: string
  fuso: string
  encontros: EncontroAgendado[]
}

/**
 * PRD F6: arquivo .ics com todos os encontros, com `TZID` da turma.
 * O bloco VTIMEZONE usa o deslocamento do fuso na data do primeiro encontro
 * (o Brasil não tem horário de verão desde 2019).
 */
export function gerarIcs(dados: DadosCalendario, geradoEm: Date): string {
  const { nomeCurso, codigoTurma, fuso, encontros } = dados
  const ordenados = [...encontros].sort((a, b) => a.data.localeCompare(b.data))
  const desloc = deslocamento(fuso, ordenados[0]?.data ?? geradoEm.toISOString().slice(0, 10))

  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vitor Ramos//Plataforma//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escaparTexto(nomeCurso)}`,
    `X-WR-TIMEZONE:${fuso}`,
    'BEGIN:VTIMEZONE',
    `TZID:${fuso}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    `TZOFFSETFROM:${desloc}`,
    `TZOFFSETTO:${desloc}`,
    'END:STANDARD',
    'END:VTIMEZONE',
  ]

  for (const e of ordenados) {
    linhas.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@vitorramos.com`,
      `DTSTAMP:${carimboUtc(geradoEm)}`,
      `DTSTART;TZID=${fuso}:${dataHoraLocal(e.data, e.hora_inicio)}`,
      `DTEND;TZID=${fuso}:${dataHoraLocal(e.data, e.hora_fim)}`,
      `SUMMARY:${escaparTexto(`${nomeCurso} — Encontro ${e.numero}: ${e.titulo}`)}`,
    )
    if (e.descricao) linhas.push(`DESCRIPTION:${escaparTexto(e.descricao)}`)
    if (e.local) linhas.push(`LOCATION:${escaparTexto(e.local)}`)
    linhas.push(`CATEGORIES:${escaparTexto(codigoTurma)}`, 'END:VEVENT')
  }

  linhas.push('END:VCALENDAR')
  return linhas.map(dobrarLinha).join('\r\n') + '\r\n'
}
