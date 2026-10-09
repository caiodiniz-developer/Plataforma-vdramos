// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TurmaDoAluno } from '@/dados/apoio'
import MinhasTurmas from './MinhasTurmas'

const entrarNaTurma = vi.fn<(codigo: string) => Promise<string>>()
const sairDaTurma = vi.fn<(turmaId: string) => Promise<void>>()
const trocar = vi.fn<(codigo: string) => void>()
const recarregar = vi.fn<() => void>()
let turmas: TurmaDoAluno[] = []

vi.mock('@/dados/apoio', () => ({
  entrarNaTurma: (codigo: string) => entrarNaTurma(codigo),
  sairDaTurma: (id: string) => sairDaTurma(id),
}))
vi.mock('@/componentes/plataforma/LayoutAluno', () => ({
  useTurmasDoAluno: () => ({ turmas, atual: turmas[0], trocar, recarregar }),
}))

const turma = (codigo: string, id: string): TurmaDoAluno => ({ id, codigo, nome_curso: 'Desenvolvimento Web', status: 'ativa', inscricao_id: `insc-${id}` })

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Minhas turmas', () => {
  it('com uma turma só, mostra qual está em uso e não deixa sair', () => {
    turmas = [turma('TURMA-001', 't1')]
    render(<MinhasTurmas />)
    const cartao = screen.getByRole('heading', { level: 2, name: 'TURMA-001' }).closest('li')!
    expect(within(cartao).getByText('Em uso')).toBeTruthy()
    expect((within(cartao).getByRole('button', { name: 'Sair da turma' }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(cartao).queryByRole('button', { name: 'Usar esta turma' })).toBeNull()
  })

  it('entra em outra turma pelo ID, em maiúsculas, e passa a usá-la', async () => {
    turmas = [turma('TURMA-001', 't1')]
    entrarNaTurma.mockResolvedValue('t2')
    render(<MinhasTurmas />)

    await userEvent.click(screen.getByRole('button', { name: 'Entrar na turma' }))
    expect(screen.getByRole('alert').textContent).toBe('Informe o ID da turma.')
    expect(entrarNaTurma).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('ID da turma'), ' turma-002 ')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar na turma' }))
    await waitFor(() => expect(entrarNaTurma).toHaveBeenCalledWith('TURMA-002'))
    expect(trocar).toHaveBeenCalledWith('TURMA-002')
    expect(recarregar).toHaveBeenCalled()
  })

  it('mostra a recusa do servidor e mantém o que foi digitado', async () => {
    turmas = [turma('TURMA-001', 't1')]
    entrarNaTurma.mockRejectedValue(new Error('Não encontramos uma turma ativa com este ID. Confira com o professor.'))
    render(<MinhasTurmas />)
    await userEvent.type(screen.getByLabelText('ID da turma'), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar na turma' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Não encontramos uma turma ativa')
    expect((screen.getByLabelText('ID da turma') as HTMLInputElement).value).toBe('errada')
    expect(trocar).not.toHaveBeenCalled()
  })

  it('com duas turmas, troca a turma em uso e só sai depois de confirmar', async () => {
    turmas = [turma('TURMA-001', 't1'), turma('TURMA-002', 't2')]
    sairDaTurma.mockResolvedValue()
    render(<MinhasTurmas />)

    const outra = screen.getByRole('heading', { level: 2, name: 'TURMA-002' }).closest('li')!
    await userEvent.click(within(outra).getByRole('button', { name: 'Usar esta turma' }))
    expect(trocar).toHaveBeenCalledWith('TURMA-002')

    await userEvent.click(within(outra).getByRole('button', { name: 'Sair da turma' }))
    const confirmacao = await screen.findByRole('alertdialog')
    expect(confirmacao.textContent).toContain('Sair da turma TURMA-002?')
    expect(sairDaTurma).not.toHaveBeenCalled()

    await userEvent.click(within(confirmacao).getByRole('button', { name: 'Sair da turma' }))
    await waitFor(() => expect(sairDaTurma).toHaveBeenCalledWith('t2'))
    await waitFor(() => expect(recarregar).toHaveBeenCalled())
  })
})
