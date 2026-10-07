// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AtividadeParaAluno, EstadoDaConexao, Sala } from '@/dados/sala'
import AoVivo from './AoVivo'

const buscarSala = vi.fn<(codigo: string) => Promise<Sala>>()
const enviarPergunta = vi.fn<(...args: unknown[]) => Promise<void>>()
const alternarVoto = vi.fn<(id: string) => Promise<void>>()
const enviarMensagem = vi.fn<(...args: unknown[]) => Promise<void>>()
const buscarAtividade = vi.fn<(id: string) => Promise<AtividadeParaAluno>>()
let avisarConexao: (estado: EstadoDaConexao) => void = () => {}

vi.mock('@/dados/sala', () => ({
  buscarSala: (codigo: string) => buscarSala(codigo),
  enviarPergunta: (...args: unknown[]) => enviarPergunta(...args),
  alternarVoto: (id: string) => alternarVoto(id),
  enviarMensagem: (...args: unknown[]) => enviarMensagem(...args),
  buscarAtividade: (id: string) => buscarAtividade(id),
  responderAtividade: vi.fn(),
  assinarSala: (_id: string, _mudar: () => void, conexao: (e: EstadoDaConexao) => void) => {
    avisarConexao = conexao
    return () => {}
  },
}))

function sala(parcial: Partial<Sala> = {}): Sala {
  return {
    turma: { id: 't1', codigo: 'EXCIA-CPS-2610', fuso: 'America/Sao_Paulo', status: 'ativa', nome_curso: 'Excel Básico' },
    sessao: {
      id: 's1',
      status: 'aberta',
      permite_anonimo: true,
      chat_ativo: true,
      encontro: { id: 'e1', numero: 1, titulo: 'SA1' },
    },
    perguntas: [
      { id: 'p1', texto: 'Pergunta pouco votada', destino: 'turma', anonima: false, autor_nome: 'Bruno', status: 'aberta', resposta: null, votos: 1, created_at: '2026-10-14T22:00:00Z', votei: false, minha: false },
      { id: 'p2', texto: 'Pergunta mais votada', destino: 'turma', anonima: true, autor_nome: null, status: 'respondida', resposta: 'Use o cifrão.', votos: 5, created_at: '2026-10-14T22:05:00Z', votei: true, minha: false },
      { id: 'p3', texto: 'Posso entregar depois?', destino: 'professor', anonima: false, autor_nome: 'Ana', status: 'aberta', resposta: null, votos: 0, created_at: '2026-10-14T22:06:00Z', votei: false, minha: true },
    ],
    mensagens: [
      { id: 'm1', perfil_id: 'x', autor_nome: 'Ana', tipo: 'texto', texto: 'veja https://exemplo.com/planilha', fixada: false, removida: false, created_at: '2026-10-14T22:00:00Z' },
      { id: 'm2', perfil_id: 'y', autor_nome: 'Vitor Ramos', tipo: 'aviso', texto: 'Intervalo de 15 minutos.', fixada: true, removida: false, created_at: '2026-10-14T22:10:00Z' },
    ],
    atividades: [],
    ...parcial,
  }
}

function abrir() {
  return render(
    <MemoryRouter initialEntries={['/aluno/turmas/EXCIA-CPS-2610/ao-vivo']}>
      <Routes>
        <Route path="/aluno/turmas/:codigo/ao-vivo" element={<AoVivo />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Sala ao vivo (aluno)', () => {
  it('ordena o mural por votos, esconde o nome do anônimo e marca a pergunta privada', async () => {
    buscarSala.mockResolvedValue(sala())
    abrir()

    const murais = await screen.findAllByRole('list', { name: 'Mural de perguntas' })
    const itens = within(murais[0]).getAllByRole('listitem')
    expect(itens[0].textContent).toContain('Pergunta mais votada')
    expect(itens[0].textContent).toContain('Anônimo')
    expect(itens[0].textContent).toContain('Respondida')
    expect(itens[0].textContent).toContain('Use o cifrão.')
    expect(within(murais[0]).getByText('Enviada ao professor')).toBeTruthy()
  })

  it('envia pergunta com destino e anonimato escolhidos', async () => {
    buscarSala.mockResolvedValue(sala())
    enviarPergunta.mockResolvedValue()
    abrir()

    const [campo] = await screen.findAllByLabelText('Sua pergunta')
    await userEvent.type(campo, 'Como travar só a coluna?')
    await userEvent.click(screen.getAllByLabelText('Só para o professor')[0])
    await userEvent.click(screen.getAllByLabelText('Enviar anônima')[0])
    await userEvent.click(screen.getAllByRole('button', { name: 'Enviar pergunta' })[0])

    await waitFor(() =>
      expect(enviarPergunta).toHaveBeenCalledWith('s1', 'Como travar só a coluna?', 'professor', true),
    )
  })

  it('mensagens: aviso fixado no topo e links seguros', async () => {
    buscarSala.mockResolvedValue(sala())
    abrir()

    // No jsdom a tela é estreita: a sala usa abas, uma de cada vez.
    await userEvent.click(await screen.findByRole('tab', { name: 'Mensagens' }))
    const [feed] = await screen.findAllByRole('list', { name: 'Mensagens da turma' })
    const itens = within(feed).getAllByRole('listitem')
    expect(itens[0].textContent).toContain('Intervalo de 15 minutos.')
    const link = within(feed).getByRole('link', { name: 'https://exemplo.com/planilha' })
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('sessão encerrada vira somente leitura', async () => {
    const base = sala()
    buscarSala.mockResolvedValue({ ...base, sessao: { ...base.sessao!, status: 'encerrada' } })
    abrir()

    expect(await screen.findByText('Somente leitura')).toBeTruthy()
    expect(screen.queryByLabelText('Sua pergunta')).toBeNull()
    expect(screen.queryByPlaceholderText('Mensagem para a turma')).toBeNull()
  })

  it('abre sozinha a atividade publicada e mostra "Reconectando…" quando a conexão cai', async () => {
    buscarSala.mockResolvedValue(
      sala({
        atividades: [
          { id: 'a1', tipo: 'quiz', titulo: 'Quiz relâmpago', status: 'publicada', sessao_ao_vivo_id: 's1', tempo_limite_s: 60, publicada_em: new Date().toISOString(), mostrar_resultado: 'apos_encerrar' },
        ],
      }),
    )
    buscarAtividade.mockResolvedValue({
      id: 'a1', tipo: 'quiz', titulo: 'Quiz relâmpago', status: 'publicada', anonima: false, tempo_limite_s: 60,
      publicada_em: new Date().toISOString(), sessao_ao_vivo_id: 's1', respondida: false, mostra_resultado: false,
      itens: [{ id: 'i1', ordem: 1, enunciado: 'Qual símbolo fixa uma referência?', tipo_resposta: 'escolha_unica', obrigatorio: true, opcoes: [{ id: 'o1', ordem: 1, texto: '$' }, { id: 'o2', ordem: 2, texto: '#' }], minha_resposta: null, explicacao: null, resultado: null }],
    })
    abrir()

    const dialogo = await screen.findByRole('dialog', { name: 'Quiz relâmpago' })
    expect(await within(dialogo).findByText('1. Qual símbolo fixa uma referência?')).toBeTruthy()

    act(() => avisarConexao('reconectando'))
    expect(await screen.findByText('Reconectando…')).toBeTruthy()
  })
})
