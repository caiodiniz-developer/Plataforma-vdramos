import type { Nivel } from '@/lib/nivelDeMovimento'

/**
 * Abertura da página: uma cortina curta em Tinta, com um contador e o nome,
 * que entrega para o hero. Só no nível completo e só na primeira carga da
 * sessão (voltar para a landing pela navegação não repete).
 */
export const CHAVE_DA_ABERTURA = 'vr:abertura-vista'

/** Duração total da abertura, em segundos (contagem + cortina subindo). */
export const DURACAO_DA_ABERTURA = 1.6

type Guarda = Pick<Storage, 'getItem' | 'setItem'>

export function deveAbrir(nivel: Nivel, guarda: Guarda | undefined): boolean {
  if (nivel !== 'completo') return false
  try {
    return guarda?.getItem(CHAVE_DA_ABERTURA) !== '1'
  } catch {
    // Sem armazenamento não há como saber se já passou: melhor não repetir a cada tela.
    return false
  }
}

export function marcarAberturaVista(guarda: Guarda | undefined) {
  try {
    guarda?.setItem(CHAVE_DA_ABERTURA, '1')
  } catch {
    // Sem armazenamento, a marca vale só para esta página.
  }
}

/** Texto do contador para um progresso de 0 a 1: "000" a "100". */
export function textoDoContador(progresso: number): string {
  const fracao = Math.min(1, Math.max(0, Number.isFinite(progresso) ? progresso : 0))
  return String(Math.round(fracao * 100)).padStart(3, '0')
}

let fim = 0

/** A abertura avisa até quando vai cobrir a tela (relógio de `performance.now()`). */
export function registrarFimDaAbertura(instanteMs: number) {
  fim = instanteMs
}

/** Quantos segundos faltam para a cortina sair: o hero atrasa a entrada por esse tempo. */
export function tempoRestanteDaAbertura(agoraMs: number = performance.now()): number {
  return Math.max(0, (fim - agoraMs) / 1000)
}
