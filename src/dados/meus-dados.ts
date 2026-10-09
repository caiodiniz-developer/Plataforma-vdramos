import { VERSAO_TERMO_VIGENTE, type Consentimento, type Finalidade } from '@/dominio/consentimento'
import { chamarFuncao, ErroDeDados, paraErroDeDados, supabase } from './supabase'

export type InscricaoDoAluno = {
  id: string
  ultimo_acesso_em: string | null
  created_at: string
  turma: { codigo: string; instituicao: string; cidade: string; status: string; curso: { nome: string } }
}

export type MeusDados = {
  perfil: { id: string; nome: string; email: string; email_contato: string | null; created_at: string }
  inscricoes: InscricaoDoAluno[]
  consentimentos: Consentimento[]
}

async function idDoUsuario(): Promise<string> {
  const { data } = await supabase().auth.getUser()
  if (!data.user) throw new ErroDeDados('Sua sessão expirou. Entre de novo.', 'sem_sessao')
  return data.user.id
}

/** PRD F8: perfil, turmas e histórico de consentimento do aluno logado. */
export async function buscarMeusDados(): Promise<MeusDados> {
  const id = await idDoUsuario()
  const [perfil, inscricoes, consentimentos] = await Promise.all([
    supabase().from('perfil').select('id, nome, email, email_contato, created_at').eq('id', id).single(),
    supabase()
      .from('inscricao')
      .select('id, ultimo_acesso_em, created_at, turma:turma_id (codigo, instituicao, cidade, status, curso:curso_id (nome))')
      .eq('perfil_id', id)
      .order('created_at'),
    supabase()
      .from('consentimento')
      .select('finalidade, concedido, versao_termo, origem, created_at')
      .eq('perfil_id', id)
      .order('created_at', { ascending: false }),
  ])
  if (perfil.error) throw paraErroDeDados(perfil.error)
  if (inscricoes.error) throw paraErroDeDados(inscricoes.error)
  if (consentimentos.error) throw paraErroDeDados(consentimentos.error)

  return {
    perfil: perfil.data,
    inscricoes: (inscricoes.data ?? []) as unknown as InscricaoDoAluno[],
    consentimentos: (consentimentos.data ?? []) as Consentimento[],
  }
}

/** Só o histórico de consentimento, para conferir a versão do termo no login. */
export async function buscarConsentimentos(): Promise<Consentimento[]> {
  const id = await idDoUsuario()
  const { data, error } = await supabase()
    .from('consentimento')
    .select('finalidade, concedido, versao_termo, origem, created_at')
    .eq('perfil_id', id)
  if (error) throw paraErroDeDados(error)
  return (data ?? []) as Consentimento[]
}

/**
 * A tabela é append-only: mudar de ideia grava um registro novo, com
 * `origem = 'area_aluno'`. A revogação vale na hora para a exportação de e-mails.
 */
export async function registrarConsentimento(finalidade: Finalidade, concedido: boolean): Promise<void> {
  const { error } = await supabase().from('consentimento').insert({
    perfil_id: await idDoUsuario(),
    finalidade,
    concedido,
    versao_termo: VERSAO_TERMO_VIGENTE,
    origem: 'area_aluno',
  })
  if (error) throw paraErroDeDados(error)
}

/** E-mail de contato do aluno (opcional). Vazio apaga o que estava gravado. */
export async function salvarEmailDeContato(email: string): Promise<void> {
  const valor = email.trim().toLowerCase()
  const { error } = await supabase()
    .from('perfil')
    .update({ email_contato: valor === '' ? null : valor })
    .eq('id', await idDoUsuario())
  if (error) {
    if (error.code === '23514') throw new ErroDeDados('Confira o e-mail informado.', 'email')
    throw paraErroDeDados(error)
  }
}

/** E-mail de contato já informado, para a tela de consentimento. */
export async function buscarEmailDeContato(): Promise<string | null> {
  const { data, error } = await supabase().from('perfil').select('email_contato').eq('id', await idDoUsuario()).single()
  if (error) throw paraErroDeDados(error)
  return (data.email_contato as string | null) ?? null
}

export async function atualizarNome(nome: string): Promise<void> {
  const { error } = await supabase().from('perfil').update({ nome: nome.trim() }).eq('id', await idDoUsuario())
  if (error) throw paraErroDeDados(error)
}

/**
 * PRD F8: "Baixar meus dados" — perfil, inscrições, perguntas, mensagens e
 * respostas. Tudo sai pela RLS do próprio aluno; nada de outra pessoa entra.
 */
export async function exportarMeusDados(): Promise<Record<string, unknown>> {
  const dados = await buscarMeusDados()
  const inscricoes = dados.inscricoes.map((i) => i.id)

  const [autorias, mensagens, respostas] = await Promise.all([
    supabase()
      .from('pergunta_autoria')
      .select('pergunta:pergunta_id (texto, destino, anonima, status, resposta, created_at)')
      .in('inscricao_id', inscricoes),
    supabase().from('mensagem').select('tipo, texto, created_at').eq('perfil_id', dados.perfil.id),
    supabase()
      .from('atividade_resposta')
      .select('atividade_item_id, opcao_ids, valor, texto, correta, tempo_resposta_ms, created_at')
      .in('inscricao_id', inscricoes),
  ])
  if (autorias.error) throw paraErroDeDados(autorias.error)
  if (mensagens.error) throw paraErroDeDados(mensagens.error)
  if (respostas.error) throw paraErroDeDados(respostas.error)

  return {
    gerado_em: new Date().toISOString(),
    perfil: dados.perfil,
    inscricoes: dados.inscricoes,
    consentimentos: dados.consentimentos,
    perguntas: (autorias.data ?? []).map((a) => a.pergunta),
    mensagens: mensagens.data ?? [],
    respostas: respostas.data ?? [],
  }
}

/**
 * PRD F8: apaga perfil (cascata) e a conta no Auth pela Edge Function.
 * Quem chama encerra a sessão local depois de sair da tela protegida.
 */
export async function excluirConta(): Promise<void> {
  await chamarFuncao('excluir-conta', {})
}
