// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GALERIA, RETRATO } from '@/conteudo/galeria'
import type { DadosDaLanding } from '@/dados/landing'
import Landing from './Landing'

const buscarLanding = vi.fn<() => Promise<DadosDaLanding>>()

vi.mock('@/dados/landing', async (original) => ({
  ...(await original<typeof import('@/dados/landing')>()),
  buscarLanding: () => buscarLanding(),
}))

const perfil: DadosDaLanding['perfil'] = {
  nome_exibicao: 'Vitor Ramos',
  titulo: 'Dados · IA · Educação',
  bio: 'Construindo produtos e educação em dados e inteligência artificial.',
  foto_path: null,
  email_contato: 'contato@exemplo.com',
  telefone: null,
  linkedin_url: '',
  outros_links: [],
  cidade: null,
}

beforeEach(() => {
  buscarLanding.mockResolvedValue({ perfil, experiencias: [] })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function abrir() {
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  )
}

describe('Landing — seções novas', () => {
  it('numera as seções na ordem em que aparecem', async () => {
    abrir()
    await screen.findByRole('heading', { level: 1 })
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titulos).toEqual([
      'Frentes de trabalho',
      'Sala de aula interativa',
      'Em sala e em projetos',
      'Dados e IA com rigor técnico e clareza didática.',
      'Contato',
    ])
  })

  it('usa o retrato de exemplo, com etiqueta, quando o professor não enviou foto', async () => {
    abrir()
    const retrato = await screen.findByAltText(RETRATO.alt)
    expect(retrato.getAttribute('src')).toBe(RETRATO.arquivo)
  })

  it('mostra todas as fotos da galeria marcadas como exemplo', async () => {
    abrir()
    const galeria = (await screen.findByRole('heading', { name: 'Em sala e em projetos' })).closest('section')!
    const figuras = within(galeria).getAllByRole('figure')
    expect(figuras).toHaveLength(GALERIA.length)
    expect(within(galeria).getAllByText('Foto de exemplo')).toHaveLength(GALERIA.filter((f) => f.exemplo).length)
    for (const foto of GALERIA) expect(within(galeria).getByAltText(foto.alt)).toBeTruthy()
  })

  it('a frente de trabalho escolhida já preenche o assunto do contato', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('link', { name: /Conversar sobre consultoria/ }))
    const contato = screen.getByRole('heading', { name: 'Contato' }).closest('section')!
    expect(within(contato).getByRole('combobox').textContent).toBe('Consultoria')
  })

  it('o hero expõe os cinco temas do guia como lista, para leitores de tela', async () => {
    abrir()
    const temas = await screen.findByRole('list', { name: 'Temas' })
    expect(within(temas).getAllByRole('listitem').map((li) => li.textContent?.replace(/\d+$/, ''))).toEqual([
      'Dados',
      'IA',
      'Educação',
      'Produto',
      'Engenharia',
    ])
  })

  it('o nome do hero recebe a escala calculada para caber na largura da página', async () => {
    abrir()
    const nome = await screen.findByRole('heading', { level: 1, name: 'Vitor Ramos' })
    expect(nome.style.getPropertyValue('--colunas-linha')).toBe('11')
    expect(nome.style.getPropertyValue('--colunas-pilha')).toBe('5')
  })

  it('a prévia da sala, sem animação, mostra o encontro completo', async () => {
    abrir()
    const previa = await screen.findByRole('group', { name: 'Prévia ilustrativa da sala de aula' })
    expect(within(previa).getByRole('img', { name: 'Régua do encontro' }).children).toHaveLength(6)
    expect(within(previa).getByText('22:45')).toBeTruthy()
    expect(within(previa).getByText('+12')).toBeTruthy()
    expect(within(previa).getByText('Correta')).toBeTruthy()
    expect(within(previa).getByText('Planilha de exercícios')).toBeTruthy()
  })

  it('o rodapé da landing fecha com a assinatura decorativa, fora da leitura de tela', async () => {
    abrir()
    await screen.findByRole('heading', { level: 1 })
    const rodape = screen.getByRole('contentinfo')
    const assinatura = rodape.querySelector('[data-assinatura]')
    expect(assinatura?.textContent).toBe('Vitor Ramos')
    expect(assinatura?.getAttribute('aria-hidden')).toBe('true')
  })

  it('leva à área do aluno a partir da seção da sala de aula e da chamada final', async () => {
    abrir()
    expect((await screen.findByRole('link', { name: 'Entrar na área do aluno' })).getAttribute('href')).toBe(
      '/aluno/entrar',
    )
    expect(screen.getByRole('link', { name: 'Sou aluno' }).getAttribute('href')).toBe('/aluno/entrar')
  })
})
