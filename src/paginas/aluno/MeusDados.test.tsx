// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PortaoDoTermo } from '@/componentes/PortaoDoTermo'
import type { MeusDados as Dados } from '@/dados/meus-dados'
import type { Consentimento, Finalidade } from '@/dominio/consentimento'
import MeusDados from './MeusDados'

const buscarMeusDados = vi.fn<() => Promise<Dados>>()
const buscarConsentimentos = vi.fn<() => Promise<Consentimento[]>>()
const registrarConsentimento = vi.fn<(finalidade: Finalidade, concedido: boolean) => Promise<void>>()
const excluirConta = vi.fn<() => Promise<void>>()

vi.mock('@/dados/meus-dados', () => ({
  buscarMeusDados: () => buscarMeusDados(),
  buscarConsentimentos: () => buscarConsentimentos(),
  registrarConsentimento: (f: Finalidade, c: boolean) => registrarConsentimento(f, c),
  excluirConta: () => excluirConta(),
  exportarMeusDados: vi.fn(),
}))

const aceite: Consentimento = {
  finalidade: 'uso_dados_pedagogicos',
  concedido: true,
  versao_termo: '2026-10-v1',
  origem: 'cadastro',
  created_at: '2026-10-14T22:00:00Z',
}

const dados: Dados = {
  perfil: { id: 'p1', nome: 'Ana Souza', email: 'ana@empresa.com', created_at: '2026-10-14T22:00:00Z' },
  inscricoes: [
    {
      id: 'i1',
      ultimo_acesso_em: '2026-10-15T01:30:00Z',
      created_at: '2026-10-14T22:00:00Z',
      turma: {
        codigo: 'EXCIA-CPS-2610',
        instituicao: 'SENAI',
        cidade: 'Campinas',
        status: 'ativa',
        curso: { nome: 'Excel Básico com IA Generativa' },
      },
    },
  ],
  consentimentos: [
    aceite,
    { ...aceite, finalidade: 'comunicacao_professor', concedido: false },
  ],
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Meus dados', () => {
  it('mostra perfil, turmas e o estado vigente de cada consentimento', async () => {
    buscarMeusDados.mockResolvedValue(dados)
    render(
      <MemoryRouter>
        <MeusDados />
      </MemoryRouter>,
    )

    expect(await screen.findByText('ana@empresa.com')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'EXCIA-CPS-2610' })).toBeTruthy()
    // Último acesso exibido no fuso de São Paulo.
    expect(screen.getByText('14/10/2026 22:30')).toBeTruthy()
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false')
    // Selo do termo de uso + linha do histórico.
    expect(screen.getAllByText('Concedido').length).toBeGreaterThan(0)
  })

  it('o switch de comunicação grava um novo consentimento', async () => {
    buscarMeusDados.mockResolvedValue(dados)
    registrarConsentimento.mockResolvedValue()
    render(
      <MemoryRouter>
        <MeusDados />
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('switch'))
    await waitFor(() => expect(registrarConsentimento).toHaveBeenCalledWith('comunicacao_professor', true))
  })

  it('a exclusão pede confirmação antes de chamar o servidor', async () => {
    buscarMeusDados.mockResolvedValue(dados)
    excluirConta.mockResolvedValue()
    render(
      <MemoryRouter>
        <MeusDados />
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Solicitar exclusão' }))
    expect(await screen.findByRole('alertdialog', { name: 'Excluir sua conta?' })).toBeTruthy()
    expect(excluirConta).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Excluir conta' }))
    await waitFor(() => expect(excluirConta).toHaveBeenCalledTimes(1))
  })
})

describe('Portão do termo', () => {
  const abrir = () =>
    render(
      <MemoryRouter>
        <PortaoDoTermo>
          <p>Conteúdo da turma</p>
        </PortaoDoTermo>
      </MemoryRouter>,
    )

  it('libera o conteúdo quando a versão aceita é a vigente', async () => {
    buscarConsentimentos.mockResolvedValue([aceite])
    abrir()
    expect(await screen.findByText('Conteúdo da turma')).toBeTruthy()
  })

  it('barra o conteúdo quando a versão mudou e só continua com o aceite', async () => {
    buscarConsentimentos.mockResolvedValueOnce([{ ...aceite, versao_termo: '2025-01-v0' }])
    buscarConsentimentos.mockResolvedValue([aceite])
    registrarConsentimento.mockResolvedValue()
    abrir()

    expect(await screen.findByRole('heading', { name: 'O termo de uso mudou' })).toBeTruthy()
    expect(screen.queryByText('Conteúdo da turma')).toBeNull()
    expect(screen.getByRole('button', { name: 'Continuar' }).hasAttribute('disabled')).toBe(true)

    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Conteúdo da turma')).toBeTruthy()
    expect(registrarConsentimento).toHaveBeenCalledWith('uso_dados_pedagogicos', true)
  })
})
