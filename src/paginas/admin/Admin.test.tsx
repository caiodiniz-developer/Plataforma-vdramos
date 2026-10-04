// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MensagemDeContato } from '@/dados/admin'
import EntrarAdmin from './Entrar'
import MensagensDeContato from './MensagensDeContato'

const entrarComoAdmin = vi.fn<(email: string, senha: string) => Promise<unknown>>()
const listarMensagensDeContato = vi.fn<(filtro: string) => Promise<MensagemDeContato[]>>()
const marcarMensagem = vi.fn<(id: string, lida: boolean) => Promise<void>>()

vi.mock('@/dados/sessao', () => ({ entrarComoAdmin: (e: string, s: string) => entrarComoAdmin(e, s) }))
vi.mock('@/dados/admin', () => ({
  listarMensagensDeContato: (f: string) => listarMensagensDeContato(f),
  marcarMensagem: (id: string, lida: boolean) => marcarMensagem(id, lida),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Entrar (admin)', () => {
  function abrir() {
    render(
      <MemoryRouter initialEntries={['/admin/entrar']}>
        <Routes>
          <Route path="/admin/entrar" element={<EntrarAdmin />} />
          <Route path="/admin" element={<p>Painel</p>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('entra com e-mail e senha e vai para o painel', async () => {
    entrarComoAdmin.mockResolvedValue({})
    abrir()
    await userEvent.type(screen.getByLabelText('E-mail'), 'admin@vitorramos.test')
    await userEvent.type(screen.getByLabelText('Senha'), 'uma-senha-qualquer')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Painel')).toBeTruthy()
    expect(entrarComoAdmin).toHaveBeenCalledWith('admin@vitorramos.test', 'uma-senha-qualquer')
  })

  it('mostra erro genérico de credencial sem sair da tela', async () => {
    entrarComoAdmin.mockRejectedValue(new Error('E-mail ou senha incorretos.'))
    abrir()
    await userEvent.type(screen.getByLabelText('E-mail'), 'aluno@vitorramos.test')
    await userEvent.type(screen.getByLabelText('Senha'), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeTruthy()
  })
})

describe('Mensagens de contato', () => {
  const mensagem: MensagemDeContato = {
    id: 'c1',
    nome: 'Ana Souza',
    email: 'ana@empresa.com',
    assunto: 'outro',
    assunto_outro: 'Mentoria',
    mensagem: 'Gostaria de conversar sobre mentoria.',
    lida: false,
    created_at: '2026-10-15T01:30:00Z',
  }

  it('lista as não lidas por padrão e marca como lida', async () => {
    listarMensagensDeContato.mockResolvedValue([mensagem])
    marcarMensagem.mockResolvedValue()
    render(
      <MemoryRouter>
        <MensagensDeContato />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Gostaria de conversar sobre mentoria.')).toBeTruthy()
    expect(screen.getByText('Mentoria')).toBeTruthy()
    expect(screen.getByText('14/10/2026 22:30')).toBeTruthy()
    expect(listarMensagensDeContato).toHaveBeenCalledWith('nao_lidas')

    await userEvent.click(screen.getByRole('button', { name: 'Marcar como lida' }))
    await waitFor(() => expect(marcarMensagem).toHaveBeenCalledWith('c1', true))
  })
})
