/**
 * Normalização dos identificadores digitados pelo aluno (PRD F3 e F17).
 * A mesma regra vale no cliente, na importação do admin e na Edge Function
 * `acesso-aluno`: sem espaços nas pontas e em maiúsculas.
 */
export function normalizarMatricula(valor: string): string {
  return valor.trim().toUpperCase()
}

const PADRAO_MATRICULA = /^[A-Z0-9][A-Z0-9._/-]{0,39}$/

/** Matrícula aceita: 1 a 40 caracteres, letras, números e . _ / - (sem espaços). */
export function matriculaValida(valor: string): boolean {
  return PADRAO_MATRICULA.test(normalizarMatricula(valor))
}
