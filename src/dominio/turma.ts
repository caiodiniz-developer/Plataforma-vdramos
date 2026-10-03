export const PADRAO_CODIGO_TURMA = /^[A-Z0-9-]{4,20}$/

/** Mesmo `check` da coluna `turma.codigo`. */
export function codigoTurmaValido(codigo: string): boolean {
  return PADRAO_CODIGO_TURMA.test(codigo)
}

const SEM_PESO = new Set(['a', 'as', 'o', 'os', 'e', 'de', 'da', 'do', 'das', 'dos', 'com', 'em', 'para', 'por'])

/** Siglas usuais de cidade; fora da lista, usa as três primeiras letras. */
const SIGLAS_CIDADE: Record<string, string> = {
  CAMPINAS: 'CPS',
  'SAO PAULO': 'SP',
  'RIO DE JANEIRO': 'RJ',
  'BELO HORIZONTE': 'BH',
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function siglaCurso(nome: string): string {
  const palavras = semAcento(nome)
    .split(/[^A-Za-z0-9]+/)
    .filter((p) => p !== '' && !SEM_PESO.has(p.toLowerCase()))
  if (palavras.length === 0) return 'TURMA'

  const [primeira, ...demais] = palavras
  // Palavras já em maiúsculas (IA, BI, SQL) entram inteiras; sem elas, vão as iniciais.
  const siglas = demais.filter((p) => p.length <= 4 && p === p.toUpperCase())
  const complemento = siglas.length > 0 ? siglas.join('') : demais.map((p) => p[0]).join('')
  return (primeira.slice(0, 3) + complemento).toUpperCase().slice(0, 8)
}

function siglaCidade(cidade: string): string {
  const limpa = semAcento(cidade).toUpperCase().trim()
  return SIGLAS_CIDADE[limpa] ?? limpa.replace(/[^A-Z0-9]/g, '').slice(0, 3)
}

/**
 * PRD F16: sugestão editável de código, no formato CURSO-CIDADE-AAMM
 * (ex.: "Excel Básico com IA Generativa" em Campinas, out/2026 → EXCIA-CPS-2610).
 */
export function sugerirCodigoTurma(nomeCurso: string, cidade: string, dataInicio: string): string {
  const [ano, mes] = dataInicio.split('-')
  const partes = [siglaCurso(nomeCurso), siglaCidade(cidade), `${ano.slice(2)}${mes}`]
  return partes.filter((p) => p !== '').join('-').slice(0, 20)
}

export type StatusTurma = 'planejada' | 'ativa' | 'encerrada'

export const ROTULO_STATUS_TURMA: Record<StatusTurma, string> = {
  planejada: 'Planejada',
  ativa: 'Ativa',
  encerrada: 'Encerrada',
}

/** Turma encerrada fica em modo leitura: sem sessão ao vivo e sem novas respostas. */
export function turmaSomenteLeitura(status: StatusTurma): boolean {
  return status === 'encerrada'
}
