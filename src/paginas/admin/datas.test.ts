import { describe, expect, it } from 'vitest'
import { paraCampoDeData, paraInstante } from './datas'

describe('datas dos formulários do professor', () => {
  it('campo vazio vira nulo (sem prazo, sem agendamento)', () => {
    expect(paraInstante('')).toBeNull()
    expect(paraCampoDeData(null)).toBe('')
  })

  it('valor inválido não quebra o formulário', () => {
    expect(paraInstante('não é data')).toBeNull()
    expect(paraCampoDeData('não é data')).toBe('')
  })

  it('ida e volta preserva o minuto escolhido, em qualquer fuso', () => {
    const campo = '2026-10-20T19:30'
    const instante = paraInstante(campo)
    expect(instante).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/)
    expect(paraCampoDeData(instante)).toBe(campo)
  })
})
