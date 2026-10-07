import { describe, expect, it } from 'vitest'
import {
  CHAVE_DA_ABERTURA,
  deveAbrir,
  marcarAberturaVista,
  registrarFimDaAbertura,
  tempoRestanteDaAbertura,
  textoDoContador,
} from './aberturaDaPagina'

function guardaEmMemoria() {
  const dados = new Map<string, string>()
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void dados.set(chave, valor),
  }
}

describe('deveAbrir', () => {
  it('abre na primeira carga da sessão', () => {
    expect(deveAbrir(guardaEmMemoria())).toBe(true)
  })

  it('não repete na mesma sessão', () => {
    const guarda = guardaEmMemoria()
    marcarAberturaVista(guarda)
    expect(guarda.getItem(CHAVE_DA_ABERTURA)).toBe('1')
    expect(deveAbrir(guarda)).toBe(false)
  })

  it('sem armazenamento, não abre (para não repetir a cada tela)', () => {
    const bloqueada = {
      getItem(): string | null {
        throw new Error('bloqueado')
      },
      setItem() {
        throw new Error('bloqueado')
      },
    }
    expect(deveAbrir(bloqueada)).toBe(false)
    expect(() => marcarAberturaVista(bloqueada)).not.toThrow()
  })
})

describe('textoDoContador', () => {
  it('vai de 000 a 100 com três dígitos', () => {
    expect(textoDoContador(0)).toBe('000')
    expect(textoDoContador(0.074)).toBe('007')
    expect(textoDoContador(0.5)).toBe('050')
    expect(textoDoContador(1)).toBe('100')
  })

  it('limita valores fora da faixa', () => {
    expect(textoDoContador(-1)).toBe('000')
    expect(textoDoContador(3)).toBe('100')
    expect(textoDoContador(Number.NaN)).toBe('000')
  })
})

describe('tempoRestanteDaAbertura', () => {
  it('diz quanto falta para a cortina sair e nunca é negativo', () => {
    registrarFimDaAbertura(5000)
    expect(tempoRestanteDaAbertura(3400)).toBeCloseTo(1.6)
    expect(tempoRestanteDaAbertura(9000)).toBe(0)
    registrarFimDaAbertura(0)
  })
})
