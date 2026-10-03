import { describe, expect, it } from 'vitest'
import { codigoTurmaValido, sugerirCodigoTurma, turmaSomenteLeitura } from './turma'

describe('codigoTurmaValido', () => {
  it('aceita maiúsculas, números e hífen entre 4 e 20 caracteres', () => {
    expect(codigoTurmaValido('EXCIA-CPS-2610')).toBe(true)
    expect(codigoTurmaValido('AB12')).toBe(true)
  })

  it('rejeita minúsculas, espaço, tamanho fora do limite', () => {
    expect(codigoTurmaValido('excia-cps')).toBe(false)
    expect(codigoTurmaValido('AB 12')).toBe(false)
    expect(codigoTurmaValido('ABC')).toBe(false)
    expect(codigoTurmaValido('A'.repeat(21))).toBe(false)
  })
})

describe('sugerirCodigoTurma', () => {
  it('gera o exemplo do PRD', () => {
    expect(sugerirCodigoTurma('Excel Básico com IA Generativa', 'Campinas', '2026-10-14')).toBe(
      'EXCIA-CPS-2610',
    )
  })

  it('usa iniciais quando o nome não tem sigla', () => {
    expect(sugerirCodigoTurma('Análise de Dados', 'Sorocaba', '2027-03-02')).toBe('ANAD-SOR-2703')
  })

  it('sempre devolve um código válido', () => {
    const codigo = sugerirCodigoTurma(
      'Fundamentos de Engenharia de Dados para Produto',
      'São José dos Campos',
      '2026-11-09',
    )
    expect(codigoTurmaValido(codigo)).toBe(true)
  })
})

describe('turmaSomenteLeitura', () => {
  it('só a turma encerrada é somente leitura', () => {
    expect(turmaSomenteLeitura('encerrada')).toBe(true)
    expect(turmaSomenteLeitura('ativa')).toBe(false)
    expect(turmaSomenteLeitura('planejada')).toBe(false)
  })
})
