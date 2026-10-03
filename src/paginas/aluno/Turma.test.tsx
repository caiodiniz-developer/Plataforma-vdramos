// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Turma as DadosDaTurma, TurmaResumida } from '@/dados/turma'
import Turma from './Turma'

const buscarTurma = vi.fn<(codigo: string) => Promise<DadosDaTurma>>()
const minhasTurmas = vi.fn<() => Promise<TurmaResumida[]>>()
const sair = vi.fn<() => Promise<void>>()

vi.mock('@/dados/turma', async (original) => ({
  ...(await original<typeof import('@/dados/turma')>()),
  buscarTurma: (codigo: string) => buscarTurma(codigo),
  minhasTurmas: () => minhasTurmas(),
}))
vi.mock('@/dados/sessao', () => ({ sair: () => sair() }))

function turma(parcial: Partial<DadosDaTurma> = {}): DadosDaTurma {
  return {
    id: 't1',
    codigo: 'EXCIA-CPS-2610',
    instituicao: 'SENAI',
    cidade: 'Campinas',
    modalidade: 'presencial',
    data_inicio: '2026-10-14',
    data_fim: '2026-10-28',
    vagas: 20,
    status: 'ativa',
    fuso: 'America/Sao_Paulo',
    curso: {
      id: 'c1',
      nome: 'Excel Básico com IA Generativa',
      tipo_formacao: 'FIC Aperfeiçoamento',
      carga_horaria_h: 20,
      objetivo: 'Estruturar dados e usar IA de forma ética.',
      ementa_md: '- Estruturação de dados\n- IA generativa',
      publico_alvo: null,
      pre_requisitos: null,
      criterios_avaliacao_md: null,
      capacidades: [
        { id: 'k1', codigo: 'CT1', tipo: 'tecnica', descricao: 'Organizar dados em tabelas.' },
        { id: 'k2', codigo: 'CS1', tipo: 'socioemocional', descricao: 'Trabalhar em equipe.' },
      ],
    },
    encontros: [
      {
        id: 'e1',
        numero: 1,
        data: '2099-10-14',
        hora_inicio: '18:45:00',
        hora_fim: '22:45:00',
        titulo: 'SA1 · Estruturação de Dados e IA Ética',
        descricao: null,
        local: 'Laboratório 3',
        sessao: { id: 's1', status: 'agendada' },
        blocos: [
          { id: 'b1', ordem: 1, hora_inicio: '18:45:00', duracao_min: 15, tipo: 'abertura', titulo: 'Abertura', descricao: null },
          { id: 'b2', ordem: 2, hora_inicio: '19:00:00', duracao_min: 60, tipo: 'teoria', titulo: 'Pilares do uso ético da IA', descricao: null },
        ],
      },
    ],
    materiais: [
      { id: 'm1', encontro_id: null, titulo: 'Apostila', tipo: 'link', tipo_outro: null, url: 'https://exemplo.com/a', arquivo_path: null, ordem: 0 },
      { id: 'm2', encontro_id: 'e1', titulo: 'Planilha base', tipo: 'exercicio', tipo_outro: null, url: 'https://exemplo.com/b', arquivo_path: null, ordem: 0 },
    ],
    ...parcial,
  }
}

function abrir() {
  return render(
    <MemoryRouter initialEntries={['/aluno/turmas/EXCIA-CPS-2610']}>
      <Routes>
        <Route path="/aluno/turmas/:codigo" element={<Turma />} />
        <Route path="/aluno/entrar" element={<p>Tela de entrada</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Turma do aluno', () => {
  it('mostra o cabeçalho da turma e o calendário com o próximo encontro aberto', async () => {
    buscarTurma.mockResolvedValue(turma())
    minhasTurmas.mockResolvedValue([{ codigo: 'EXCIA-CPS-2610', nome_curso: 'Excel Básico com IA Generativa' }])
    abrir()

    expect(await screen.findByRole('heading', { level: 1, name: 'Excel Básico com IA Generativa' })).toBeTruthy()
    expect(screen.getByText(/SENAI · Campinas · Presencial · 14\/10\/2026 a 28\/10\/2026 · 20 vagas/)).toBeTruthy()
    expect(screen.getByText('Próximo encontro')).toBeTruthy()
    expect(screen.getByText(/14\/10\/2099 · quarta-feira · 18:45–22:45 · Laboratório 3/)).toBeTruthy()

    // Tabela de blocos do encontro em destaque, com tipo em texto (não só cor).
    const linha = screen.getByRole('row', { name: /19:00 60 Teoria Pilares do uso ético da IA/ })
    expect(within(linha).getByText('Teoria')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Régua do encontro' })).toBeTruthy()
    // Com uma turma só, não há seletor de turma.
    expect(screen.queryByRole('combobox', { name: 'Trocar de turma' })).toBeNull()
  })

  it('mostra a faixa de aula ao vivo quando há sessão aberta', async () => {
    const base = turma()
    buscarTurma.mockResolvedValue({
      ...base,
      encontros: [{ ...base.encontros[0], sessao: { id: 's1', status: 'aberta' } }],
    })
    minhasTurmas.mockResolvedValue([])
    abrir()

    expect(await screen.findByText('Aula ao vivo agora')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Entrar na aula ao vivo' }).getAttribute('href')).toBe(
      '/aluno/turmas/EXCIA-CPS-2610/ao-vivo',
    )
  })

  it('turma encerrada fica em modo leitura, sem aula ao vivo', async () => {
    const base = turma({ status: 'encerrada' })
    buscarTurma.mockResolvedValue({
      ...base,
      encontros: [{ ...base.encontros[0], sessao: { id: 's1', status: 'aberta' } }],
    })
    minhasTurmas.mockResolvedValue([])
    abrir()

    expect(await screen.findByText(/somente leitura/)).toBeTruthy()
    expect(screen.queryByText('Aula ao vivo agora')).toBeNull()
  })

  it('agrupa materiais por encontro, com os gerais primeiro, e mostra o curso', async () => {
    buscarTurma.mockResolvedValue(turma())
    minhasTurmas.mockResolvedValue([])
    abrir()

    await userEvent.click(await screen.findByRole('tab', { name: 'Materiais' }))
    const grupos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(grupos).toEqual(['Material geral do curso', 'Encontro 1 · SA1 · Estruturação de Dados e IA Ética'])
    expect(screen.getByText('Apostila')).toBeTruthy()

    await userEvent.click(screen.getByRole('tab', { name: 'Curso' }))
    expect(screen.getByText('20 horas')).toBeTruthy()
    expect(screen.getByText('CT1')).toBeTruthy()
    expect(screen.getByText('Socioemocionais')).toBeTruthy()
  })

  it('mostra os estados vazios com o texto do PRD', async () => {
    buscarTurma.mockResolvedValue(turma({ encontros: [], materiais: [] }))
    minhasTurmas.mockResolvedValue([])
    abrir()

    expect(await screen.findByText('O professor ainda não publicou o calendário.')).toBeTruthy()
    await userEvent.click(screen.getByRole('tab', { name: 'Materiais' }))
    expect(screen.getByText('O professor ainda não publicou materiais.')).toBeTruthy()
  })

  it('acesso revogado encerra a sessão e volta para a entrada', async () => {
    buscarTurma.mockRejectedValue(new Error('Você não tem acesso a esta turma.'))
    minhasTurmas.mockResolvedValue([])
    sair.mockResolvedValue()
    abrir()

    expect(await screen.findByText('Tela de entrada')).toBeTruthy()
    expect(sair).toHaveBeenCalled()
  })
})
