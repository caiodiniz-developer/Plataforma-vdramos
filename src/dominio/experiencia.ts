export type TipoExperiencia = 'profissional' | 'docencia'

export type Experiencia = {
  id: string
  tipo: TipoExperiencia
  organizacao: string
  cargo: string
  local: string | null
  data_inicio: string
  data_fim: string | null
  descricao: string | null
  tags: string[]
  ordem: number
  publicado: boolean
}

export const DESCRICAO_EXPERIENCIA_MAX = 600

/** PRD F1: publicadas, por `ordem` e depois da mais recente para a mais antiga. */
export function experienciasDaLanding(todas: Experiencia[], tipo: TipoExperiencia): Experiencia[] {
  return todas
    .filter((e) => e.publicado && e.tipo === tipo)
    .sort((a, b) => a.ordem - b.ordem || b.data_inicio.localeCompare(a.data_inicio))
}

/** Seção 7: aba sem experiências publicadas não aparece. */
export function abasVisiveis(todas: Experiencia[]): TipoExperiencia[] {
  return (['profissional', 'docencia'] as const).filter(
    (tipo) => experienciasDaLanding(todas, tipo).length > 0,
  )
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function mesAno(data: string): string {
  const [ano, mes] = data.split('-')
  return `${MESES[Number(mes) - 1]}/${ano}`
}

/** "mar/2022 — atual" ou "mar/2022 — out/2024". */
export function periodoDaExperiencia(dataInicio: string, dataFim: string | null): string {
  return `${mesAno(dataInicio)} — ${dataFim ? mesAno(dataFim) : 'atual'}`
}

/**
 * Tags de tema da landing seguem o guia: Dados, IA, Educação, Produto e
 * Engenharia têm cor própria; as demais usam o contorno neutro.
 */
export type VarianteTag = 'outline' | 'default' | 'orange' | 'violet' | 'green'

const VARIANTE_POR_TEMA: Record<string, VarianteTag> = {
  dados: 'outline',
  ia: 'default',
  educacao: 'orange',
  produto: 'violet',
  engenharia: 'green',
}

export function varianteDaTag(tag: string): VarianteTag {
  const chave = tag
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
  return VARIANTE_POR_TEMA[chave] ?? 'outline'
}
