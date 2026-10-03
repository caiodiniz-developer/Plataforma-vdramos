export const MENSAGEM_MIN = 1
export const MENSAGEM_MAX = 1000
/** PRD F12: uma mensagem a cada 5 s por aluno. */
export const INTERVALO_ENTRE_MENSAGENS_MS = 5000

const SO_URL = /^https?:\/\/[^\s<>"']+$/i
const URL_NO_TEXTO = /https?:\/\/[^\s<>"']+/gi

/** Mensagem cujo texto é só uma URL é gravada com `tipo = 'link'`. */
export function tipoDaMensagem(texto: string): 'texto' | 'link' {
  return SO_URL.test(texto.trim()) ? 'link' : 'texto'
}

export function mensagemValida(texto: string): boolean {
  const tamanho = texto.trim().length
  return tamanho >= MENSAGEM_MIN && tamanho <= MENSAGEM_MAX
}

/** Milissegundos que faltam para o aluno poder enviar de novo (0 = liberado). */
export function esperaParaEnviar(ultimoEnvioMs: number | null, agoraMs: number): number {
  if (ultimoEnvioMs === null) return 0
  return Math.max(0, INTERVALO_ENTRE_MENSAGENS_MS - (agoraMs - ultimoEnvioMs))
}

export type TrechoMensagem = { tipo: 'texto'; valor: string } | { tipo: 'link'; valor: string }

/**
 * Divide a mensagem em trechos de texto e de link. Quem renderiza usa texto
 * puro para os trechos (nunca HTML) e `rel="noopener noreferrer"` nos links,
 * como pede a seção 7 do PRD. Só http e https viram link.
 */
export function trechosDaMensagem(texto: string): TrechoMensagem[] {
  const trechos: TrechoMensagem[] = []
  let cursor = 0
  for (const achado of texto.matchAll(URL_NO_TEXTO)) {
    // Pontuação final ("veja https://x.com.") não faz parte do endereço.
    const url = achado[0].replace(/[.,;:!?)\]]+$/, '')
    const inicio = achado.index
    if (inicio > cursor) trechos.push({ tipo: 'texto', valor: texto.slice(cursor, inicio) })
    trechos.push({ tipo: 'link', valor: url })
    cursor = inicio + url.length
  }
  if (cursor < texto.length) trechos.push({ tipo: 'texto', valor: texto.slice(cursor) })
  return trechos
}

type MensagemDoFeed = { fixada: boolean; removida: boolean; created_at: string }

/** Feed: removidas somem para todos; fixadas no topo; demais em ordem de envio. */
export function ordenarFeed<T extends MensagemDoFeed>(mensagens: T[]): T[] {
  return mensagens
    .filter((m) => !m.removida)
    .sort((a, b) => {
      if (a.fixada !== b.fixada) return a.fixada ? -1 : 1
      return a.created_at.localeCompare(b.created_at)
    })
}
