// Edge Function `excluir-conta` (PRD F8): o aluno pede a exclusão dos próprios
// dados. Apagar o usuário no Auth remove o perfil em cascata e, com ele,
// inscrições, perguntas, mensagens, respostas e o histórico de consentimento.

import { apagarConta } from '../_shared/alunos.ts'
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

  if (!(await apagarConta(admin, data.user.id))) {
    return erro(req, 500, 'Não foi possível excluir agora. Tente de novo.')
  }

  return responder(req, 200, { ok: true })
})
