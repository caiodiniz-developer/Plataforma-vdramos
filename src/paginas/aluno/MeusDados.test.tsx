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
const salvarEmailDeContato = vi.fn<(email: string) => Promise<void>>()
const buscarEmailDeContato = vi.fn<() => Promise<string | null>>()

vi.mock('@/dados/meus-dados', () => ({
  buscarMeusDados: () => buscarMeusDados(),
  buscarConsentimentos: () => buscarConsentimentos(),
  registrarConsentimento: (f: Finalidade, c: boolean) => registrarConsentimento(f, c),
  excluirConta: () => excluirConta(),
  salvarEmailDeContato: (e: string) => salvarEmailDeContato(e),
  buscarEmailDeContato: () => buscarEmailDeContato(),
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
  perfil: { id: 'p1', nome: 'Ana Souza', email: 'ana@empresa.com', email_contato: null, created_at: '2026-10-14T22:00:00Z' },
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
    buscarMeusDados.mockResolvedValue({ ...dados, perfil: { ...dados.perfil, email_contato: 'ana@contato.com' } })
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

describe('Meus dados · navegação e e-mail de contato', () => {
  const abrirPagina = () =>
    render(
      <MemoryRouter>
        <MeusDados />
      </MemoryRouter>,
    )

  it('tem o caminho de volta para o painel do aluno', async () => {
    buscarMeusDados.mockResolvedValue(dados)
    abrirPagina()
    const voltar = await screen.findByRole('link', { name: 'Voltar ao painel' })
    expect(voltar.getAttribute('href')).toBe('/aluno')
  })

  it('salva o e-mail de contato e recusa formato inválido', async () => {
    buscarMeusDados.mockResolvedValue(dados)
    salvarEmailDeContato.mockResolvedValue()
    abrirPagina()

    const campo = await screen.findByLabelText('E-mail de contato (opcional)')
    await userEvent.type(campo, 'sem-arroba')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar e-mail' }))
    expect(screen.getByRole('alert').textContent).toBe('Confira o e-mail informado.')
    expect(salvarEmailDeContato).not.toHaveBeenCalled()

    await userEvent.clear(campo)
    await userEvent.type(campo, 'ana@contato.com')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar e-mail' }))
    await waitFor(() => expect(salvarEmailDeContato).toHaveBeenCalledWith('ana@contato.com'))
  })

  it('não liga as comunicações sem um e-mail de contato', async () => {
    buscarMeusDados.mockResolvedValue(dados)
    abrirPagina()
    await userEvent.click(await screen.findByRole('switch'))
    expect(registrarConsentimento).not.toHaveBeenCalled()
  })

  it('com e-mail informado, o aluno liga as comunicações', async () => {
    buscarMeusDados.mockResolvedValue({ ...dados, perfil: { ...dados.perfil, email_contato: 'ana@contato.com' } })
    registrarConsentimento.mockResolvedValue()
    abrirPagina()
    await userEvent.click(await screen.findByRole('switch'))
    await waitFor(() => expect(registrarConsentimento).toHaveBeenCalledWith('comunicacao_professor', true))
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

  const respondeu: Consentimento = { ...aceite, finalidade: 'comunicacao_professor', concedido: false }

  it('libera o conteúdo quando a versão aceita é a vigente', async () => {
    buscarConsentimentos.mockResolvedValue([aceite, respondeu])
    abrir()
    expect(await screen.findByText('Conteúdo da turma')).toBeTruthy()
  })

  it('barra o conteúdo quando a versão mudou e só continua com o aceite', async () => {
    buscarConsentimentos.mockResolvedValueOnce([{ ...aceite, versao_termo: '2025-01-v0' }, respondeu])
    buscarConsentimentos.mockResolvedValue([aceite, respondeu])
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

  describe('pergunta sobre comunicações', () => {
    it('aparece depois do termo, antes do portal, e "Agora não" libera sem pedir e-mail', async () => {
      buscarConsentimentos.mockResolvedValueOnce([aceite])
      buscarConsentimentos.mockResolvedValue([aceite, respondeu])
      buscarEmailDeContato.mockResolvedValue(null)
      registrarConsentimento.mockResolvedValue()
      abrir()

      expect(await screen.findByRole('heading', { name: 'Quer receber comunicações do professor?' })).toBeTruthy()
      expect(screen.queryByText('Conteúdo da turma')).toBeNull()

      await userEvent.click(screen.getByRole('button', { name: 'Agora não' }))
      expect(await screen.findByText('Conteúdo da turma')).toBeTruthy()
      expect(registrarConsentimento).toHaveBeenCalledWith('comunicacao_professor', false)
      expect(salvarEmailDeContato).not.toHaveBeenCalled()
    })

    it('"Quero receber" exige um e-mail válido e grava o e-mail e o consentimento', async () => {
      buscarConsentimentos.mockResolvedValueOnce([aceite])
      buscarConsentimentos.mockResolvedValue([aceite, { ...respondeu, concedido: true }])
      buscarEmailDeContato.mockResolvedValue(null)
      registrarConsentimento.mockResolvedValue()
      salvarEmailDeContato.mockResolvedValue()
      abrir()

      await userEvent.click(await screen.findByRole('button', { name: 'Quero receber' }))
      expect(screen.getByRole('alert').textContent).toBe('Para receber, informe um e-mail.')
      expect(registrarConsentimento).not.toHaveBeenCalled()

      await userEvent.type(screen.getByLabelText('Seu e-mail (opcional)'), 'ana@contato.com')
      await userEvent.click(screen.getByRole('button', { name: 'Quero receber' }))
      expect(await screen.findByText('Conteúdo da turma')).toBeTruthy()
      expect(salvarEmailDeContato).toHaveBeenCalledWith('ana@contato.com')
      expect(registrarConsentimento).toHaveBeenCalledWith('comunicacao_professor', true)
    })

    it('traz preenchido o e-mail informado no cadastro', async () => {
      buscarConsentimentos.mockResolvedValue([aceite])
      buscarEmailDeContato.mockResolvedValue('ana@cadastro.com')
      abrir()
      await waitFor(() =>
        expect((screen.getByLabelText('Seu e-mail (opcional)') as HTMLInputElement).value).toBe('ana@cadastro.com'),
      )
    })
  })
})
