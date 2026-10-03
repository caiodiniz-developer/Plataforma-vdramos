import { describe, expect, it } from 'vitest'
import { autorExibido, ordenarMural, perguntaValida } from './pergunta'

describe('perguntaValida', () => {
  it('exige de 3 a 500 caracteres úteis', () => {
    expect(perguntaValida(' ab ')).toBe(false)
    expect(perguntaValida('abc')).toBe(true)
    expect(perguntaValida('a'.repeat(500))).toBe(true)
    expect(perguntaValida('a'.repeat(501))).toBe(false)
  })
})

describe('ordenarMural', () => {
  it('ordena por votos e desempata pela mais antiga', () => {
    const mural = ordenarMural([
      { id: 'a', votos: 1, created_at: '2026-10-14T22:00:00Z' },
      { id: 'b', votos: 3, created_at: '2026-10-14T22:05:00Z' },
      { id: 'c', votos: 1, created_at: '2026-10-14T21:50:00Z' },
    ])
    expect(mural.map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('não altera a lista original', () => {
    const original = [
      { votos: 0, created_at: '2' },
      { votos: 5, created_at: '1' },
    ]
    ordenarMural(original)
    expect(original[0].votos).toBe(0)
  })
})

describe('autorExibido', () => {
  it('esconde o nome em pergunta anônima', () => {
    expect(autorExibido(true, 'Ana Souza')).toBe('Anônimo')
    expect(autorExibido(false, 'Ana Souza')).toBe('Ana Souza')
    expect(autorExibido(false, null)).toBe('Anônimo')
  })
})
