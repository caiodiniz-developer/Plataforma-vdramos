import { describe, expect, it } from 'vitest'
import { blocoAtivo, conferirDuracao, proporcoesDaRegua, recalcularBlocos } from './blocos'

// Encontro de referência do PRD: 18:45–22:45 (240 min).
const blocos = [
  { titulo: 'Abertura', duracao_min: 15 },
  { titulo: 'Teoria', duracao_min: 60 },
  { titulo: 'Intervalo', duracao_min: 15 },
  { titulo: 'Prática', duracao_min: 120 },
  { titulo: 'Perguntas', duracao_min: 30 },
]

describe('recalcularBlocos', () => {
  it('encadeia os horários a partir do início do encontro', () => {
    const r = recalcularBlocos('18:45', blocos)
    expect(r.map((b) => b.hora_inicio)).toEqual(['18:45', '19:00', '20:00', '20:15', '22:15'])
    expect(r.map((b) => b.ordem)).toEqual([1, 2, 3, 4, 5])
  })

  it('preserva os outros campos do bloco', () => {
    expect(recalcularBlocos('18:45:00', blocos)[1].titulo).toBe('Teoria')
  })
})

describe('conferirDuracao', () => {
  it('fecha quando a soma bate com o encontro', () => {
    expect(conferirDuracao('18:45', '22:45', blocos)).toEqual({
      totalBlocos: 240,
      totalEncontro: 240,
      diferenca: 0,
      fecha: true,
    })
  })

  it('informa sobra e estouro', () => {
    expect(conferirDuracao('18:45', '22:45', blocos.slice(0, 4)).diferenca).toBe(-30)
    expect(conferirDuracao('18:45', '22:00', blocos).diferenca).toBe(45)
  })
})

describe('blocoAtivo', () => {
  const agendados = recalcularBlocos('18:45', blocos)

  it('acha o bloco que contém o horário, com fim exclusivo', () => {
    expect(blocoAtivo(agendados, 19 * 60)?.titulo).toBe('Teoria')
    expect(blocoAtivo(agendados, 19 * 60 + 59)?.titulo).toBe('Teoria')
    expect(blocoAtivo(agendados, 20 * 60)?.titulo).toBe('Intervalo')
  })

  it('retorna null fora do encontro', () => {
    expect(blocoAtivo(agendados, 18 * 60)).toBeNull()
    expect(blocoAtivo(agendados, 22 * 60 + 45)).toBeNull()
  })
})

describe('proporcoesDaRegua', () => {
  it('distribui a largura pela duração', () => {
    expect(proporcoesDaRegua(blocos)).toEqual([6.25, 25, 6.25, 50, 12.5])
  })

  it('não divide por zero', () => {
    expect(proporcoesDaRegua([])).toEqual([])
  })
})
