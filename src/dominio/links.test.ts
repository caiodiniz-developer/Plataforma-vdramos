import { describe, expect, it } from 'vitest'
import { marcacaoDeLink, partesDoTexto } from './links'

describe('partesDoTexto', () => {
  it('texto sem link volta inteiro', () => {
    expect(partesDoTexto('Tudo certo.')).toEqual([{ tipo: 'texto', texto: 'Tudo certo.' }])
    expect(partesDoTexto('')).toEqual([])
  })

  it('aceita vários links, soltos e com rótulo, na ordem', () => {
    expect(partesDoTexto('Veja [a apostila](https://exemplo.com/a.pdf) e https://exemplo.com/video depois.')).toEqual([
      { tipo: 'texto', texto: 'Veja ' },
      { tipo: 'link', texto: 'a apostila', url: 'https://exemplo.com/a.pdf' },
      { tipo: 'texto', texto: ' e ' },
      { tipo: 'link', texto: 'https://exemplo.com/video', url: 'https://exemplo.com/video' },
      { tipo: 'texto', texto: ' depois.' },
    ])
  })

  it('a pontuação no fim do endereço fica com a frase', () => {
    expect(partesDoTexto('Leia https://exemplo.com/x?a=1.')).toEqual([
      { tipo: 'texto', texto: 'Leia ' },
      { tipo: 'link', texto: 'https://exemplo.com/x?a=1', url: 'https://exemplo.com/x?a=1' },
      { tipo: 'texto', texto: '.' },
    ])
  })

  it('só http e https viram link', () => {
    const partes = partesDoTexto('[clique](javascript:alert(1)) ftp://arquivo mailto:a@b.com')
    expect(partes.every((p) => p.tipo === 'texto')).toBe(true)
  })

  it('mantém as quebras de linha no texto', () => {
    expect(partesDoTexto('linha 1\nhttps://exemplo.com\nlinha 3').map((p) => p.texto)).toEqual(['linha 1\n', 'https://exemplo.com', '\nlinha 3'])
  })
})

describe('marcacaoDeLink', () => {
  it('monta o trecho com rótulo e completa o https', () => {
    expect(marcacaoDeLink('Apostila', 'exemplo.com/a.pdf')).toBe('[Apostila](https://exemplo.com/a.pdf)')
    expect(marcacaoDeLink('', ' https://exemplo.com ')).toBe('https://exemplo.com')
  })

  it('o que ele monta é lido de volta como link', () => {
    const trecho = marcacaoDeLink('Guia [novo]', 'https://exemplo.com/guia')!
    expect(partesDoTexto(trecho)).toEqual([{ tipo: 'link', texto: 'Guia  novo ', url: 'https://exemplo.com/guia' }])
  })

  it('recusa endereço vazio, sem domínio ou com espaço', () => {
    expect(marcacaoDeLink('x', '')).toBeNull()
    expect(marcacaoDeLink('x', 'semdominio')).toBeNull()
    expect(marcacaoDeLink('x', 'exemplo.com/a b')).toBeNull()
    expect(marcacaoDeLink('x', 'javascript:alert(1)')).toBeNull()
  })
})
