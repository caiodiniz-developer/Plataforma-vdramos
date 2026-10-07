import { describe, expect, it } from 'vitest'
import { conferirDuracao } from '@/dominio/blocos'
import { BLOCOS_DEMO, momentoDaAula } from './aulaDemo'

describe('encontro de demonstração', () => {
  it('os blocos fecham exatamente com o horário 18:45–22:45', () => {
    expect(conferirDuracao('18:45', '22:45', BLOCOS_DEMO).fecha).toBe(true)
  })
})

describe('momentoDaAula', () => {
  it('começa na abertura, no horário de início', () => {
    expect(momentoDaAula(BLOCOS_DEMO, 0)).toMatchObject({ hora: '18:45', indice: 0 })
  })

  it('na metade do encontro está na prática guiada', () => {
    const momento = momentoDaAula(BLOCOS_DEMO, 0.5)
    expect(momento.hora).toBe('20:45')
    expect(momento.bloco?.titulo).toBe('Prática guiada')
  })

  it('troca de bloco exatamente na virada do horário', () => {
    // 15 de 240 minutos: fim da abertura, início dos conceitos.
    expect(momentoDaAula(BLOCOS_DEMO, 15 / 240).bloco?.titulo).toBe('Conceitos')
    expect(momentoDaAula(BLOCOS_DEMO, 14 / 240).bloco?.titulo).toBe('Abertura')
  })

  it('no fim mostra o horário de término e o último bloco', () => {
    expect(momentoDaAula(BLOCOS_DEMO, 1)).toMatchObject({ hora: '22:45', indice: BLOCOS_DEMO.length - 1 })
  })

  it('limita progresso fora da faixa e valores inválidos', () => {
    expect(momentoDaAula(BLOCOS_DEMO, -3).hora).toBe('18:45')
    expect(momentoDaAula(BLOCOS_DEMO, 7).hora).toBe('22:45')
    expect(momentoDaAula(BLOCOS_DEMO, Number.NaN).hora).toBe('18:45')
  })

  it('sem blocos não quebra', () => {
    expect(momentoDaAula([], 0.5)).toEqual({ hora: '00:00', indice: -1, bloco: null })
  })
})
