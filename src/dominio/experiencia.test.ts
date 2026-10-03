import { describe, expect, it } from 'vitest'
import {
  abasVisiveis,
  experienciasDaLanding,
  periodoDaExperiencia,
  varianteDaTag,
  type Experiencia,
} from './experiencia'

function exp(parcial: Partial<Experiencia>): Experiencia {
  return {
    id: 'x',
    tipo: 'profissional',
    organizacao: 'Org',
    cargo: 'Cargo',
    local: null,
    data_inicio: '2020-01-01',
    data_fim: null,
    descricao: null,
    tags: [],
    ordem: 0,
    publicado: true,
    ...parcial,
  }
}

describe('experienciasDaLanding', () => {
  it('filtra por tipo e por publicado', () => {
    const lista = [
      exp({ id: 'a' }),
      exp({ id: 'b', publicado: false }),
      exp({ id: 'c', tipo: 'docencia' }),
    ]
    expect(experienciasDaLanding(lista, 'profissional').map((e) => e.id)).toEqual(['a'])
  })

  it('ordena por ordem e depois pela mais recente', () => {
    const lista = [
      exp({ id: 'antiga', data_inicio: '2018-03-01' }),
      exp({ id: 'recente', data_inicio: '2024-06-01' }),
      exp({ id: 'fixada-no-fim', ordem: 5, data_inicio: '2025-01-01' }),
    ]
    expect(experienciasDaLanding(lista, 'profissional').map((e) => e.id)).toEqual([
      'recente',
      'antiga',
      'fixada-no-fim',
    ])
  })
})

describe('abasVisiveis', () => {
  it('esconde a aba sem experiências publicadas', () => {
    expect(abasVisiveis([exp({})])).toEqual(['profissional'])
    expect(abasVisiveis([exp({}), exp({ tipo: 'docencia' })])).toEqual(['profissional', 'docencia'])
    expect(abasVisiveis([exp({ tipo: 'docencia', publicado: false })])).toEqual([])
  })
})

describe('periodoDaExperiencia', () => {
  it('mostra "atual" quando não há fim', () => {
    expect(periodoDaExperiencia('2022-03-01', null)).toBe('mar/2022 — atual')
    expect(periodoDaExperiencia('2022-03-01', '2024-10-31')).toBe('mar/2022 — out/2024')
  })
})

describe('varianteDaTag', () => {
  it('reconhece os temas do guia com ou sem acento', () => {
    expect(varianteDaTag('IA')).toBe('default')
    expect(varianteDaTag('Educação')).toBe('orange')
    expect(varianteDaTag('educacao')).toBe('orange')
    expect(varianteDaTag('Produto')).toBe('violet')
    expect(varianteDaTag('Engenharia')).toBe('green')
  })

  it('usa contorno para Dados e para tags fora do guia', () => {
    expect(varianteDaTag('Dados')).toBe('outline')
    expect(varianteDaTag('Excel')).toBe('outline')
  })
})
