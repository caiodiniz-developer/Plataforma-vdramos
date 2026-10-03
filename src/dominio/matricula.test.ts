import { describe, expect, it } from 'vitest'
import { matriculaValida, normalizarMatricula } from './matricula'

describe('normalizarMatricula', () => {
  it('remove espaços das pontas e passa para maiúsculas', () => {
    expect(normalizarMatricula('  ab-123 ')).toBe('AB-123')
  })
})

describe('matriculaValida', () => {
  it('aceita letras, números e separadores comuns', () => {
    expect(matriculaValida('2026.1/0042')).toBe(true)
    expect(matriculaValida('sn_778-a')).toBe(true)
  })

  it('rejeita vazio, espaço interno e caracteres fora do padrão', () => {
    expect(matriculaValida('')).toBe(false)
    expect(matriculaValida('12 34')).toBe(false)
    expect(matriculaValida('joão')).toBe(false)
    expect(matriculaValida('-123')).toBe(false)
  })

  it('rejeita mais de 40 caracteres', () => {
    expect(matriculaValida('A'.repeat(41))).toBe(false)
  })
})
