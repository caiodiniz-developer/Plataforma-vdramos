// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DadosDeCadastro, EtapaDeAcesso, IdsDeAcesso } from '@/dados/acesso'
import Entrar from './Entrar'

const verificarIds = vi.fn<(ids: IdsDeAcesso) => Promise<EtapaDeAcesso>>()
const cadastrar = vi.fn<(ids: IdsDeAcesso, dados: DadosDeCadastro) => Promise<EtapaDeAcesso>>()
const confirmarCodigo = vi.fn<(ids: IdsDeAcesso, codigo: string) => Promise<string>>()

vi.mock('@/dados/acesso', () => ({
  verificarIds: (ids: IdsDeAcesso) => verificarIds(ids),
  cadastrar: (ids: IdsDeAcesso, dados: DadosDeCadastro) => cadastrar(ids, dados),
  confirmarCodigo: (ids: IdsDeAcesso, codigo: string) => confirmarCodigo(ids, codigo),
}))

function abrir() {
  return render(
    <MemoryRouter initialEntries={['/aluno/entrar']}>
      <Routes>
        <Route path="/aluno/entrar" element={<Entrar />} />
        <Route path="/aluno/turmas/:codigo" element={<p>Página da turma</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function preencherIds() {
  await userEvent.type(screen.getByLabelText('ID do aluno'), 'a100')
  await userEvent.type(screen.getByLabelText('ID da turma'), 'excia-cps-2610')
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Entrar (aluno)', () => {
  it('login recorrente: IDs → código, com e-mail mascarado, e segue para a turma', async () => {
    verificarIds.mockResolvedValue({ etapa: 'codigo', emailMascarado: 'a•••@gmail.com' })
    confirmarCodigo.mockResolvedValue('EXCIA-CPS-2610')
    abrir()

    expect(screen.getByText('Etapa 1 de 2')).toBeTruthy()
    await preencherIds()

    expect(await screen.findByText(/a•••@gmail\.com/)).toBeTruthy()
    expect(screen.getByText('Etapa 2 de 2')).toBeTruthy()
    // Reenvio só libera depois de 60 s.
    expect(screen.getByRole('button', { name: /Reenviar código em/ }).hasAttribute('disabled')).toBe(true)

    await userEvent.type(screen.getByRole('textbox'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Página da turma')).toBeTruthy()
    expect(confirmarCodigo).toHaveBeenCalledWith({ matricula: 'a100', codigoTurma: 'excia-cps-2610' }, '123456')
  })

  it('primeiro acesso: pede cadastro, exige o termo e não pré-marca a comunicação', async () => {
    verificarIds.mockResolvedValue({ etapa: 'cadastro' })
    cadastrar.mockResolvedValue({ etapa: 'codigo', emailMascarado: 'a•••@empresa.com' })
    abrir()
    await preencherIds()

    expect(await screen.findByText('Etapa 2 de 3')).toBeTruthy()
    const comunicacao = screen.getByRole('switch')
    expect(comunicacao.getAttribute('aria-checked')).toBe('false')

    await userEvent.type(screen.getByLabelText('Nome completo'), 'Ana Souza')
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@empresa.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar código' }))

    expect(await screen.findByText('É preciso aceitar o termo de uso para continuar.')).toBeTruthy()
    expect(cadastrar).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Enviar código' }))

    expect(await screen.findByText('Etapa 3 de 3')).toBeTruthy()
    expect(cadastrar).toHaveBeenCalledWith(
      { matricula: 'a100', codigoTurma: 'excia-cps-2610' },
      { nome: 'Ana Souza', email: 'ana@empresa.com', aceiteTermo: true, querComunicacao: false },
    )
  })

  it('mostra a mensagem genérica do servidor quando os IDs não batem', async () => {
    verificarIds.mockRejectedValue(new Error('Não encontramos essa combinação. Confira com o professor.'))
    abrir()
    await preencherIds()

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Não encontramos essa combinação. Confira com o professor.',
    )
    expect(screen.getByText('Etapa 1 de 2')).toBeTruthy()
  })

  it('não chama o servidor com campos vazios nem com código incompleto', async () => {
    verificarIds.mockResolvedValue({ etapa: 'codigo', emailMascarado: 'a•••@gmail.com' })
    abrir()

    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText('Informe o ID do aluno e o ID da turma.')).toBeTruthy()
    expect(verificarIds).not.toHaveBeenCalled()

    await preencherIds()
    await userEvent.type(await screen.findByRole('textbox'), '123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.getByText('Informe o código de 6 dígitos.')).toBeTruthy()
    expect(confirmarCodigo).not.toHaveBeenCalled()
  })
})
