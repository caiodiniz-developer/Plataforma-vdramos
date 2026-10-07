import { describe, expect, it } from 'vitest'
import {
  alunoVeResultado,
  itensEditaveis,
  modeloSatisfacao,
  problemasDaAtividade,
  segundosRestantes,
  type AtividadeRascunho,
} from './atividade'

const quiz: AtividadeRascunho = {
  tipo: 'quiz',
  titulo: 'Quiz — referências de célula',
  alvo: null,
  itens: [
    {
      enunciado: 'Qual símbolo fixa uma referência?',
      tipo_resposta: 'escolha_unica',
      obrigatorio: true,
      explicacao: 'O cifrão trava linha ou coluna.',
      opcoes: [
        { texto: '$', correta: true },
        { texto: '#', correta: false },
      ],
    },
  ],
}

describe('problemasDaAtividade', () => {
  it('aprova um quiz completo', () => {
    expect(problemasDaAtividade(quiz)).toEqual([])
  })

  it('exige ao menos um item', () => {
    expect(problemasDaAtividade({ ...quiz, itens: [] })).toContain('Adicione ao menos um item.')
  })

  it('exige duas opções em item de escolha', () => {
    const umaOpcao = { ...quiz, itens: [{ ...quiz.itens[0], opcoes: [{ texto: '$', correta: true }] }] }
    expect(problemasDaAtividade(umaOpcao)).toContain('Item 1: inclua ao menos duas opções.')
  })

  it('ignora opções em branco na contagem', () => {
    const comBranco = {
      ...quiz,
      itens: [
        {
          ...quiz.itens[0],
          opcoes: [
            { texto: '$', correta: true },
            { texto: '  ', correta: false },
          ],
        },
      ],
    }
    expect(problemasDaAtividade(comBranco)).toContain('Item 1: inclua ao menos duas opções.')
  })

  it('questão avulsa é corrigida: exige gabarito como o quiz', () => {
    const semCorreta = {
      ...quiz,
      tipo: 'questao' as const,
      itens: [{ ...quiz.itens[0], opcoes: quiz.itens[0].opcoes.map((o) => ({ ...o, correta: false })) }],
    }
    expect(problemasDaAtividade(semCorreta)).toContain('Item 1: marque a opção correta.')
    expect(problemasDaAtividade({ ...quiz, tipo: 'questao' })).toEqual([])
  })

  it('lição aceita item de escolha sem gabarito', () => {
    const semCorreta = {
      ...quiz,
      tipo: 'licao' as const,
      itens: [{ ...quiz.itens[0], opcoes: quiz.itens[0].opcoes.map((o) => ({ ...o, correta: false })) }],
    }
    expect(problemasDaAtividade(semCorreta)).toEqual([])
  })

  it('exige opção correta em quiz, mas não em enquete', () => {
    const semCorreta = {
      ...quiz,
      itens: [{ ...quiz.itens[0], opcoes: quiz.itens[0].opcoes.map((o) => ({ ...o, correta: false })) }],
    }
    expect(problemasDaAtividade(semCorreta)).toContain('Item 1: marque a opção correta.')
    expect(problemasDaAtividade({ ...semCorreta, tipo: 'enquete' })).toEqual([])
  })

  it('não aceita duas corretas em escolha única', () => {
    const duas = {
      ...quiz,
      itens: [{ ...quiz.itens[0], opcoes: quiz.itens[0].opcoes.map((o) => ({ ...o, correta: true })) }],
    }
    expect(problemasDaAtividade(duas)).toContain('Item 1: escolha única aceita só uma opção correta.')
  })

  it('pesquisa de satisfação precisa de alvo', () => {
    const semAlvo = { ...modeloSatisfacao('teoria'), alvo: null }
    expect(problemasDaAtividade(semAlvo)).toContain('Escolha o que a pesquisa avalia.')
  })
})

describe('modeloSatisfacao', () => {
  it('tem três escalas e um texto livre opcional, e já pode ser publicado', () => {
    const modelo = modeloSatisfacao('pratica')
    expect(modelo.titulo).toBe('Satisfação — prática')
    expect(modelo.itens.map((i) => i.tipo_resposta)).toEqual([
      'escala_1_5',
      'escala_1_5',
      'escala_1_5',
      'texto_livre',
    ])
    expect(modelo.itens[3].obrigatorio).toBe(false)
    expect(problemasDaAtividade(modelo)).toEqual([])
  })
})

describe('itensEditaveis', () => {
  it('trava itens quando a atividade publicada já tem respostas', () => {
    expect(itensEditaveis('rascunho', 0)).toBe(true)
    expect(itensEditaveis('publicada', 0)).toBe(true)
    expect(itensEditaveis('publicada', 3)).toBe(false)
    expect(itensEditaveis('encerrada', 3)).toBe(false)
  })
})

describe('segundosRestantes', () => {
  const publicada = '2026-10-14T23:00:00Z'

  it('conta a partir da publicação', () => {
    expect(segundosRestantes(publicada, 60, new Date('2026-10-14T23:00:20Z'))).toBe(40)
  })

  it('não fica negativo', () => {
    expect(segundosRestantes(publicada, 60, new Date('2026-10-14T23:05:00Z'))).toBe(0)
  })

  it('sem limite ou sem publicação, não há contagem', () => {
    expect(segundosRestantes(publicada, null, new Date())).toBeNull()
    expect(segundosRestantes(null, 60, new Date())).toBeNull()
  })
})

describe('alunoVeResultado', () => {
  it('segue a regra de exibição', () => {
    expect(alunoVeResultado('nunca', 'encerrada', true)).toBe(false)
    expect(alunoVeResultado('apos_responder', 'publicada', true)).toBe(true)
    expect(alunoVeResultado('apos_responder', 'publicada', false)).toBe(false)
    expect(alunoVeResultado('apos_encerrar', 'publicada', true)).toBe(false)
    expect(alunoVeResultado('apos_encerrar', 'encerrada', false)).toBe(true)
  })
})
