import { describe, expect, it } from 'vitest'
import { comInstituicao, instituicoesDe, passaNoFiltro, SEM_FILTRO, TODAS, turmasDaInstituicao } from './turmas'

const turmas = [
  { id: 't1', codigo: 'WEB-01', instituicao: 'SENAI' },
  { id: 't2', codigo: 'WEB-02', instituicao: 'SENAI ' },
  { id: 't3', codigo: 'DADOS-01', instituicao: 'Etec' },
]

describe('filtro por instituição e turma', () => {
  it('lista as instituições sem repetir, em ordem', () => {
    expect(instituicoesDe(turmas)).toEqual(['Etec', 'SENAI'])
  })

  it('mostra só as turmas da instituição escolhida', () => {
    expect(turmasDaInstituicao(turmas, 'SENAI').map((t) => t.codigo)).toEqual(['WEB-01', 'WEB-02'])
    expect(turmasDaInstituicao(turmas, TODAS)).toHaveLength(3)
  })

  it('sem filtro, tudo passa', () => {
    expect(passaNoFiltro('t3', SEM_FILTRO, turmas)).toBe(true)
  })

  it('filtra por instituição e por turma', () => {
    expect(passaNoFiltro('t1', { instituicao: 'SENAI', turma: TODAS }, turmas)).toBe(true)
    expect(passaNoFiltro('t3', { instituicao: 'SENAI', turma: TODAS }, turmas)).toBe(false)
    expect(passaNoFiltro('t2', { instituicao: 'SENAI', turma: 't1' }, turmas)).toBe(false)
    expect(passaNoFiltro('t1', { instituicao: TODAS, turma: 't1' }, turmas)).toBe(true)
  })

  it('item para todas as turmas aparece em qualquer filtro', () => {
    expect(passaNoFiltro(null, { instituicao: 'Etec', turma: 't3' }, turmas)).toBe(true)
  })

  it('trocar a instituição solta a turma que não é dela', () => {
    expect(comInstituicao({ instituicao: 'SENAI', turma: 't1' }, 'Etec', turmas)).toEqual({ instituicao: 'Etec', turma: TODAS })
    expect(comInstituicao({ instituicao: TODAS, turma: 't1' }, 'SENAI', turmas)).toEqual({ instituicao: 'SENAI', turma: 't1' })
  })
})
