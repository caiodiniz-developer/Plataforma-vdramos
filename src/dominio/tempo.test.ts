import { describe, expect, it } from 'vitest'
import {
  diaDaSemana,
  formatarData,
  formatarDataHora,
  formatarHora,
  horaParaMinutos,
  minutosParaHora,
  momentoNoFuso,
} from './tempo'

describe('horários', () => {
  it('converte hora em minutos e de volta', () => {
    expect(horaParaMinutos('18:45')).toBe(1125)
    expect(horaParaMinutos('18:45:00')).toBe(1125)
    expect(minutosParaHora(1125)).toBe('18:45')
    expect(minutosParaHora(1365)).toBe('22:45')
  })

  it('rejeita hora fora do intervalo', () => {
    expect(() => horaParaMinutos('24:00')).toThrow()
    expect(() => horaParaMinutos('abc')).toThrow()
  })

  it('exibe em 24h sem segundos', () => {
    expect(formatarHora('08:05:00')).toBe('08:05')
  })
})

describe('datas', () => {
  it('formata em DD/MM/AAAA', () => {
    expect(formatarData('2026-10-14')).toBe('14/10/2026')
  })

  it('calcula o dia da semana sem depender do fuso do aparelho', () => {
    expect(diaDaSemana('2026-10-14')).toBe('quarta-feira')
    expect(diaDaSemana('2026-10-28')).toBe('quarta-feira')
  })
})

describe('fuso da turma', () => {
  it('converte um instante UTC para a data e hora locais', () => {
    // 01:30 UTC do dia 15 ainda é dia 14, 22:30, em São Paulo (UTC-3).
    const m = momentoNoFuso(new Date('2026-10-15T01:30:00Z'), 'America/Sao_Paulo')
    expect(m).toEqual({ data: '2026-10-14', minutos: 22 * 60 + 30 })
  })

  it('formata timestamp no fuso da turma', () => {
    expect(formatarDataHora('2026-10-15T01:30:00Z', 'America/Sao_Paulo')).toBe('14/10/2026 22:30')
    expect(formatarDataHora('2026-10-15T01:30:00Z', 'America/Manaus')).toBe('14/10/2026 21:30')
  })
})
