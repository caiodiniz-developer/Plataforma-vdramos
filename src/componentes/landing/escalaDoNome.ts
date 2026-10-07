/**
 * Escala do nome no hero. O título é composto em Ubuntu Mono, em que todo
 * caractere avança meio "em": dá para calcular o tamanho de fonte que faz o
 * nome ocupar a largura exata da página, qualquer que seja o nome cadastrado.
 *
 *  - `colunasEmLinha`: caracteres do nome inteiro (uma linha, telas largas).
 *  - `colunasEmpilhado`: caracteres da maior palavra (uma palavra por linha,
 *    no celular).
 */
export type EscalaDoNome = { palavras: string[]; colunasEmLinha: number; colunasEmpilhado: number }

/** Piso de colunas: nomes muito curtos não podem estourar a altura da tela. */
export const COLUNAS_MINIMAS = 5

export function escalaDoNome(nome: string): EscalaDoNome {
  const palavras = nome.trim().split(/\s+/).filter(Boolean)
  const emLinha = palavras.join(' ').length
  const maior = palavras.reduce((maximo, palavra) => Math.max(maximo, palavra.length), 0)
  return {
    palavras,
    colunasEmLinha: Math.max(COLUNAS_MINIMAS, emLinha),
    colunasEmpilhado: Math.max(COLUNAS_MINIMAS, maior),
  }
}
