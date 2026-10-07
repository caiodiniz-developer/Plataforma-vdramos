// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHAVE_DA_ESCOLHA,
  escolherNivel,
  iniciarNivelDeMovimento,
  lerEscolha,
  nivelDeMovimento,
  nivelFoiEscolhido,
  resolverNivel,
} from './nivelDeMovimento'

function sistema(pedeReducao: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: pedeReducao && consulta.includes('reduce'),
    media: consulta,
    addEventListener() {},
    removeEventListener() {},
  }))
}

afterEach(() => {
  escolherNivel(null)
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

describe('resolverNivel', () => {
  it('sem escolha, segue o sistema: reduzido vira essencial, não parado', () => {
    expect(resolverNivel(null, false)).toBe('completo')
    expect(resolverNivel(null, true)).toBe('essencial')
  })

  it('a escolha da pessoa vence o sistema, nos dois sentidos', () => {
    expect(resolverNivel('completo', true)).toBe('completo')
    expect(resolverNivel('nenhum', false)).toBe('nenhum')
    expect(resolverNivel('essencial', false)).toBe('essencial')
  })
})

describe('lerEscolha', () => {
  it('devolve null sem valor guardado ou com valor desconhecido', () => {
    expect(lerEscolha(window.localStorage)).toBeNull()
    window.localStorage.setItem(CHAVE_DA_ESCOLHA, 'turbo')
    expect(lerEscolha(window.localStorage)).toBeNull()
  })

  it('não quebra quando o armazenamento está bloqueado', () => {
    const bloqueado = {
      getItem(): string | null {
        throw new Error('bloqueado')
      },
      setItem() {},
      removeItem() {},
    }
    expect(lerEscolha(bloqueado)).toBeNull()
    expect(lerEscolha(undefined)).toBeNull()
  })
})

describe('nível de movimento da página', () => {
  it('marca o <html> com o nível do sistema ao iniciar', () => {
    sistema(true)
    iniciarNivelDeMovimento()
    expect(document.documentElement.dataset.movimento).toBe('essencial')
    expect(nivelDeMovimento()).toBe('essencial')
    expect(nivelFoiEscolhido()).toBe(false)

    sistema(false)
    iniciarNivelDeMovimento()
    expect(document.documentElement.dataset.movimento).toBe('completo')
  })

  it('a escolha é guardada, marca o <html> e sobrevive a uma nova carga', () => {
    sistema(true)
    iniciarNivelDeMovimento()
    escolherNivel('completo')
    expect(window.localStorage.getItem(CHAVE_DA_ESCOLHA)).toBe('completo')
    expect(document.documentElement.dataset.movimento).toBe('completo')
    expect(nivelFoiEscolhido()).toBe(true)

    // Nova carga da página: a escolha guardada continua valendo sobre o sistema.
    iniciarNivelDeMovimento()
    expect(nivelDeMovimento()).toBe('completo')
  })

  it('voltar a seguir o sistema apaga a escolha guardada', () => {
    sistema(true)
    iniciarNivelDeMovimento()
    escolherNivel('nenhum')
    expect(nivelDeMovimento()).toBe('nenhum')

    escolherNivel(null)
    expect(window.localStorage.getItem(CHAVE_DA_ESCOLHA)).toBeNull()
    expect(nivelDeMovimento()).toBe('essencial')
  })
})
