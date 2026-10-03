import { describe, expect, it } from 'vitest'
import {
  esperaParaEnviar,
  mensagemValida,
  ordenarFeed,
  tipoDaMensagem,
  trechosDaMensagem,
} from './mensagem'

describe('tipoDaMensagem', () => {
  it('marca como link quando o texto é só uma URL', () => {
    expect(tipoDaMensagem(' https://exemplo.com/planilha ')).toBe('link')
  })

  it('texto com URL no meio continua texto', () => {
    expect(tipoDaMensagem('veja https://exemplo.com')).toBe('texto')
    expect(tipoDaMensagem('javascript:alert(1)')).toBe('texto')
  })
})

describe('mensagemValida', () => {
  it('exige de 1 a 1000 caracteres úteis', () => {
    expect(mensagemValida('   ')).toBe(false)
    expect(mensagemValida('a')).toBe(true)
    expect(mensagemValida('a'.repeat(1000))).toBe(true)
    expect(mensagemValida('a'.repeat(1001))).toBe(false)
  })
})

describe('esperaParaEnviar', () => {
  it('libera a primeira mensagem e segura as seguintes por 5 s', () => {
    expect(esperaParaEnviar(null, 10_000)).toBe(0)
    expect(esperaParaEnviar(10_000, 12_000)).toBe(3000)
    expect(esperaParaEnviar(10_000, 15_000)).toBe(0)
    expect(esperaParaEnviar(10_000, 60_000)).toBe(0)
  })
})

describe('trechosDaMensagem', () => {
  it('separa texto e links', () => {
    expect(trechosDaMensagem('veja https://exemplo.com/a e responda')).toEqual([
      { tipo: 'texto', valor: 'veja ' },
      { tipo: 'link', valor: 'https://exemplo.com/a' },
      { tipo: 'texto', valor: ' e responda' },
    ])
  })

  it('deixa a pontuação final fora do link', () => {
    expect(trechosDaMensagem('abra https://exemplo.com.')).toEqual([
      { tipo: 'texto', valor: 'abra ' },
      { tipo: 'link', valor: 'https://exemplo.com' },
      { tipo: 'texto', valor: '.' },
    ])
  })

  it('mantém HTML e script como texto puro', () => {
    const html = '<script>alert(1)</script> <a href="javascript:x">oi</a>'
    expect(trechosDaMensagem(html)).toEqual([{ tipo: 'texto', valor: html }])
  })
})

describe('ordenarFeed', () => {
  it('esconde removidas e sobe as fixadas', () => {
    const feed = ordenarFeed([
      { id: 1, fixada: false, removida: false, created_at: '2026-10-14T22:00:00Z' },
      { id: 2, fixada: false, removida: true, created_at: '2026-10-14T22:01:00Z' },
      { id: 3, fixada: true, removida: false, created_at: '2026-10-14T22:02:00Z' },
      { id: 4, fixada: false, removida: false, created_at: '2026-10-14T21:59:00Z' },
    ])
    expect(feed.map((m) => m.id)).toEqual([3, 4, 1])
  })
})
