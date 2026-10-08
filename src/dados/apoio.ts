import { ErroDeDados, paraErroDeDados, supabase } from './supabase'

/**
 * Gateway da plataforma de apoio, lado do aluno: conteúdos, atividades,
 * questões, dúvidas, mensagens para o professor, feedback, avisos e
 * notificações. A RLS garante que cada aluno só recebe o que é da turma dele
 * e só lê as próprias dúvidas, mensagens e feedbacks.
 */

export type TipoConteudo = 'aula' | 'aula_extra' | 'texto' | 'video' | 'link' | 'arquivo'

export type Conteudo = {
  id: string
  turma_id: string | null
  tipo: TipoConteudo
  titulo: string
  descricao: string | null
  corpo_md: string | null
  capa_path: string | null
  arquivo_path: string | null
  video_url: string | null
  link_url: string | null
  publicado: boolean
  publicado_em: string | null
  created_at: string
}

export const ROTULO_TIPO_CONTEUDO: Record<TipoConteudo, string> = {
  aula: 'Aula',
  aula_extra: 'Aula extra',
  texto: 'Texto',
  video: 'Vídeo',
  link: 'Link',
  arquivo: 'Arquivo',
}

export type TurmaDoAluno = { id: string; codigo: string; nome_curso: string; status: string; inscricao_id: string }

/** Turmas do aluno logado, cada uma com a inscrição dele nela. */
export async function turmasDoAluno(): Promise<TurmaDoAluno[]> {
  const { data, error } = await supabase()
    .from('inscricao')
    .select('id, turma:turma_id (id, codigo, status, curso:curso_id (nome))')
    .order('created_at')
  if (error) throw paraErroDeDados(error)
  type Bruta = { id: string; turma: { id: string; codigo: string; status: string; curso: { nome: string } | null } | null }
  return ((data ?? []) as unknown as Bruta[])
    .filter((i) => i.turma !== null)
    .map((i) => ({
      id: i.turma!.id,
      codigo: i.turma!.codigo,
      status: i.turma!.status,
      nome_curso: i.turma!.curso?.nome ?? '',
      inscricao_id: i.id,
    }))
}

const CAMPOS_CONTEUDO =
  'id, turma_id, tipo, titulo, descricao, corpo_md, capa_path, arquivo_path, video_url, link_url, publicado, publicado_em, created_at'

/** Conteúdos publicados para a turma (e os que valem para todas). */
export async function listarConteudos(turmaId: string): Promise<Conteudo[]> {
  const { data, error } = await supabase()
    .from('conteudo')
    .select(CAMPOS_CONTEUDO)
    .or(`turma_id.eq.${turmaId},turma_id.is.null`)
    .order('publicado_em', { ascending: false })
  if (error) throw paraErroDeDados(error)
  return (data ?? []) as Conteudo[]
}

export async function buscarConteudo(id: string): Promise<Conteudo> {
  const { data, error } = await supabase().from('conteudo').select(CAMPOS_CONTEUDO).eq('id', id).maybeSingle()
  if (error) throw paraErroDeDados(error)
  if (!data) throw new ErroDeDados('Conteúdo não encontrado.', 'nao_encontrado')
  return data as Conteudo
}

/** Ids dos conteúdos que o aluno já abriu. */
export async function conteudosAcessados(): Promise<Set<string>> {
  const { data, error } = await supabase().from('conteudo_acesso').select('conteudo_id')
  if (error) throw paraErroDeDados(error)
  return new Set((data ?? []).map((a) => a.conteudo_id as string))
}

export async function registrarAcesso(conteudoId: string): Promise<void> {
  const { error } = await supabase().rpc('registrar_acesso', { p_conteudo_id: conteudoId })
  if (error) throw paraErroDeDados(error)
}

/** URL assinada (10 min) de capa, arquivo de conteúdo ou anexo. */
export async function urlAssinada(caminho: string): Promise<string> {
  const { data, error } = await supabase().storage.from('materiais').createSignedUrl(caminho, 600)
  if (error || !data) throw new ErroDeDados('Não foi possível abrir o arquivo. Tente de novo.', 'arquivo')
  return data.signedUrl
}

