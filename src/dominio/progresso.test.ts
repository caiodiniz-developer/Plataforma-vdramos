import { describe, expect, it } from 'vitest'
import { proximoPasso } from './progresso'

const atividade = (mudancas: Record<string, unknown>) => ({
  id: 'a1',
  tipo: 'licao',
  titulo: 'Lição 1',
  status: 'publicada',
  respondida: false,
  prazo_em: null as string | null,
  ...mudancas,
})

describe('proximoPasso', () => {
  it('prioriza a atividade pendente de prazo mais próximo', () => {
    const passo = proximoPasso(
      [
        atividade({ id: 'sem', titulo: 'Sem prazo' }),
        atividade({ id: 'longe', titulo: 'Prazo longe', prazo_em: '2026-11-30T12:00:00Z' }),
        atividade({ id: 'perto', titulo: 'Prazo perto', prazo_em: '2026-10-20T12:00:00Z' }),
      ],
      [],
      new Set(),
    )
    expect(passo.titulo).toBe('Prazo perto')
    expect(passo.para).toBe('/aluno/atividades')
  })

  it('ignora o que já foi respondido ou encerrado e cai na questão', () => {
    const passo = proximoPasso(
      [
        atividade({ respondida: true }),
        atividade({ id: 'a2', status: 'encerrada' }),
        atividade({ id: 'q1', tipo: 'questao', titulo: 'Questão 1' }),
      ],
      [],
      new Set(),
    )
    expect(passo).toMatchObject({ titulo: 'Questão 1', para: '/aluno/questoes', acao: 'Praticar' })
  })

  it('sem atividade nem questão, sugere o primeiro conteúdo não aberto', () => {
    const conteudos = [
      { id: 'c1', titulo: 'Já visto' },
      { id: 'c2', titulo: 'Novo' },
    ]
    expect(proximoPasso([], conteudos, new Set(['c1']))).toMatchObject({ titulo: 'Novo', para: '/aluno/conteudos/c2' })
  })

  it('com tudo em dia, convida a mandar uma dúvida', () => {
    const passo = proximoPasso([atividade({ respondida: true })], [{ id: 'c1', titulo: 'Visto' }], new Set(['c1']))
    expect(passo.rotulo).toBe('Tudo em dia')
    expect(passo.para).toBe('/aluno/duvidas')
  })
})
