import { describe, expect, it } from 'vitest'
import { posicaoRelativa } from './interacoes'

const caixa = { left: 100, top: 50, width: 400, height: 200 }

describe('posicaoRelativa', () => {
  it('vale 0 no centro e ±1 nas bordas', () => {
    expect(posicaoRelativa({ x: 300, y: 150 }, caixa)).toEqual({ x: 0, y: 0 })
    expect(posicaoRelativa({ x: 100, y: 50 }, caixa)).toEqual({ x: -1, y: -1 })
    expect(posicaoRelativa({ x: 500, y: 250 }, caixa)).toEqual({ x: 1, y: 1 })
  })

  it('fica limitada quando o ponteiro sai da área', () => {
    expect(posicaoRelativa({ x: 9000, y: -9000 }, caixa)).toEqual({ x: 1, y: -1 })
  })

  it('área sem tamanho não gera divisão por zero', () => {
    expect(posicaoRelativa({ x: 10, y: 10 }, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 })
  })
})
