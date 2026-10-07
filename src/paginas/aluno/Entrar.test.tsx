// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IdsDeAcesso } from '@/dados/acesso'
import Entrar from './Entrar'

const entrar = vi.fn<(ids: IdsDeAcesso, valor: string) => Promise<string>>()
const cadastrar = vi.fn<(ids: IdsDeAcesso, dados: Record<string, unknown>) => Promise<string>>()

vi.mock('@/dados/acesso', () => ({
  entrar: (ids: IdsDeAcesso, valor: string) => entrar(ids, valor),
  cadastrar: (ids: IdsDeAcesso, dados: Record<string, unknown>) => cadastrar(ids, dados),
}))

// Valor de mentira, usado só nos testes.
const BOA = 'Aluno' + '@' + '123'

function abrir() {
  return render(
    <MemoryRouter initialEntries={['/aluno/entrar']}>
      <Routes>
        <Route path="/aluno/entrar" element={<Entrar />} />
        <Route path="/aluno" element={<p>Painel do aluno</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Entrar (aluno)', () => {
  it('entra com ID do aluno, ID da turma e senha e vai para o painel', async () => {
    entrar.mockResolvedValue('TURMA-001')
    abrir()

    await userEvent.type(screen.getByLabelText('ID do aluno'), 'aluno-001')
    await userEvent.type(screen.getByLabelText('ID da turma'), 'turma-001')
    await userEvent.type(screen.getByLabelText('Senha'), BOA)
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Painel do aluno')).toBeTruthy()
    expect(entrar).toHaveBeenCalledWith({ matricula: 'aluno-001', codigoTurma: 'turma-001' }, BOA)
  })

  it('não chama o servidor com campo vazio', async () => {
    abrir()
    await userEvent.type(screen.getByLabelText('ID do aluno'), 'aluno-001')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.getByText('Informe o ID do aluno, o ID da turma e a senha.')).toBeTruthy()
    expect(entrar).not.toHaveBeenCalled()
  })

  it('mostra a mensagem do servidor: credenciais erradas e conta bloqueada', async () => {
    entrar.mockRejectedValueOnce(new Error('ID, turma ou senha incorretos.'))
    entrar.mockRejectedValueOnce(
      new Error('Sua conta está temporariamente bloqueada. Entre em contato com seu professor.'),
    )
    abrir()
    await userEvent.type(screen.getByLabelText('ID do aluno'), 'aluno-001')
    await userEvent.type(screen.getByLabelText('ID da turma'), 'turma-001')
    await userEvent.type(screen.getByLabelText('Senha'), BOA)

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('ID, turma ou senha incorretos.')

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText(/temporariamente bloqueada/)).toBeTruthy()
    // Continua na tela de entrada, com o que foi digitado.
    expect((screen.getByLabelText('ID do aluno') as HTMLInputElement).value).toBe('aluno-001')
  })

  it('o botão de mostrar senha alterna o campo', async () => {
    abrir()
    const campo = screen.getByLabelText('Senha') as HTMLInputElement
    expect(campo.type).toBe('password')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(campo.type).toBe('text')
  })
})

describe('Criar conta (aluno)', () => {
  async function preencher(confirmacao = BOA) {
    await userEvent.click(screen.getByRole('tab', { name: 'Criar conta' }))
    await userEvent.type(await screen.findByLabelText('Nome completo'), 'João Silva')
    await userEvent.type(screen.getByLabelText('ID do aluno'), 'aluno-002')
    await userEvent.type(screen.getByLabelText('ID da turma'), 'turma-001')
    await userEvent.type(screen.getByLabelText('Senha'), BOA)
    await userEvent.type(screen.getByLabelText('Confirmar senha'), confirmacao)
  }

  it('cria a conta e já entra', async () => {
    cadastrar.mockResolvedValue('TURMA-001')
    abrir()
    await preencher()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByText('Painel do aluno')).toBeTruthy()
    expect(cadastrar).toHaveBeenCalledWith(
      { matricula: 'aluno-002', codigoTurma: 'turma-001' },
      { nome: 'João Silva', senha: BOA, aceiteTermo: true },
    )
  })

  it('aponta cada campo vazio e não chama o servidor', async () => {
    abrir()
    await userEvent.click(screen.getByRole('tab', { name: 'Criar conta' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Criar conta' }))

    expect(screen.getByText('Informe seu nome completo.')).toBeTruthy()
    expect(screen.getByText('Informe o seu ID de aluno.')).toBeTruthy()
    expect(screen.getByText('Informe o ID da turma.')).toBeTruthy()
    expect(screen.getByText('A senha precisa ter ao menos 8 caracteres.')).toBeTruthy()
    expect(screen.getByText('É preciso aceitar o termo de uso para continuar.')).toBeTruthy()
    expect(cadastrar).not.toHaveBeenCalled()
  })

  it('exige que as senhas coincidam e o aceite do termo', async () => {
    abrir()
    await preencher(BOA + '4')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getByText('As senhas não coincidem.')).toBeTruthy()
    expect(screen.getByText('É preciso aceitar o termo de uso para continuar.')).toBeTruthy()
    expect(cadastrar).not.toHaveBeenCalled()
  })

  it('mostra a recusa do servidor (ID fora da lista, conta já existente)', async () => {
    cadastrar.mockRejectedValue(new Error('Já existe uma conta para este ID. Use a aba Entrar.'))
    abrir()
    await preencher()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Já existe uma conta para este ID. Use a aba Entrar.')
  })
})
