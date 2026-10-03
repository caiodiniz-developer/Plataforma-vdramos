import { describe, expect, it } from 'vitest'
import { validarContato, type FormularioContato } from './contato'

const valido: FormularioContato = {
  nome: 'Ana Souza',
  email: 'ana@empresa.com',
  assunto: 'treinamento',
  assunto_outro: '',
  mensagem: 'Gostaria de um treinamento de Excel para a equipe.',
  aceitou_privacidade: true,
}

describe('validarContato', () => {
  it('aprova um formulário completo', () => {
    expect(validarContato(valido)).toEqual({})
  })

  it('aponta cada campo obrigatório vazio', () => {
    const erros = validarContato({
      nome: ' ',
      email: '',
      assunto: '',
      assunto_outro: '',
      mensagem: '',
      aceitou_privacidade: false,
    })
    expect(Object.keys(erros).sort()).toEqual(['aceitou_privacidade', 'assunto', 'email', 'mensagem', 'nome'])
  })

  it('rejeita e-mail mal formado', () => {
    expect(validarContato({ ...valido, email: 'ana@empresa' }).email).toBe('Confira o e-mail informado.')
  })

  it('exige o texto livre quando o assunto é "outro"', () => {
    expect(validarContato({ ...valido, assunto: 'outro' }).assunto_outro).toBe('Descreva o assunto.')
    expect(validarContato({ ...valido, assunto: 'outro', assunto_outro: 'Mentoria' })).toEqual({})
  })

  it('limita a mensagem entre 10 e 2000 caracteres', () => {
    expect(validarContato({ ...valido, mensagem: 'curta' }).mensagem).toBeDefined()
    expect(validarContato({ ...valido, mensagem: 'a'.repeat(2001) }).mensagem).toBeDefined()
    expect(validarContato({ ...valido, mensagem: 'a'.repeat(2000) }).mensagem).toBeUndefined()
  })

  it('não envia sem o aceite da política de privacidade', () => {
    expect(validarContato({ ...valido, aceitou_privacidade: false }).aceitou_privacidade).toBeDefined()
  })
})
