import { describe, expect, it } from 'vitest'
import { contem, iniciais, percentualDe } from './busca'

describe('iniciais', () => {
  it('usa o primeiro e o último nome', () => {
    expect(iniciais('Ana Souza')).toBe('AS')
    expect(iniciais('  maria  da silva  santos ')).toBe('MS')
  })

  it('aceita um nome só e nome vazio', () => {
    expect(iniciais('Ana')).toBe('A')
    expect(iniciais('   ')).toBe('?')
  })
})

describe('contem', () => {
  it('ignora acentos e maiúsculas', () => {
    expect(contem('introducao', 'Introdução ao JavaScript')).toBe(true)
    expect(contem('JOÃO', 'joao silva')).toBe(true)
  })

  it('procura em vários campos e trata nulos', () => {
    expect(contem('web', null, undefined, 'Desenvolvimento Web')).toBe(true)
    expect(contem('css', 'HTML', null)).toBe(false)
  })

  it('termo vazio casa com tudo', () => {
    expect(contem('  ', 'qualquer')).toBe(true)
  })
})

describe('percentualDe', () => {
  it('arredonda e não divide por zero', () => {
    expect(percentualDe(1, 3)).toBe(33)
    expect(percentualDe(3, 3)).toBe(100)
    expect(percentualDe(0, 0)).toBe(0)
  })
})
