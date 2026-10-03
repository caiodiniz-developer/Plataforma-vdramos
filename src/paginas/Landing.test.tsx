// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DadosDaLanding } from '@/dados/landing'
import type { Experiencia } from '@/dominio/experiencia'
import Landing from './Landing'

const buscarLanding = vi.fn<() => Promise<DadosDaLanding>>()
const enviarContato = vi.fn<() => Promise<void>>()

vi.mock('@/dados/landing', async (original) => ({
  ...(await original<typeof import('@/dados/landing')>()),
  buscarLanding: () => buscarLanding(),
  enviarContato: () => enviarContato(),
}))

const perfil: DadosDaLanding['perfil'] = {
  nome_exibicao: 'Vitor Ramos',
  titulo: 'Dados · IA · Educação',
  bio: 'Construindo produtos e educação em dados e inteligência artificial.',
  foto_path: null,
  email_contato: 'contato@exemplo.com',
  telefone: null,
  linkedin_url: 'https://www.linkedin.com/in/exemplo',
  outros_links: [],
  cidade: 'Campinas, SP',
}

function experiencia(parcial: Partial<Experiencia>): Experiencia {
  return {
    id: 'e1',
    tipo: 'profissional',
    organizacao: 'Organização Exemplo',
    cargo: 'Cientista de dados',
    local: 'Campinas',
    data_inicio: '2022-03-01',
    data_fim: null,
    descricao: 'Modelos de previsão de demanda.',
    tags: ['Dados', 'IA'],
    ordem: 0,
    publicado: true,
    ...parcial,
  }
}

function abrir() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Landing', () => {
  it('mostra o hero com nome, eyebrow, bio e os botões', async () => {
    buscarLanding.mockResolvedValue({ perfil, experiencias: [] })
    abrir()

    expect(await screen.findByRole('heading', { level: 1, name: 'Vitor Ramos' })).toBeTruthy()
    expect(screen.getByText('Dados · IA · Educação')).toBeTruthy()
    expect(screen.getByText(/Construindo produtos e educação/)).toBeTruthy()
    const linkedin = screen.getByRole('link', { name: /LinkedIn.*nova aba/ })
    expect(linkedin.getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.getAllByRole('link', { name: 'Área do aluno' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Privacidade' }).getAttribute('href')).toBe('/privacidade')
  })

  it('esconde a seção e as âncoras de experiência quando não há nenhuma publicada', async () => {
    buscarLanding.mockResolvedValue({ perfil, experiencias: [] })
    abrir()

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('heading', { name: 'Experiência' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Docência' })).toBeNull()
  })

  it('mostra só a aba que tem experiências', async () => {
    buscarLanding.mockResolvedValue({ perfil, experiencias: [experiencia({})] })
    abrir()

    expect(await screen.findByRole('heading', { name: 'Cientista de dados' })).toBeTruthy()
    expect(screen.getByText('mar/2022 — atual')).toBeTruthy()
    // Com uma aba só, a lista de abas nem aparece.
    expect(screen.queryByRole('tab', { name: 'Docência' })).toBeNull()
  })

  it('troca entre as abas Profissional e Docência', async () => {
    buscarLanding.mockResolvedValue({
      perfil,
      experiencias: [
        experiencia({}),
        experiencia({ id: 'e2', tipo: 'docencia', cargo: 'Instrutor de Excel', organizacao: 'SENAI' }),
      ],
    })
    abrir()

    await userEvent.click(await screen.findByRole('tab', { name: 'Docência' }))
    expect(await screen.findByRole('heading', { name: 'Instrutor de Excel' })).toBeTruthy()
  })

  it('mostra erro com "Tentar de novo" quando a carga falha', async () => {
    buscarLanding.mockRejectedValueOnce(new Error('Não foi possível concluir agora. Tente de novo.'))
    buscarLanding.mockResolvedValue({ perfil, experiencias: [] })
    abrir()

    await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Vitor Ramos' })).toBeTruthy()
  })
})

describe('Formulário de contato', () => {
  it('bloqueia o envio e mostra o erro em cada campo obrigatório', async () => {
    buscarLanding.mockResolvedValue({ perfil, experiencias: [] })
    abrir()

    await userEvent.click(await screen.findByRole('button', { name: 'Enviar mensagem' }))

    expect(screen.getByText('Informe seu nome.')).toBeTruthy()
    expect(screen.getByText('Informe seu e-mail.')).toBeTruthy()
    expect(screen.getByText('Escolha um assunto.')).toBeTruthy()
    expect(screen.getByText('Confirme a leitura da política de privacidade.')).toBeTruthy()
    expect(enviarContato).not.toHaveBeenCalled()
  })

  it('não envia sem assunto mesmo com os outros campos preenchidos', async () => {
    buscarLanding.mockResolvedValue({ perfil, experiencias: [] })
    abrir()

    await userEvent.type(await screen.findByLabelText('Nome'), 'Ana Souza')
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@empresa.com')
    await userEvent.type(screen.getByLabelText('Mensagem'), 'Gostaria de um treinamento de Excel.')
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))

    await waitFor(() => expect(screen.getByText('Escolha um assunto.')).toBeTruthy())
    expect(screen.queryByText('Informe seu nome.')).toBeNull()
    expect(enviarContato).not.toHaveBeenCalled()
  })
})
