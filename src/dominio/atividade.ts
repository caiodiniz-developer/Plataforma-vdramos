export type TipoAtividade = 'quiz' | 'pesquisa_satisfacao' | 'enquete' | 'questao' | 'licao'
export type AlvoAtividade = 'teoria' | 'pratica' | 'encontro' | 'curso'
export type StatusAtividade = 'rascunho' | 'publicada' | 'encerrada'
export type MostrarResultado = 'nunca' | 'apos_responder' | 'apos_encerrar'
export type TipoResposta =
  | 'escolha_unica'
  | 'escolha_multipla'
  | 'escala_1_5'
  | 'nps_0_10'
  | 'texto_livre'

export type OpcaoRascunho = { texto: string; correta: boolean }

export type ItemRascunho = {
  enunciado: string
  tipo_resposta: TipoResposta
  obrigatorio: boolean
  explicacao: string | null
  opcoes: OpcaoRascunho[]
}

export type AtividadeRascunho = {
  tipo: TipoAtividade
  titulo: string
  alvo: AlvoAtividade | null
  itens: ItemRascunho[]
}

export const ROTULO_TIPO_ATIVIDADE: Record<TipoAtividade, string> = {
  quiz: 'Quiz',
  pesquisa_satisfacao: 'Pesquisa de satisfação',
  enquete: 'Enquete',
  questao: 'Questão',
  licao: 'Atividade',
}

export const ROTULO_STATUS_ATIVIDADE: Record<StatusAtividade, string> = {
  rascunho: 'Rascunho',
  publicada: 'Publicada',
  encerrada: 'Encerrada',
}

function ehEscolha(tipo: TipoResposta): boolean {
  return tipo === 'escolha_unica' || tipo === 'escolha_multipla'
}

/**
 * PRD F19 e seção 7: o que impede publicar uma atividade. Lista vazia = pode publicar.
 * As mensagens vão direto para a tela do construtor.
 */
export function problemasDaAtividade(atividade: AtividadeRascunho): string[] {
  const problemas: string[] = []

  if (atividade.titulo.trim() === '') problemas.push('Informe o título da atividade.')
  if (atividade.tipo === 'pesquisa_satisfacao' && atividade.alvo === null) {
    problemas.push('Escolha o que a pesquisa avalia.')
  }
  if (atividade.itens.length === 0) problemas.push('Adicione ao menos um item.')

  atividade.itens.forEach((item, indice) => {
    const n = indice + 1
    if (item.enunciado.trim() === '') problemas.push(`Item ${n}: escreva o enunciado.`)
    if (!ehEscolha(item.tipo_resposta)) return

    const opcoes = item.opcoes.filter((o) => o.texto.trim() !== '')
    if (opcoes.length < 2) problemas.push(`Item ${n}: inclua ao menos duas opções.`)
    // Quiz e questão avulsa são corrigidos: precisam de gabarito.
    if (atividade.tipo !== 'quiz' && atividade.tipo !== 'questao') return

    const corretas = opcoes.filter((o) => o.correta).length
    if (corretas === 0) problemas.push(`Item ${n}: marque a opção correta.`)
    if (item.tipo_resposta === 'escolha_unica' && corretas > 1) {
      problemas.push(`Item ${n}: escolha única aceita só uma opção correta.`)
    }
  })

  return problemas
}

/**
 * Seção 7: atividade publicada que já tem respostas fica com itens e opções
 * somente leitura; só o título continua editável.
 */
export function itensEditaveis(status: StatusAtividade, totalRespostas: number): boolean {
  return status === 'rascunho' || totalRespostas === 0
}

function itemEscala(enunciado: string): ItemRascunho {
  return { enunciado, tipo_resposta: 'escala_1_5', obrigatorio: true, explicacao: null, opcoes: [] }
}

/** PRD F19: modelos prontos "Satisfação — teoria" e "Satisfação — prática". */
export function modeloSatisfacao(alvo: 'teoria' | 'pratica'): AtividadeRascunho {
  const parte = alvo === 'teoria' ? 'a explicação' : 'a atividade prática'
  return {
    tipo: 'pesquisa_satisfacao',
    titulo: alvo === 'teoria' ? 'Satisfação — teoria' : 'Satisfação — prática',
    alvo,
    itens: [
      itemEscala(`Clareza: ${parte} foi fácil de acompanhar?`),
      itemEscala('Ritmo: o tempo dedicado a esta parte foi adequado?'),
      itemEscala('Utilidade: você consegue aplicar o que viu no seu trabalho?'),
      {
        enunciado: 'O que podemos melhorar nesta parte?',
        tipo_resposta: 'texto_livre',
        obrigatorio: false,
        explicacao: null,
        opcoes: [],
      },
    ],
  }
}

/** Tempo restante de um quiz ao vivo, em segundos (0 = encerrado; null = sem limite). */
export function segundosRestantes(
  publicadaEm: string | null,
  tempoLimiteS: number | null,
  agora: Date,
): number | null {
  if (!publicadaEm || !tempoLimiteS) return null
  const fim = new Date(publicadaEm).getTime() + tempoLimiteS * 1000
  return Math.max(0, Math.ceil((fim - agora.getTime()) / 1000))
}

/** Quando o aluno pode ver o resultado agregado, conforme `mostrar_resultado`. */
export function alunoVeResultado(
  regra: MostrarResultado,
  status: StatusAtividade,
  jaRespondeu: boolean,
): boolean {
  if (regra === 'nunca') return false
  if (regra === 'apos_responder') return jaRespondeu || status === 'encerrada'
  return status === 'encerrada'
}
