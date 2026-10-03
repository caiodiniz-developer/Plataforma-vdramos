import { matriculaValida, normalizarMatricula } from './matricula'

export type IdImportado = { matricula: string; nome_referencia: string | null }

export type LinhaInvalida = { linha: number; conteudo: string }

export type PreviaImportacao = {
  /** IDs que ainda não existem na turma e serão inseridos. */
  novos: IdImportado[]
  /** IDs da lista que a turma já tem; não são duplicados. */
  existentes: IdImportado[]
  /** Linhas fora do padrão, mostradas na prévia. */
  invalidos: LinhaInvalida[]
  /** Repetições dentro da própria lista, contadas uma vez só. */
  duplicadosNaLista: number
}

const CABECALHO = /^matr[ií]cula$/i

/**
 * PRD F17: interpreta a lista colada (um ID por linha, `;nome` opcional) ou
 * um CSV `matricula,nome`, e monta a prévia antes da confirmação.
 * Linhas vazias são ignoradas; o separador pode ser `;`, `,` ou tabulação.
 */
export function previaImportacao(texto: string, matriculasExistentes: string[]): PreviaImportacao {
  const jaNaTurma = new Set(matriculasExistentes.map(normalizarMatricula))
  const vistos = new Set<string>()
  const previa: PreviaImportacao = { novos: [], existentes: [], invalidos: [], duplicadosNaLista: 0 }

  texto.split(/\r?\n/).forEach((bruta, indice) => {
    const conteudo = bruta.trim()
    if (conteudo === '') return

    const [primeiro, ...resto] = conteudo.split(/[;,\t]/)
    const campo = primeiro.trim().replace(/^"|"$/g, '')
    if (indice === 0 && CABECALHO.test(campo)) return

    if (!matriculaValida(campo)) {
      previa.invalidos.push({ linha: indice + 1, conteudo })
      return
    }

    const matricula = normalizarMatricula(campo)
    if (vistos.has(matricula)) {
      previa.duplicadosNaLista += 1
      return
    }
    vistos.add(matricula)

    const nome = resto.join(' ').trim().replace(/^"|"$/g, '').trim()
    const id: IdImportado = { matricula, nome_referencia: nome === '' ? null : nome }
    if (jaNaTurma.has(matricula)) previa.existentes.push(id)
    else previa.novos.push(id)
  })

  return previa
}
