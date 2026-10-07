import type { MostrarResultado, StatusAtividade, TipoAtividade, TipoResposta } from '@/dominio/atividade'
import type { DestinoPergunta, StatusPergunta } from '@/dominio/pergunta'
import { ErroDeDados, paraErroDeDados, supabase } from './supabase'

export type SessaoAoVivo = {
  id: string
  status: 'agendada' | 'aberta' | 'encerrada'
  permite_anonimo: boolean
  chat_ativo: boolean
  encontro: { id: string; numero: number; titulo: string }
}

export type PerguntaDaSala = {
  id: string
  texto: string
  destino: DestinoPergunta
  anonima: boolean
  autor_nome: string | null
  status: StatusPergunta
  resposta: string | null
  votos: number
  created_at: string
  /** O aluno logado já votou nesta pergunta. */
  votei: boolean
  /** O aluno logado é o autor. */
  minha: boolean
}

export type MensagemDaSala = {
  id: string
  perfil_id: string
  autor_nome: string
  tipo: 'texto' | 'link' | 'aviso'
  texto: string
  fixada: boolean
  removida: boolean
  created_at: string
}

export type AtividadeResumida = {
  id: string
  tipo: TipoAtividade
  titulo: string
  status: StatusAtividade
  sessao_ao_vivo_id: string | null
  tempo_limite_s: number | null
  publicada_em: string | null
  mostrar_resultado: MostrarResultado
}

export type Sala = {
  turma: { id: string; codigo: string; fuso: string; status: string; nome_curso: string }
  sessao: SessaoAoVivo | null
  perguntas: PerguntaDaSala[]
  mensagens: MensagemDaSala[]
  atividades: AtividadeResumida[]
}

type SessaoBruta = Omit<SessaoAoVivo, 'encontro'> & { aberta_em: string | null }
type EncontroBruto = { id: string; numero: number; titulo: string; sessao: SessaoBruta | SessaoBruta[] | null }

const CAMPOS_ATIVIDADE = 'id, tipo, titulo, status, sessao_ao_vivo_id, tempo_limite_s, publicada_em, mostrar_resultado'

/**
 * PRD F9: estado completo da sala para o aluno. Quem entra com a sessão em
 * andamento recebe o histórico inteiro e a atividade publicada no momento.
 * Sem sessão aberta, mostra a última encerrada em modo leitura.
 */
