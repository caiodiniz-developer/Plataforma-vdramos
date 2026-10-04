import { describe, expect, it } from 'vitest'
import { contraste, CORES, passaAA } from './contraste'

const { papel, tinta, branco, principal, laranja, roxo, verde, neutroClaro, neutroEscuro, cardEscuro, destrutivo } = CORES

describe('contraste', () => {
  it('reproduz os valores da revisão de marca do PRD', () => {
    expect(contraste(principal, papel)).toBeCloseTo(4.07, 2)
    expect(contraste(branco, principal)).toBeCloseTo(4.55, 2)
    expect(contraste(laranja, papel)).toBeCloseTo(2.97, 2)
    expect(contraste(tinta, laranja)).toBeCloseTo(5.25, 2)
    expect(contraste(tinta, verde)).toBeCloseTo(4.99, 2)
    expect(contraste(neutroEscuro, papel)).toBeCloseTo(1.49, 2)
  })

  it('é simétrico', () => {
    expect(contraste(papel, tinta)).toBe(contraste(tinta, papel))
  })
})

describe('combinações usadas na interface passam em AA', () => {
  it.each([
    ['texto Tinta sobre Papel', tinta, papel],
    ['texto Tinta sobre card branco', tinta, branco],
    ['texto secundário sobre Papel', neutroClaro, papel],
    ['texto secundário sobre card branco', neutroClaro, branco],
    ['botão azul: branco sobre azul', branco, principal],
    ['botão Tinta: Papel sobre Tinta', papel, tinta],
    ['badge laranja: Tinta sobre laranja', tinta, laranja],
    ['badge verde: Tinta sobre verde', tinta, verde],
    ['badge neutro: Tinta sobre neutro', tinta, neutroEscuro],
    ['tema escuro: Papel sobre card escuro', papel, cardEscuro],
    ['tema escuro: neutro sobre Tinta', neutroEscuro, tinta],
    ['frente escura: neutro sobre Tinta', neutroEscuro, tinta],
    ['erro: vermelho sobre Papel', destrutivo, papel],
    ['erro: branco sobre vermelho', branco, destrutivo],
  ])('%s', (_nome, texto, fundo) => {
    expect(passaAA(texto, fundo)).toBe(true)
  })

  it('azul só passa como texto grande', () => {
    expect(passaAA(principal, papel)).toBe(false)
    expect(passaAA(principal, papel, true)).toBe(true)
  })

  it('acentos sólidos não recebem texto Papel (por isso o guia foi corrigido)', () => {
    expect(passaAA(papel, laranja)).toBe(false)
    expect(passaAA(papel, verde)).toBe(false)
    expect(passaAA(papel, roxo)).toBe(false)
    // Tinta sobre azul também falha: a etiqueta azul usa texto branco.
    expect(passaAA(tinta, principal)).toBe(false)
  })
})
