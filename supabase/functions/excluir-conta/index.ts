// Edge Function `excluir-conta` (PRD F8): o aluno pede a exclusão dos próprios
// dados. Apagar o usuário no Auth remove o perfil em cascata e, com ele,
// inscrições, perguntas, mensagens, respostas e o histórico de consentimento.

import { clienteAdmin, clienteDoUsuario } from '../_shared/clientes.ts'
import { cabecalhosCors, erro, responder } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors(req) })
  if (req.method !== 'POST') return erro(req, 405, 'Método não permitido.')

  const { data, error } = await clienteDoUsuario(req).auth.getUser()
  if (error || !data.user) return erro(req, 401, 'Sessão inválida. Entre de novo.')

  const admin = clienteAdmin()

  const { data: perfil } = await admin.from('perfil').select('papel').eq('id', data.user.id).maybeSingle()
  // A conta do professor não é excluída por aqui: ela é dona do conteúdo.
  if (perfil?.papel === 'admin') {
    return erro(req, 403, 'A conta do professor não pode ser excluída por esta tela.')
  }

  // As perguntas não têm FK direta para o perfil (a autoria fica em tabela
  // separada), então são apagadas antes, a partir da autoria.
  const { data: inscricoes } = await admin.from('inscricao').select('id').eq('perfil_id', data.user.id)
  const ids = (inscricoes ?? []).map((i) => i.id)
  if (ids.length > 0) {
    const { data: autorias } = await admin.from('pergunta_autoria').select('pergunta_id').in('inscricao_id', ids)
    const perguntas = (autorias ?? []).map((a) => a.pergunta_id)
    if (perguntas.length > 0) {
      const { error: erroPerguntas } = await admin.from('pergunta').delete().in('id', perguntas)
      if (erroPerguntas) return erro(req, 500, 'Não foi possível excluir agora. Tente de novo.')
    }
  }

  const { error: erroExclusao } = await admin.auth.admin.deleteUser(data.user.id)
  if (erroExclusao) return erro(req, 500, 'Não foi possível excluir agora. Tente de novo.')

  return responder(req, 200, { ok: true })
})