export type AtividadeDoAluno = {
  id: string
  tipo: 'licao' | 'quiz' | 'questao'
  titulo: string
  descricao: string | null
  status: 'publicada' | 'encerrada'
  prazo_em: string | null
  dificuldade: 'facil' | 'medio' | 'dificil' | null
  categoria: string | null
  conteudo_id: string | null
  publicada_em: string | null
  itens: number
  respondida: boolean
  acertos: number
  respondida_em: string | null
}

/** Atividades e questões da turma, com a situação do aluno em cada uma. */
export async function minhasAtividades(turmaId: string): Promise<AtividadeDoAluno[]> {
  const { data, error } = await supabase().rpc('minhas_atividades', { p_turma_id: turmaId })
  if (error) throw paraErroDeDados(error)
  return (data ?? []) as AtividadeDoAluno[]
}

export type Progresso = {
  atividades_realizadas: number
  atividades_disponiveis: number
  questoes_respondidas: number
  questoes_corretas: number
  conteudos_acessados: number
  conteudos_disponiveis: number
  duvidas_abertas: number
  duvidas_respondidas: number
}

export async function meuProgresso(turmaId: string): Promise<Progresso> {
  const { data, error } = await supabase().rpc('meu_progresso', { p_turma_id: turmaId })
  if (error) throw paraErroDeDados(error)
  return data as Progresso
}

export type Duvida = {
  id: string
  titulo: string
  pergunta: string
  categoria: string | null
  conteudo_id: string | null
  anexo_path: string | null
  status: 'aberta' | 'respondida' | 'arquivada'
  resposta: string | null
  respondida_em: string | null
  created_at: string
}

const CAMPOS_DUVIDA = 'id, titulo, pergunta, categoria, conteudo_id, anexo_path, status, resposta, respondida_em, created_at'

export async function minhasDuvidas(turmaId: string): Promise<Duvida[]> {
  const { data, error } = await supabase()
    .from('duvida')
    .select(CAMPOS_DUVIDA)
    .eq('turma_id', turmaId)
    .order('created_at', { ascending: false })
  if (error) throw paraErroDeDados(error)
  return (data ?? []) as Duvida[]
}

export type NovaDuvida = {
  titulo: string
  pergunta: string
  categoria: string
  conteudoId: string | null
  anexo: File | null
}

export const ANEXO_MAXIMO_MB = 10

/** Envia a dúvida ao professor. O anexo vai para a pasta do próprio aluno. */
export async function enviarDuvida(turma: TurmaDoAluno, nova: NovaDuvida): Promise<void> {
  let anexo_path: string | null = null
  if (nova.anexo) {
    if (nova.anexo.size > ANEXO_MAXIMO_MB * 1024 * 1024) {
      throw new ErroDeDados(`O anexo pode ter no máximo ${ANEXO_MAXIMO_MB} MB.`, 'anexo')
    }
    const { data: sessao } = await supabase().auth.getUser()
    const extensao = nova.anexo.name.includes('.') ? nova.anexo.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin'
    anexo_path = `duvidas/${sessao.user?.id}/${crypto.randomUUID()}.${extensao}`
    const { error: erroEnvio } = await supabase().storage.from('materiais').upload(anexo_path, nova.anexo)
    if (erroEnvio) throw new ErroDeDados('Não foi possível enviar o anexo. Tente de novo.', 'anexo')
  }
  const { error } = await supabase().from('duvida').insert({
    inscricao_id: turma.inscricao_id,
    turma_id: turma.id,
    titulo: nova.titulo.trim(),
    pergunta: nova.pergunta.trim(),
    categoria: nova.categoria.trim() || null,
    conteudo_id: nova.conteudoId,
    anexo_path,
  })
  if (error) throw paraErroDeDados(error)
}

export type MensagemPrivada = {
  id: string
  autor: 'aluno' | 'professor'
  texto: string
  lida_em: string | null
  created_at: string
}

export async function minhasMensagens(inscricaoId: string): Promise<MensagemPrivada[]> {
  const { data, error } = await supabase()
    .from('mensagem_privada')
    .select('id, autor, texto, lida_em, created_at')
    .eq('inscricao_id', inscricaoId)
    .order('created_at')
  if (error) throw paraErroDeDados(error)
  return (data ?? []) as MensagemPrivada[]
}

