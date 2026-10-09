export const TODAS = 'todas'

export type TurmaParaFiltro = { id: string; codigo: string; instituicao: string }
export type FiltroDeTurma = { instituicao: string; turma: string }

export const SEM_FILTRO: FiltroDeTurma = { instituicao: TODAS, turma: TODAS }

/** Instituições das turmas, sem repetição, em ordem alfabética. */
export function instituicoesDe(turmas: TurmaParaFiltro[]): string[] {
  return [...new Set(turmas.map((t) => t.instituicao.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Turmas que cabem na instituição escolhida (todas, se nenhuma foi escolhida). */
export function turmasDaInstituicao(turmas: TurmaParaFiltro[], instituicao: string): TurmaParaFiltro[] {
  return instituicao === TODAS ? turmas : turmas.filter((t) => t.instituicao.trim() === instituicao)
}

/**
 * Um item (conteúdo, atividade, questão) passa pelo filtro? Item sem turma
 * vale para todas as turmas, então aparece em qualquer filtro.
 */
export function passaNoFiltro(turmaIdDoItem: string | null, filtro: FiltroDeTurma, turmas: TurmaParaFiltro[]): boolean {
  if (turmaIdDoItem === null) return true
  if (filtro.turma !== TODAS) return turmaIdDoItem === filtro.turma
  if (filtro.instituicao === TODAS) return true
  return turmas.some((t) => t.id === turmaIdDoItem && t.instituicao.trim() === filtro.instituicao)
}

/** Ao trocar a instituição, a turma escolhida só continua se for dela. */
export function comInstituicao(filtro: FiltroDeTurma, instituicao: string, turmas: TurmaParaFiltro[]): FiltroDeTurma {
  const continua = turmasDaInstituicao(turmas, instituicao).some((t) => t.id === filtro.turma)
  return { instituicao, turma: continua ? filtro.turma : TODAS }
}
