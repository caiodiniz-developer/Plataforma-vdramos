export const PERGUNTA_MIN = 3
export const PERGUNTA_MAX = 500

export type DestinoPergunta = 'turma' | 'professor'
export type StatusPergunta = 'aberta' | 'respondida' | 'oculta'

export function perguntaValida(texto: string): boolean {
  const tamanho = texto.trim().length
  return tamanho >= PERGUNTA_MIN && tamanho <= PERGUNTA_MAX
}

type PerguntaDoMural = { votos: number; created_at: string }

/** PRD F11: mural ordenado por votos (maior primeiro) e depois por envio. */
export function ordenarMural<T extends PerguntaDoMural>(perguntas: T[]): T[] {
  return [...perguntas].sort((a, b) => {
    if (a.votos !== b.votos) return b.votos - a.votos
    return a.created_at.localeCompare(b.created_at)
  })
}

/**
 * Nome exibido no mural e no painel. Pergunta anônima mostra "Anônimo" para a
 * turma e para o professor; o autor fica guardado só no banco.
 */
export function autorExibido(anonima: boolean, nome: string | null): string {
  if (anonima || !nome) return 'Anônimo'
  return nome
}

export const ROTULO_STATUS_PERGUNTA: Record<StatusPergunta, string> = {
  aberta: 'Aberta',
  respondida: 'Respondida',
  oculta: 'Oculta',
}
