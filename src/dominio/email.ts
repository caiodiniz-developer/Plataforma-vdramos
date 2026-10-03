const PADRAO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function emailValido(email: string): boolean {
  return PADRAO_EMAIL.test(email.trim())
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * PRD F4: no login recorrente o aluno vê só a primeira letra do e-mail
 * cadastrado (ex.: v•••@gmail.com), para conferir sem expor o endereço.
 */
export function mascararEmail(email: string): string {
  const [usuario, dominio] = normalizarEmail(email).split('@')
  if (!usuario || !dominio) return '•••'
  return `${usuario[0]}•••@${dominio}`
}
