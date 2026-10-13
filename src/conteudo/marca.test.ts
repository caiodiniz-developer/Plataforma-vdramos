import { describe, expect, it } from 'vitest'
import { COMO_TRABALHO, GRANDES_NUMEROS, PROPOSTA_DE_VALOR, STACK, TRAJETORIA } from './marca'

/** Todo texto de marca que vai para a tela. */
const TEXTOS = [
  PROPOSTA_DE_VALOR,
  ...GRANDES_NUMEROS.flatMap((n) => [n.rotulo, n.detalhe]),
  ...TRAJETORIA.flatMap((m) => [m.titulo, ...m.atuacoes.flatMap((a) => [a.papel, a.resumo, ...a.pontos])]),
  ...COMO_TRABALHO.flatMap((c) => [c.titulo, c.texto]),
]

/**
 * Lista negra do módulo de voz (repositório jobs-xp-skills-vitor-ramos):
 * termos que denunciam texto genérico. Vale para tudo o que está neste arquivo.
 */
const LISTA_NEGRA = [
  /\bmergulh/i,
  /divisor de águas/i,
  /\bjornada\b/i,
  /revolucion/i,
  /disruptiv/i,
  /\bnotável\b/i,
  /fascinante/i,
  /\bcrucial\b/i,
  /potencializ/i,
  /alavanc/i,
  /no cenário atual/i,
  /em constante evolução/i,
  /ecossistema/i,
  /desbloque/i,
  /sinergia/i,
  /\brobust/i,
  /paradigma/i,
  /não (é|são) apenas/i,
  /não apenas/i,
]

describe('conteúdo de marca', () => {
  it('segue a voz: sem os clichês da lista negra, sem exclamação e sem emoji', () => {
    for (const texto of TEXTOS) {
      for (const termo of LISTA_NEGRA) expect(texto, `"${texto}" usa ${termo}`).not.toMatch(termo)
      expect(texto).not.toContain('!')
      expect(texto).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })

  it('frases curtas: nenhum texto passa de três frases', () => {
    for (const texto of TEXTOS) expect(texto.split(/[.?]\s/).length, texto).toBeLessThanOrEqual(3)
  })

  it('os cinco grandes números do briefing, com sinal e cor próprios', () => {
    expect(GRANDES_NUMEROS.map((n) => `${n.prefixo ?? ''}${n.valor}${n.sufixo ?? ''}`)).toEqual(['+15', '+50', '2', '7+', '3+'])
    expect(new Set(GRANDES_NUMEROS.map((n) => n.cor)).size).toBe(GRANDES_NUMEROS.length)
  })

  it('a trajetória tem os três momentos: o atual, o anterior e o paralelo', () => {
    expect(TRAJETORIA.map((m) => m.id)).toEqual(['engenharia', 'negocios', 'educacao'])
    expect(TRAJETORIA[0].atuacoes[0].organizacao).toBe('Apllos Solutions')
    expect(TRAJETORIA[1].atuacoes[0].organizacao).toBe('Claro Brasil')
    for (const m of TRAJETORIA) expect(m.atuacoes.length).toBeGreaterThan(0)
  })

  it('a stack tem os quatro grupos do briefing, sem item repetido', () => {
    expect(STACK.map((g) => g.titulo)).toEqual(['Cloud e plataformas', 'Processamento e storage', 'Linguagens e análise', 'Metodologias'])
    const itens = STACK.flatMap((g) => g.itens)
    expect(new Set(itens).size).toBe(itens.length)
  })
})
