// Edge Function `admin-alunos`: o que o professor faz com a conta de um aluno
// e que exige a service role (mexer no Supabase Auth).
//
// Ações (campo `acao` do corpo), todas restritas a quem tem papel admin:
//   criar            { turma_id, matricula, nome, senha? } → autoriza o ID e,
//                    com senha, já cria a conta
//   redefinir_senha  { aluno_autorizado_id, senha }
//   remover          { aluno_autorizado_id } → apaga a conta (se houver) e o ID
//
// Bloquear, desbloquear e editar nome ou ID não passam por aqui: são
// atualizações comuns, que a RLS já restringe ao admin.

import { apagarConta, criarConta, problemaDaSenha } from '../_shared/alunos.ts'
import { clienteAdmin, clienteDoUsuario } from '../_shared/clientes.ts'
import { cabecalhosCors, erro, lerCorpo, responder, texto } from '../_shared/http.ts'

const PADRAO_MATRICULA = /^[A-Z0-9][A-Z0-9._/-]{0,39}$/
const FALHA = 'Não foi possível concluir agora. Tente de novo.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors(req) })
  if (req.method !== 'POST') return erro(req, 405, 'Método não permitido.')

  // A permissão é conferida aqui, no servidor: sessão válida e papel admin.
  const { data: quem, error: erroSessao } = await clienteDoUsuario(req).auth.getUser()
  if (erroSessao || !quem.user) return erro(req, 401, 'Sessão inválida. Entre de novo.')

  const admin = clienteAdmin()
  const { data: perfil } = await admin.from('perfil').select('papel').eq('id', quem.user.id).maybeSingle()
  if (perfil?.papel !== 'admin') return erro(req, 403, 'Somente o professor pode gerenciar alunos.')

  const corpo = await lerCorpo(req)
  if (!corpo) return erro(req, 400, 'Requisição inválida.')
  const acao = texto(corpo.acao)

  // --- criar --------------------------------------------------------------
  if (acao === 'criar') {
    const turmaId = texto(corpo.turma_id)
    const matricula = texto(corpo.matricula).toUpperCase()
    const nome = texto(corpo.nome)
    const senha = typeof corpo.senha === 'string' ? corpo.senha : ''

    if (!PADRAO_MATRICULA.test(matricula)) return erro(req, 422, 'ID do aluno inválido.', 'validacao')
    if (nome.length < 3) return erro(req, 422, 'Informe o nome do aluno.', 'validacao')
    if (senha !== '') {
      const problema = problemaDaSenha(senha)
      if (problema) return erro(req, 422, problema, 'senha')
    }

    const { data: turma } = await admin.from('turma').select('id').eq('id', turmaId).maybeSingle()
    if (!turma) return erro(req, 404, 'Turma não encontrada.', 'turma')

    const { data: existente } = await admin
      .from('aluno_autorizado')
      .select('id')
      .eq('turma_id', turmaId)
      .eq('matricula', matricula)
      .maybeSingle()
    if (existente) return erro(req, 409, 'Já existe um aluno com este ID nesta turma.', 'ja_existe')

    const { data: autorizado, error: erroAutorizado } = await admin
      .from('aluno_autorizado')
      .insert({ turma_id: turmaId, matricula, nome_referencia: nome })
      .select('id')
      .single()
    if (erroAutorizado || !autorizado) return erro(req, 500, FALHA)

    if (senha === '') return responder(req, 201, { aluno_autorizado_id: autorizado.id, conta_criada: false })

    // Com senha, a conta já nasce pronta. O aluno aceita o termo no primeiro
    // acesso (não há consentimento registrado em nome dele aqui).
    const conta = await criarConta(admin, { alunoAutorizadoId: autorizado.id, turmaId, nome, senha })
    if ('erro' in conta) {
      await admin.from('aluno_autorizado').delete().eq('id', autorizado.id)
      return erro(req, 500, conta.erro, conta.codigo)
    }
    return responder(req, 201, { aluno_autorizado_id: autorizado.id, conta_criada: true })
  }

  // --- redefinir_senha e remover: precisam do ID autorizado -----------------
  if (acao !== 'redefinir_senha' && acao !== 'remover') return erro(req, 400, 'Ação inválida.')

  const alunoAutorizadoId = texto(corpo.aluno_autorizado_id)
  const { data: autorizado } = await admin
    .from('aluno_autorizado')
    .select('id')
    .eq('id', alunoAutorizadoId)
    .maybeSingle()
  if (!autorizado) return erro(req, 404, 'Aluno não encontrado.', 'aluno')

  const { data: inscricao } = await admin
    .from('inscricao')
    .select('perfil_id')
    .eq('aluno_autorizado_id', alunoAutorizadoId)
    .maybeSingle()

  if (acao === 'redefinir_senha') {
    const senha = typeof corpo.senha === 'string' ? corpo.senha : ''
    const problema = problemaDaSenha(senha)
    if (problema) return erro(req, 422, problema, 'senha')
    if (!inscricao) return erro(req, 409, 'Este aluno ainda não criou a conta.', 'sem_conta')

    const { error } = await admin.auth.admin.updateUserById(inscricao.perfil_id, { password: senha })
    if (error) return erro(req, 500, FALHA)
    return responder(req, 200, { ok: true })
  }

  // remover
  if (inscricao) {
    // Uma pessoa pode ter inscrição em mais de uma turma: a conta só é
    // apagada quando esta é a última.
    const { data: outras } = await admin.from('inscricao').select('id').eq('perfil_id', inscricao.perfil_id)
    if ((outras ?? []).length <= 1) {
      if (!(await apagarConta(admin, inscricao.perfil_id))) return erro(req, 500, FALHA)
    }
  }
  const { error } = await admin.from('aluno_autorizado').delete().eq('id', alunoAutorizadoId)
  if (error) return erro(req, 500, FALHA)
  return responder(req, 200, { ok: true })
})