export async function buscarSala(codigoTurma: string): Promise<Sala> {
  const db = supabase()
  const { data: turma, error: erroTurma } = await db
    .from('turma')
    .select(
      'id, codigo, fuso, status, curso:curso_id (nome), encontros:encontro (id, numero, titulo, sessao:sessao_ao_vivo (id, status, permite_anonimo, chat_ativo, aberta_em))',
    )
    .eq('codigo', codigoTurma.toUpperCase())
    .maybeSingle()
  if (erroTurma) throw paraErroDeDados(erroTurma)
  if (!turma) throw new ErroDeDados('Você não tem acesso a esta turma.', 'sem_acesso')

  const sessoes = (turma.encontros as unknown as EncontroBruto[])
    .map((e) => {
      const s = Array.isArray(e.sessao) ? e.sessao[0] : e.sessao
      return s ? { ...s, encontro: { id: e.id, numero: e.numero, titulo: e.titulo } } : null
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)

  const escolhida =
    sessoes.find((s) => s.status === 'aberta') ??
    sessoes
      .filter((s) => s.status === 'encerrada')
      .sort((a, b) => (b.aberta_em ?? '').localeCompare(a.aberta_em ?? ''))[0] ??
    null

  const curso = turma.curso as unknown as { nome: string } | { nome: string }[] | null
  const base = {
    turma: {
      id: turma.id,
      codigo: turma.codigo,
      fuso: turma.fuso,
      status: turma.status,
      nome_curso: (Array.isArray(curso) ? curso[0]?.nome : curso?.nome) ?? '',
    },
  }
  if (!escolhida) return { ...base, sessao: null, perguntas: [], mensagens: [], atividades: [] }

  const [perguntas, autorias, votos, mensagens, atividades] = await Promise.all([
    db
      .from('pergunta')
      .select('id, texto, destino, anonima, autor_nome, status, resposta, votos, created_at')
      .eq('sessao_ao_vivo_id', escolhida.id),
    // A RLS só devolve as autorias e os votos do próprio aluno.
    db.from('pergunta_autoria').select('pergunta_id'),
    db.from('pergunta_voto').select('pergunta_id'),
    db
      .from('mensagem')
      .select('id, perfil_id, autor_nome, tipo, texto, fixada, removida, created_at')
      .eq('sessao_ao_vivo_id', escolhida.id),
    db
      .from('atividade')
      .select(CAMPOS_ATIVIDADE)
      .eq('sessao_ao_vivo_id', escolhida.id)
      .order('publicada_em', { ascending: false }),
  ])
  for (const resultado of [perguntas, autorias, votos, mensagens, atividades]) {
    if (resultado.error) throw paraErroDeDados(resultado.error)
  }

  const minhas = new Set((autorias.data ?? []).map((a) => a.pergunta_id))
  const votadas = new Set((votos.data ?? []).map((v) => v.pergunta_id))

  return {
    ...base,
    sessao: {
      id: escolhida.id,
      status: escolhida.status,
      permite_anonimo: escolhida.permite_anonimo,
      chat_ativo: escolhida.chat_ativo,
      encontro: escolhida.encontro,
    },
    perguntas: (perguntas.data ?? []).map((p) => ({
      ...p,
      votei: votadas.has(p.id),
      minha: minhas.has(p.id),
    })) as PerguntaDaSala[],
    mensagens: (mensagens.data ?? []) as MensagemDaSala[],
    atividades: (atividades.data ?? []) as AtividadeResumida[],
  }
}

export async function enviarPergunta(
  sessaoId: string,
  texto: string,
  destino: DestinoPergunta,
  anonima: boolean,
): Promise<void> {
  const { error } = await supabase().rpc('enviar_pergunta', {
    p_sessao_id: sessaoId,
    p_texto: texto,
    p_destino: destino,
    p_anonima: anonima,
  })
  if (error) throw paraErroDeDados(error)
}

export async function alternarVoto(perguntaId: string): Promise<void> {
  const { error } = await supabase().rpc('alternar_voto', { p_pergunta_id: perguntaId })
  if (error) throw paraErroDeDados(error)
}

export async function enviarMensagem(sessaoId: string, texto: string): Promise<void> {
  const { error } = await supabase().rpc('enviar_mensagem', { p_sessao_id: sessaoId, p_texto: texto })
  if (error) throw paraErroDeDados(error)
}

export type OpcaoParaAluno = { id: string; ordem: number; texto: string; correta?: boolean; total?: number }

export type ItemParaAluno = {
  id: string
  ordem: number
  enunciado: string
  tipo_resposta: TipoResposta
  obrigatorio: boolean
  opcoes: OpcaoParaAluno[]
  minha_resposta: {
    opcao_ids: string[] | null
    valor: number | null
    texto: string | null
    correta: boolean | null
  } | null
  explicacao: string | null
  resultado: { respostas: number; media: number | null } | null
}

export type AtividadeParaAluno = {
  id: string
  tipo: TipoAtividade
  titulo: string
  status: StatusAtividade
  anonima: boolean
  tempo_limite_s: number | null
  publicada_em: string | null
  sessao_ao_vivo_id: string | null
  respondida: boolean
  mostra_resultado: boolean
  descricao?: string | null
  instrucoes_md?: string | null
  prazo_em?: string | null
  arquivo_path?: string | null
  itens: ItemParaAluno[]
}

/** Itens e opções sem gabarito; a correção só vem dos itens já respondidos. */
export async function buscarAtividade(atividadeId: string): Promise<AtividadeParaAluno> {
  const { data, error } = await supabase().rpc('atividade_para_aluno', { p_atividade_id: atividadeId })
  if (error) throw paraErroDeDados(error)
  return data as AtividadeParaAluno
}

export type RespostaDoItem = { item_id: string; opcao_ids?: string[]; valor?: number; texto?: string }

/** PRD F13: todas as respostas numa transação; o servidor valida e corrige. */
export async function responderAtividade(atividadeId: string, respostas: RespostaDoItem[]): Promise<void> {
  const { error } = await supabase().rpc('responder_atividade', {
    p_atividade_id: atividadeId,
    p_respostas: respostas,
  })
  if (error) throw paraErroDeDados(error)
}

/** Atividades publicadas ou encerradas da turma (aba Atividades da área do aluno). */
export async function atividadesDaTurma(turmaId: string): Promise<AtividadeResumida[]> {
  const { data, error } = await supabase()
    .from('atividade')
    .select(CAMPOS_ATIVIDADE)
    .eq('turma_id', turmaId)
    .order('publicada_em', { ascending: false })
  if (error) throw paraErroDeDados(error)
  return (data ?? []) as AtividadeResumida[]
}

export type EstadoDaConexao = 'conectado' | 'reconectando'

/**
 * Realtime da sessão (PRD F9): qualquer mudança em sessão, perguntas,
 * mensagens ou atividades chama `aoMudar`, e a tela recarrega a lista
 * completa. Ao voltar de uma queda de conexão, recarrega também (seção 7).
 */
export function assinarSala(
  sessaoId: string,
  aoMudar: () => void,
  aoConexao: (estado: EstadoDaConexao) => void,
): () => void {
  const filtro = `sessao_ao_vivo_id=eq.${sessaoId}`
  let caiu = false

  const canal = supabase()
    .channel(`sala:${sessaoId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sessao_ao_vivo', filter: `id=eq.${sessaoId}` },
      aoMudar,
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pergunta', filter: filtro }, aoMudar)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagem', filter: filtro }, aoMudar)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'atividade', filter: filtro }, aoMudar)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        aoConexao('conectado')
        if (caiu) aoMudar()
        caiu = false
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        caiu = true
        aoConexao('reconectando')
      }
    })

  return () => {
    void supabase().removeChannel(canal)
  }
}
