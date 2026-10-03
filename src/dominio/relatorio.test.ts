import { describe, expect, it } from 'vitest'
import {
  gerarCsv,
  media,
  nps,
  percentual,
  podeMostrarTextoLivre,
  satisfacaoPorEncontro,
} from './relatorio'

describe('gerarCsv', () => {
  it('usa ponto e vírgula, CRLF e BOM', () => {
    expect(gerarCsv(['nome', 'votos'], [['Ana', 2]])).toBe('﻿nome;votos\r\nAna;2\r\n')
  })

  it('protege aspas, quebras de linha e o separador', () => {
    const csv = gerarCsv(['texto'], [['disse "oi"; e saiu\nfim']])
    expect(csv).toContain('"disse ""oi""; e saiu\nfim"')
  })

  it('neutraliza fórmulas digitadas pelo aluno', () => {
    expect(gerarCsv(['texto'], [['=HYPERLINK("http://x")']])).toContain(`"'=HYPERLINK(""http://x"")"`)
    expect(gerarCsv(['texto'], [['+55 19']])).toContain("'+55 19")
  })

  it('escreve vazio para nulo e sim/não para booleano', () => {
    expect(gerarCsv(['a', 'b', 'c'], [[null, true, false]])).toContain('\r\n;sim;não\r\n')
  })
})

describe('podeMostrarTextoLivre', () => {
  it('esconde texto livre de atividade anônima com menos de 3 respostas', () => {
    expect(podeMostrarTextoLivre(true, 2)).toBe(false)
    expect(podeMostrarTextoLivre(true, 3)).toBe(true)
    expect(podeMostrarTextoLivre(false, 1)).toBe(true)
  })
})

describe('agregados', () => {
  it('média com uma casa e null sem respostas', () => {
    expect(media([4, 5, 5])).toBe(4.7)
    expect(media([3])).toBe(3)
    expect(media([])).toBeNull()
  })

  it('NPS pela regra de promotores e detratores', () => {
    expect(nps([10, 9, 8, 6])).toBe(25)
    expect(nps([0, 3, 6])).toBe(-100)
    expect(nps([])).toBeNull()
  })

  it('percentual sem dividir por zero', () => {
    expect(percentual(3, 4)).toBe(75)
    expect(percentual(0, 0)).toBeNull()
  })
})

describe('satisfacaoPorEncontro', () => {
  it('agrupa teoria e prática e deixa lacuna onde não houve pesquisa', () => {
    expect(
      satisfacaoPorEncontro([
        { encontro_numero: 2, tipo_bloco: 'teoria', media: 4.2 },
        { encontro_numero: 1, tipo_bloco: 'pratica', media: 4.8 },
        { encontro_numero: 1, tipo_bloco: 'teoria', media: 4.5 },
      ]),
    ).toEqual([
      { encontro: 'Encontro 1', teoria: 4.5, pratica: 4.8 },
      { encontro: 'Encontro 2', teoria: 4.2, pratica: null },
    ])
  })
})
