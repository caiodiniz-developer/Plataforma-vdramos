import { describe, expect, it } from 'vitest'
import { previaImportacao } from './importar-ids'

describe('previaImportacao', () => {
  it('lê um ID por linha com nome opcional após ponto e vírgula', () => {
    const p = previaImportacao('a100;Ana Souza\nA101\n', [])
    expect(p.novos).toEqual([
      { matricula: 'A100', nome_referencia: 'Ana Souza' },
      { matricula: 'A101', nome_referencia: null },
    ])
  })

  it('lê CSV matricula,nome e ignora o cabeçalho', () => {
    const p = previaImportacao('matricula,nome\r\n2026-01,"Bruno Lima"\r\n2026-02,Carla', [])
    expect(p.novos.map((n) => n.matricula)).toEqual(['2026-01', '2026-02'])
    expect(p.novos[0].nome_referencia).toBe('Bruno Lima')
    expect(p.invalidos).toEqual([])
  })

  it('ignora linhas vazias', () => {
    expect(previaImportacao('\n\nA1\n   \nA2\n', []).novos).toHaveLength(2)
  })

  it('conta duplicados dentro da lista uma vez só', () => {
    const p = previaImportacao('A1\na1 \nA1;Outro nome\nA2', [])
    expect(p.novos.map((n) => n.matricula)).toEqual(['A1', 'A2'])
    expect(p.duplicadosNaLista).toBe(2)
  })

  it('separa os IDs que a turma já tem', () => {
    const p = previaImportacao('A1\nA2\nA3', ['a2'])
    expect(p.novos.map((n) => n.matricula)).toEqual(['A1', 'A3'])
    expect(p.existentes.map((n) => n.matricula)).toEqual(['A2'])
  })

  it('lista as linhas fora do padrão com o número da linha', () => {
    const p = previaImportacao('A1\nid com espaço\n@@@;Fulano', [])
    expect(p.invalidos).toEqual([
      { linha: 2, conteudo: 'id com espaço' },
      { linha: 3, conteudo: '@@@;Fulano' },
    ])
    expect(p.novos).toHaveLength(1)
  })
})
