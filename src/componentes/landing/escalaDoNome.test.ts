import { describe, expect, it } from 'vitest'
import { COLUNAS_MINIMAS, escalaDoNome } from './escalaDoNome'

describe('escalaDoNome', () => {
  it('conta o nome inteiro para uma linha e a maior palavra para o empilhado', () => {
    expect(escalaDoNome('Vitor Ramos')).toEqual({
      palavras: ['Vitor', 'Ramos'],
      colunasEmLinha: 11,
      colunasEmpilhado: 5,
    })
  })

  it('ignora espaços sobrando no começo, no fim e entre as palavras', () => {
    const escala = escalaDoNome('  Ana   Maria  de Souza ')
    expect(escala.palavras).toEqual(['Ana', 'Maria', 'de', 'Souza'])
    expect(escala.colunasEmLinha).toBe('Ana Maria de Souza'.length)
    expect(escala.colunasEmpilhado).toBe(5)
  })

  it('nomes curtos respeitam o piso de colunas, para a letra não estourar a tela', () => {
    expect(escalaDoNome('Ana')).toEqual({
      palavras: ['Ana'],
      colunasEmLinha: COLUNAS_MINIMAS,
      colunasEmpilhado: COLUNAS_MINIMAS,
    })
  })

  it('nome vazio não quebra', () => {
    expect(escalaDoNome('').palavras).toEqual([])
    expect(escalaDoNome('').colunasEmLinha).toBe(COLUNAS_MINIMAS)
  })
})
