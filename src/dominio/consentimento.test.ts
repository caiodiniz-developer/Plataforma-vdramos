import { describe, expect, it } from 'vitest'
import {
  concedeu,
  consentimentoVigente,
  consentimentosDoCadastro,
  precisaAceitarTermo,
  type Consentimento,
} from './consentimento'

function registro(parcial: Partial<Consentimento>): Consentimento {
  return {
    finalidade: 'comunicacao_professor',
    concedido: true,
    versao_termo: '2026-10-v1',
    origem: 'cadastro',
    created_at: '2026-10-14T22:00:00Z',
    ...parcial,
  }
}

describe('consentimentoVigente', () => {
  it('vale o registro mais recente da finalidade', () => {
    const historico = [
      registro({ concedido: true, created_at: '2026-10-14T22:00:00Z' }),
      registro({ concedido: false, origem: 'area_aluno', created_at: '2026-10-20T10:00:00Z' }),
      registro({ finalidade: 'uso_dados_pedagogicos', created_at: '2026-10-25T10:00:00Z' }),
    ]
    expect(consentimentoVigente(historico, 'comunicacao_professor')?.concedido).toBe(false)
    expect(concedeu(historico, 'comunicacao_professor')).toBe(false)
    expect(concedeu(historico, 'uso_dados_pedagogicos')).toBe(true)
  })

  it('sem registro, não há consentimento', () => {
    expect(consentimentoVigente([], 'comunicacao_professor')).toBeNull()
    expect(concedeu([], 'comunicacao_professor')).toBe(false)
  })
})

describe('precisaAceitarTermo', () => {
  const aceite = registro({ finalidade: 'uso_dados_pedagogicos' })

  it('não pede de novo quando a versão aceita é a vigente', () => {
    expect(precisaAceitarTermo([aceite], '2026-10-v1')).toBe(false)
  })

  it('pede quando a versão mudou, quando nunca aceitou ou quando revogou', () => {
    expect(precisaAceitarTermo([aceite], '2027-01-v2')).toBe(true)
    expect(precisaAceitarTermo([], '2026-10-v1')).toBe(true)
    const revogado = registro({
      finalidade: 'uso_dados_pedagogicos',
      concedido: false,
      created_at: '2026-11-01T00:00:00Z',
    })
    expect(precisaAceitarTermo([aceite, revogado], '2026-10-v1')).toBe(true)
  })
})

describe('consentimentosDoCadastro', () => {
  it('grava o aceite do termo e a escolha de comunicação', () => {
    const [termo, comunicacao] = consentimentosDoCadastro(false, '2026-10-v1')
    expect(termo).toMatchObject({ finalidade: 'uso_dados_pedagogicos', concedido: true, origem: 'cadastro' })
    expect(comunicacao).toMatchObject({ finalidade: 'comunicacao_professor', concedido: false })
    expect(consentimentosDoCadastro(true)[1].concedido).toBe(true)
  })
})
