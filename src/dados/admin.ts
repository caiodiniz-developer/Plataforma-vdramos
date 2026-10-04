import { paraErroDeDados, supabase } from './supabase'

export type ResumoDoPainel = {
  turmasAtivas: number
  turmasPlanejadas: number
  inscritos: number
  mensagensNaoLidas: number
  sessoesAbertas: number
}

async function contar(tabela: string, filtro?: [coluna: string, valor: string | boolean]): Promise<number> {
  let consulta = supabase().from(tabela).select('id', { count: 'exact', head: true })
  if (filtro) consulta = consulta.eq(filtro[0], filtro[1])
  const { count, error } = await consulta
  if (error) throw paraErroDeDados(error)
  return count ?? 0
}

/** Números do painel inicial do professor. */
export async function buscarResumoDoPainel(): Promise<ResumoDoPainel> {
  const [turmasAtivas, turmasPlanejadas, inscritos, mensagensNaoLidas, sessoesAbertas] = await Promise.all([
    contar('turma', ['status', 'ativa']),
    contar('turma', ['status', 'planejada']),
    contar('inscricao'),
    contar('contato_mensagem', ['lida', false]),
    contar('sessao_ao_vivo', ['status', 'aberta']),
  ])
  return { turmasAtivas, turmasPlanejadas, inscritos, mensagensNaoLidas, sessoesAbertas }
}

export type MensagemDeContato = {
  id: string
  nome: string
  email: string
  assunto: 'consultoria' | 'treinamento' | 'palestra' | 'outro'
  assunto_outro: string | null
  mensagem: string
  lida: boolean
  created_at: string
}

/** PRD F15: caixa de mensagens de contato, com filtro lida/não lida. */
export async function listarMensagensDeContato(filtro: 'todas' | 'nao_lidas' | 'lidas'): Promise<MensagemDeContato[]> {
  let consulta = supabase()
    .from('contato_mensagem')
    .select('id, nome, email, assunto, assunto_outro, mensagem, lida, created_at')
    .order('created_at', { ascending: false })
  if (filtro !== 'todas') consulta = consulta.eq('lida', filtro === 'lidas')
  const { data, error } = await consulta
  if (error) throw paraErroDeDados(error)
  return (data ?? []) as MensagemDeContato[]
}

export async function marcarMensagem(id: string, lida: boolean): Promise<void> {
  const { error } = await supabase().from('contato_mensagem').update({ lida }).eq('id', id)
  if (error) throw paraErroDeDados(error)
}
