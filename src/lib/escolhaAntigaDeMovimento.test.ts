// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { apagarEscolhaAntigaDeMovimento, CHAVE_ANTIGA_DE_MOVIMENTO } from './escolhaAntigaDeMovimento'

afterEach(() => window.localStorage.clear())

describe('apagarEscolhaAntigaDeMovimento', () => {
  it.each(['essencial', 'nenhum', 'completo'])('apaga a escolha "%s" guardada por uma versão anterior', (valor) => {
    window.localStorage.setItem(CHAVE_ANTIGA_DE_MOVIMENTO, valor)
    apagarEscolhaAntigaDeMovimento()
    expect(window.localStorage.getItem(CHAVE_ANTIGA_DE_MOVIMENTO)).toBeNull()
  })

  it('não mexe em outras chaves do navegador', () => {
    window.localStorage.setItem('outra-chave', 'fica')
    apagarEscolhaAntigaDeMovimento()
    expect(window.localStorage.getItem('outra-chave')).toBe('fica')
  })

  it('não quebra quando o armazenamento está bloqueado', () => {
    const bloqueado = {
      removeItem() {
        throw new Error('bloqueado')
      },
    }
    expect(() => apagarEscolhaAntigaDeMovimento(bloqueado)).not.toThrow()
  })
})
