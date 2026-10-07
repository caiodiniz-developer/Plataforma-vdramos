import { describe, expect, it } from 'vitest'
import { problemaDaSenha, validarCadastro, type CadastroDeAluno } from './senha'

const BOA = 'Aluno' + '@' + '123'

describe('problemaDaSenha', () => {
  it('aceita senha com letras e números a partir de 8 caracteres', () => {
    expect(problemaDaSenha(BOA)).toBeNull()
    expect(problemaDaSenha('abcdefg1')).toBeNull()
  })

  it('recusa senha curta, só letras, só números ou longa demais', () => {
    expect(problemaDaSenha('abc123')).toMatch(/ao menos 8/)
    expect(problemaDaSenha('somenteletras')).toMatch(/letras e números/)
    expect(problemaDaSenha('1234567890')).toMatch(/letras e números/)
    expect(problemaDaSenha('a1' + 'x'.repeat(80))).toMatch(/no máximo 72/)
  })
})

describe('validarCadastro', () => {
  const valido: CadastroDeAluno = {
    nome: 'João Silva',
    matricula: 'ALUNO-002',
    codigoTurma: 'TURMA-001',
    senha: BOA,
    confirmacao: BOA,
    aceiteTermo: true,
  }

  it('aprova o cadastro completo', () => {
    expect(validarCadastro(valido)).toEqual({})
  })

  it('aponta cada campo vazio', () => {
    const erros = validarCadastro({ nome: ' ', matricula: '', codigoTurma: '', senha: '', confirmacao: '', aceiteTermo: false })
    expect(Object.keys(erros).sort()).toEqual(['aceiteTermo', 'codigoTurma', 'matricula', 'nome', 'senha'])
  })

  it('exige que as senhas coincidam', () => {
    expect(validarCadastro({ ...valido, confirmacao: BOA + '4' }).confirmacao).toBe('As senhas não coincidem.')
  })

  it('não conclui sem o aceite do termo', () => {
    expect(validarCadastro({ ...valido, aceiteTermo: false }).aceiteTermo).toBeDefined()
  })
})
