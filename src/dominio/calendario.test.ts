import { describe, expect, it } from 'vitest'
import { gerarIcs, proximoEncontro, type EncontroAgendado } from './calendario'

const FUSO = 'America/Sao_Paulo'

// Cronograma de referência do PRD: 5 encontros de 14/10 a 28/10/2026, 18:45–22:45.
const encontros: EncontroAgendado[] = ['2026-10-14', '2026-10-19', '2026-10-21', '2026-10-26', '2026-10-28'].map(
  (data, i) => ({
    id: `enc-${i + 1}`,
    numero: i + 1,
    data,
    hora_inicio: '18:45:00',
    hora_fim: '22:45:00',
    titulo: `SA${i + 1}`,
    descricao: null,
    local: 'Laboratório 3',
  }),
)

describe('proximoEncontro', () => {
  it('antes do curso, é o primeiro', () => {
    expect(proximoEncontro(encontros, new Date('2026-10-01T12:00:00Z'), FUSO)?.numero).toBe(1)
  })

  it('durante a aula, continua sendo o encontro em andamento', () => {
    // 20:00 em São Paulo no dia 14.
    expect(proximoEncontro(encontros, new Date('2026-10-14T23:00:00Z'), FUSO)?.numero).toBe(1)
  })

  it('depois do fim da aula, passa para o seguinte', () => {
    // 23:00 em São Paulo no dia 14 = 02:00 UTC do dia 15.
    expect(proximoEncontro(encontros, new Date('2026-10-15T02:00:00Z'), FUSO)?.numero).toBe(2)
  })

  it('usa o fuso da turma, não o UTC', () => {
    // 01:00 UTC do dia 15 ainda é 22:00 do dia 14 em São Paulo: aula em andamento.
    expect(proximoEncontro(encontros, new Date('2026-10-15T01:00:00Z'), FUSO)?.numero).toBe(1)
  })

  it('retorna null quando o curso acabou', () => {
    expect(proximoEncontro(encontros, new Date('2026-11-01T12:00:00Z'), FUSO)).toBeNull()
  })
})

describe('gerarIcs', () => {
  const ics = gerarIcs(
    { nomeCurso: 'Excel Básico com IA Generativa', codigoTurma: 'EXCIA-CPS-2610', fuso: FUSO, encontros },
    new Date('2026-10-01T12:00:00Z'),
  )

  it('tem um evento por encontro', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(5)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('usa o TZID e o horário local da turma', () => {
    expect(ics).toContain('DTSTART;TZID=America/Sao_Paulo:20261014T184500')
    expect(ics).toContain('DTEND;TZID=America/Sao_Paulo:20261014T224500')
    expect(ics).toContain('TZID:America/Sao_Paulo')
    expect(ics).toContain('TZOFFSETTO:-0300')
  })

  it('escapa vírgulas e não passa de 75 octetos por linha', () => {
    const comVirgula = gerarIcs(
      {
        nomeCurso: 'Curso',
        codigoTurma: 'ABCD',
        fuso: FUSO,
        encontros: [
          {
            ...encontros[0],
            titulo: 'Estruturação de dados, IA ética e uma descrição propositalmente longa para dobrar',
            local: 'Sala 2, bloco B',
          },
        ],
      },
      new Date('2026-10-01T12:00:00Z'),
    )
    expect(comVirgula).toContain('LOCATION:Sala 2\\, bloco B')
    const octetos = comVirgula.split('\r\n').map((l) => new TextEncoder().encode(l).length)
    expect(Math.max(...octetos)).toBeLessThanOrEqual(75)
  })
})