export async function enviarMensagemAoProfessor(inscricaoId: string, texto: string): Promise<void> {
  const { error } = await supabase()
    .from('mensagem_privada')
    .insert({ inscricao_id: inscricaoId, autor: 'aluno', texto: texto.trim() })
  if (error) throw paraErroDeDados(error)
}

export async function marcarMensagensLidas(): Promise<void> {
  const { error } = await supabase().rpc('marcar_mensagens_lidas')
  if (error) throw paraErroDeDados(error)
}

export type TipoFeedback = 'dificuldade' | 'sugestao' | 'problema' | 'avaliacao_aula' | 'comentario'

export const ROTULO_TIPO_FEEDBACK: Record<TipoFeedback, string> = {
  dificuldade: 'Dificuldade em um conteúdo',
  sugestao: 'Sugestão',
  problema: 'Problema na plataforma',
  avaliacao_aula: 'Avaliação de uma aula',
  comentario: 'Comentário para o professor',
}

export type Feedback = { id: string; tipo: TipoFeedback; texto: string; created_at: string }

export async function meusFeedbacks(turmaId: string): Promise<Feedback[]> {
  const { data, error } = await supabase()
    .from('feedback')
    .select('id, tipo, texto, created_at')
    .eq('turma_id', turmaId)
    .order('created_at', { ascending: false })
  if (error) throw paraErroDeDados(error)
  return (data ?? []) as Feedback[]
}

export async function enviarFeedback(turma: TurmaDoAluno, tipo: TipoFeedback, texto: string): Promise<void> {
  const { error } = await supabase()
    .from('feedback')
    .insert({ inscricao_id: turma.inscricao_id, turma_id: turma.id, tipo, texto: texto.trim() })
  if (error) throw paraErroDeDados(error)
}

export type Aviso = { id: string; turma_id: string | null; titulo: string; texto: string; created_at: string }

export async function listarAvisos(turmaId: string): Promise<Aviso[]> {
  const { data, error } = await supabase()
    .from('aviso')
    .select('id, turma_id, titulo, texto, created_at')
    .or(`turma_id.eq.${turmaId},turma_id.is.null`)
    .order('created_at', { ascending: false })
  if (error) throw paraErroDeDados(error)
  return (data ?? []) as Aviso[]
}

export type Notificacao = {
  id: string
  tipo: 'conteudo' | 'atividade' | 'aviso' | 'duvida' | 'mensagem'
  titulo: string
  link: string | null
  lida_em: string | null
  created_at: string
}

export async function minhasNotificacoes(): Promise<Notificacao[]> {
  const { data, error } = await supabase()
    .from('notificacao')
    .select('id, tipo, titulo, link, lida_em, created_at')
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw paraErroDeDados(error)
  return (data ?? []) as Notificacao[]
}

export async function marcarNotificacoesLidas(ids?: string[]): Promise<void> {
  let consulta = supabase().from('notificacao').update({ lida_em: new Date().toISOString() }).is('lida_em', null)
  if (ids) consulta = consulta.in('id', ids)
  const { error } = await consulta
  if (error) throw paraErroDeDados(error)
}

/** Avisa quando chega notificação nova para o usuário logado (Realtime). */
/**
 * Avisa quando uma tabela muda (Realtime). O banco só entrega as linhas que a
 * RLS deixa quem está logado ver; `filtro` (ex.: `inscricao_id=eq.<id>`) reduz
 * o que chega. Devolve a função que encerra a assinatura.
 */
export function assinarMudancas(tabela: 'duvida' | 'mensagem_privada', aoMudar: () => void, filtro?: string): () => void {
  const canal = supabase()
    .channel(`${tabela}:${filtro ?? 'todas'}:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: tabela, ...(filtro ? { filter: filtro } : {}) }, aoMudar)
    .subscribe()
  return () => {
    void supabase().removeChannel(canal)
  }
}

export function assinarNotificacoes(perfilId: string, aoChegar: () => void): () => void {
  const canal = supabase()
    .channel(`notificacoes:${perfilId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacao', filter: `perfil_id=eq.${perfilId}` }, aoChegar)
    .subscribe()
  return () => {
    void supabase().removeChannel(canal)
  }
}
