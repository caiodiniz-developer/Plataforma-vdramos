import { describe, expect, it } from 'vitest'
import { emailValido, mascararEmail, normalizarEmail } from './email'

describe('emailValido', () => {
  it('aceita endereço comum e rejeita formatos quebrados', () => {
    expect(emailValido('vitor@gmail.com')).toBe(true)
    expect(emailValido(' vitor@gmail.com ')).toBe(true)
    expect(emailValido('vitor@gmail')).toBe(false)
    expect(emailValido('vitor gmail.com')).toBe(false)
    expect(emailValido('')).toBe(false)
  })
})

describe('normalizarEmail', () => {
  it('tira espaços e passa para minúsculas', () => {
    expect(normalizarEmail('  Vitor@Gmail.COM ')).toBe('vitor@gmail.com')
  })
})

describe('mascararEmail', () => {
  it('mostra só a primeira letra e o domínio', () => {
    expect(mascararEmail('vitor@gmail.com')).toBe('v•••@gmail.com')
  })

  it('não revela o tamanho do usuário', () => {
    expect(mascararEmail('a@x.com')).toBe('a•••@x.com')
  })

  it('não quebra com valor inválido', () => {
    expect(mascararEmail('sem-arroba')).toBe('•••')
  })
})
