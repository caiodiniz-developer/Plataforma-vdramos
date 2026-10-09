export type ParteDoTexto = { tipo: 'texto'; texto: string } | { tipo: 'link'; texto: string; url: string }

// `[rótulo](https://…)` ou um endereço solto. Só http e https viram link.
const LINK = /\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"')\]]+)/g

/**
 * Divide um texto escrito pelo professor ou pelo aluno em trechos de texto e
 * links, na ordem. Aceita quantos links houver. A pontuação no fim de um
 * endereço solto fica com a frase, não com o link. A mesma regra vale no
 * e-mail (`supabase/functions/_shared/mensagens.ts`).
 */
export function partesDoTexto(texto: string): ParteDoTexto[] {
  const partes: ParteDoTexto[] = []
  let ultimo = 0
  for (const achado of texto.matchAll(LINK)) {
    const inicio = achado.index ?? 0
    if (inicio > ultimo) partes.push({ tipo: 'texto', texto: texto.slice(ultimo, inicio) })
    if (achado[2]) {
      partes.push({ tipo: 'link', texto: achado[1], url: achado[2] })
      ultimo = inicio + achado[0].length
    } else {
      const url = achado[3].replace(/[.,;:!?]+$/, '')
      partes.push({ tipo: 'link', texto: url, url })
      ultimo = inicio + url.length
    }
  }
  if (ultimo < texto.length) partes.push({ tipo: 'texto', texto: texto.slice(ultimo) })
  return partes
}

/** Trecho que o botão "Inserir link" acrescenta ao texto. Nulo se o endereço não serve. */
export function marcacaoDeLink(rotulo: string, endereco: string): string | null {
  let url = endereco.trim()
  if (url === '') return null
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    const analisada = new URL(url)
    if (!analisada.hostname.includes('.')) return null
  } catch {
    return null
  }
  if (/[\s)]/.test(url)) return null
  const texto = rotulo.trim().replace(/[[\]\n]/g, ' ')
  return texto === '' ? url : `[${texto}](${url})`
}
