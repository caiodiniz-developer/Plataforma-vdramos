// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entrega } from '@/dados/apoio'
import type { AtividadeParaAluno, RespostaDoItem } from '@/dados/sala'
import { RespostaDaAtividade } from './RespostaDaAtividade'

const buscarAtividade = vi.fn<(id: string) => Promise<AtividadeParaAluno>>()
const responderAtividade = vi.fn<(id: string, respostas: RespostaDoItem[]) => Promise<void>>()
const entregasDaAtividade = vi.fn<(id: string) => Promise<{ aceita: boolean; entregas: Entrega[] }>>()
const enviarEntrega = vi.fn<(id: string, arquivo: File) => Promise<void>>()
const avisarProfessorDaResposta = vi.fn<(id: string) => Promise<void>>()

vi.mock('@/dados/sala', () => ({
  buscarAtividade: (id: string) => buscarAtividade(id),
  responderAtividade: (id: string, r: RespostaDoItem[]) => responderAtividade(id, r),
}))
vi.mock('@/dados/apoio', () => ({
  ENTREGA_MAXIMA_MB: 25,
  ENTREGAS_POR_ATIVIDADE: 5,
  entregasDaAtividade: (id: string) => entregasDaAtividade(id),
  enviarEntrega: (id: string, a: File) => enviarEntrega(id, a),
  avisarProfessorDaResposta: (id: string) => avisarProfessorDaResposta(id),
  urlAssinada: vi.fn(),
}))

const licao: AtividadeParaAluno = {
  id: 'a1',
  tipo: 'licao',
  titulo: 'Projeto da página',
  status: 'publicada',
  anonima: false,
  tempo_limite_s: null,
  publicada_em: '2026-10-08T12:00:00Z',
  sessao_ao_vivo_id: null,
  respondida: false,
  mostra_resultado: false,
  itens: [
    { id: 'i1', ordem: 1, enunciado: 'O que você fez?', tipo_resposta: 'texto_livre', obrigatorio: true, opcoes: [], minha_resposta: null, explicacao: null, resultado: null },
  ],
}

const arquivo = (nome: string, bytes = 10) => new File([new Uint8Array(bytes)], nome, { type: 'application/zip' })

beforeEach(() => {
  buscarAtividade.mockResolvedValue(licao)
  responderAtividade.mockResolvedValue()
  enviarEntrega.mockResolvedValue()
  avisarProfessorDaResposta.mockResolvedValue()
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('RespostaDaAtividade · arquivos', () => {
  it('atividade que não recebe arquivo não mostra o campo', async () => {
    entregasDaAtividade.mockResolvedValue({ aceita: false, entregas: [] })
    render(<RespostaDaAtividade atividadeId="a1" />)
    expect(await screen.findByText('1. O que você fez?')).toBeTruthy()
    expect(screen.queryByLabelText('Anexar arquivos (opcional)')).toBeNull()
  })

  it('envia os arquivos antes das respostas e depois avisa o professor', async () => {
    entregasDaAtividade.mockResolvedValue({ aceita: true, entregas: [] })
    const ordem: string[] = []
    enviarEntrega.mockImplementation(async (_id, a) => void ordem.push(`arquivo:${a.name}`))
    responderAtividade.mockImplementation(async () => void ordem.push('respostas'))
    avisarProfessorDaResposta.mockImplementation(async () => void ordem.push('e-mail'))
    render(<RespostaDaAtividade atividadeId="a1" />)

    await userEvent.type(await screen.findByRole('textbox', { name: 'O que você fez?' }), 'Fiz a página.')
    await userEvent.upload(screen.getByLabelText('Anexar arquivos (opcional)'), [arquivo('projeto.zip'), arquivo('notas.pdf')])
    expect(screen.getByRole('list', { name: 'Arquivos escolhidos' }).textContent).toContain('projeto.zip')

    await userEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }))
    await waitFor(() => expect(avisarProfessorDaResposta).toHaveBeenCalledWith('a1'))
    expect(ordem).toEqual(['arquivo:projeto.zip', 'arquivo:notas.pdf', 'respostas', 'e-mail'])
    expect(responderAtividade).toHaveBeenCalledWith('a1', [{ item_id: 'i1', texto: 'Fiz a página.' }])
  })

  it('se um arquivo falha, a resposta não é enviada e o erro aparece', async () => {
    entregasDaAtividade.mockResolvedValue({ aceita: true, entregas: [] })
    enviarEntrega.mockRejectedValue(new Error('Não foi possível enviar o arquivo. Tente de novo.'))
    render(<RespostaDaAtividade atividadeId="a1" />)

    await userEvent.type(await screen.findByRole('textbox', { name: 'O que você fez?' }), 'Fiz a página.')
    await userEvent.upload(screen.getByLabelText('Anexar arquivos (opcional)'), arquivo('projeto.zip'))
    await userEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }))

    expect(await screen.findByText('Não foi possível enviar o arquivo. Tente de novo.')).toBeTruthy()
    expect(responderAtividade).not.toHaveBeenCalled()
    expect(avisarProfessorDaResposta).not.toHaveBeenCalled()
  })

  it('barra antes de enviar quando passa do limite de arquivos', async () => {
    const jaEnviados = [1, 2, 3, 4].map((n) => ({ id: `e${n}`, nome_arquivo: `parte-${n}.zip`, tamanho_bytes: 2048, arquivo_path: `entregas/u/${n}.zip`, created_at: '2026-10-08T12:00:00Z' }))
    entregasDaAtividade.mockResolvedValue({ aceita: true, entregas: jaEnviados })
    render(<RespostaDaAtividade atividadeId="a1" />)

    await userEvent.type(await screen.findByRole('textbox', { name: 'O que você fez?' }), 'Fiz a página.')
    expect(screen.getByRole('list', { name: 'Arquivos enviados' }).textContent).toContain('parte-4.zip')
    await userEvent.upload(screen.getByLabelText('Anexar arquivos (opcional)'), [arquivo('a.zip'), arquivo('b.zip')])
    await userEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }))

    expect(await screen.findByText('Dá para enviar mais 1 arquivo. Junte os demais em um .zip.')).toBeTruthy()
    expect(enviarEntrega).not.toHaveBeenCalled()
    expect(responderAtividade).not.toHaveBeenCalled()
  })

  it('depois de respondida, mostra o que foi enviado e não deixa anexar', async () => {
    buscarAtividade.mockResolvedValue({ ...licao, respondida: true, itens: [{ ...licao.itens[0], minha_resposta: { opcao_ids: null, valor: null, texto: 'Fiz.', correta: null } }] })
    entregasDaAtividade.mockResolvedValue({
      aceita: true,
      entregas: [{ id: 'e1', nome_arquivo: 'projeto.zip', tamanho_bytes: 3 * 1024 * 1024, arquivo_path: 'entregas/u/p.zip', created_at: '2026-10-08T12:00:00Z' }],
    })
    render(<RespostaDaAtividade atividadeId="a1" />)
    expect(await screen.findByRole('button', { name: 'projeto.zip' })).toBeTruthy()
    expect(screen.getByText('3,0 MB')).toBeTruthy()
    expect(screen.queryByLabelText('Anexar arquivos (opcional)')).toBeNull()
  })
})
