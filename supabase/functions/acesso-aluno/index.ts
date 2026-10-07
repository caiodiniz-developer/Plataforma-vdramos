// Edge Function `acesso-aluno`: entrada e cadastro do aluno com
// ID do aluno + ID da turma + senha.
//
// Ações (campo `acao` do corpo):
//   entrar     → { sessao: { access_token, refresh_token }, codigo_turma }
//   cadastrar  → idem (a conta é criada e o aluno já sai logado)
//
// Só cria conta quem está na lista de IDs autorizados pelo professor. A senha
// é verificada pelo Supabase Auth (hash bcrypt); esta função nunca a grava.
// O e-mail interno da conta não sai do servidor: por isso o login passa por
// aqui, e não direto pelo cliente.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { apagarConta, criarConta, problemaDaSenha } from '../_shared/alunos.ts'
import { clienteAdmin, clienteAnonimo } from '../_shared/clientes.ts'
import { cabecalhosCors, erro, hashDoIp, lerCorpo, responder, texto } from '../_shared/http.ts'

const VERSAO_TERMO = Deno.env.get('VERSAO_TERMO') ?? '2026-10-v1'

// A mesma mensagem para qualquer falha de identificação, para não revelar
// qual dos campos está errado.
const CREDENCIAIS = 'ID, turma ou senha incorretos.'
const NAO_ENCONTRADO = 'Não encontramos essa combinação. Confira com o professor.'
const BLOQUEADA = 'Sua conta está temporariamente bloqueada. Entre em contato com seu professor.'
const TENTATIVAS = 'Muitas tentativas. Aguarde 15 minutos e tente de novo.'
const FALHA = 'Não foi possível concluir agora. Tente de novo.'

type Vinculo = {
  autorizadoId: string
  ativo: boolean
  turmaId: string
  codigoTurma: string
  turmaAtiva: boolean
  inscricao: { id: string; perfilId: string; email: string } | null
}

async function buscarVinculo(
  admin: SupabaseClient,
  matricula: string,
  codigoTurma: string,
): Promise<Vinculo | null> {
  const { data: turma } = await admin
    .from('turma')
    .select('id, codigo, status')
    .eq('codigo', codigoTurma)
    .in('status', ['ativa', 'encerrada'])
    .maybeSingle()
  if (!turma) return null

  const { data: autorizado } = await admin
    .from('aluno_autorizado')
    .select('id, ativo')
    .eq('turma_id', turma.id)
    .eq('matricula', matricula)
    .maybeSingle()
  if (!autorizado) return null

  const { data: inscricao } = await admin
    .from('inscricao')
    .select('id, perfil_id, perfil:perfil_id (email)')
    .eq('aluno_autorizado_id', autorizado.id)
    .maybeSingle()

  const perfil = inscricao?.perfil as { email: string } | { email: string }[] | null | undefined
  const email = Array.isArray(perfil) ? perfil[0]?.email : perfil?.email

  return {
    autorizadoId: autorizado.id,
    ativo: autorizado.ativo,
    turmaId: turma.id,
    codigoTurma: turma.codigo,
    turmaAtiva: turma.status === 'ativa',
    inscricao: inscricao && email ? { id: inscricao.id, perfilId: inscricao.perfil_id, email } : null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors(req) })
  if (req.method !== 'POST') return erro(req, 405, 'Método não permitido.')

  const corpo = await lerCorpo(req)
  if (!corpo) return erro(req, 400, 'Requisição inválida.')

  const acao = texto(corpo.acao)
  const matricula = texto(corpo.matricula).toUpperCase()
  const codigoTurma = texto(corpo.codigo_turma).toUpperCase()
  // A senha não passa por `texto()`: espaços nas pontas fazem parte dela.
  const senha = typeof corpo.senha === 'string' ? corpo.senha : ''
  if (!['entrar', 'cadastrar'].includes(acao)) return erro(req, 400, 'Ação inválida.')

  const admin = clienteAdmin()
  const anonimo = clienteAnonimo()
  const ipHash = await hashDoIp(req)

  // Mais de 5 tentativas inválidas por IP em 15 min bloqueiam por 15 min.
  // Aqui só se consulta; a tentativa é registrada quando a identificação falha.
  const { data: liberado, error: erroLimite } = await admin.rpc('dentro_do_limite', {
    p_acao: 'acesso_aluno',
    p_ip_hash: ipHash,
    p_maximo: 5,
    p_janela: '15 minutes',
    p_registrar: false,
  })
  if (erroLimite) return erro(req, 500, FALHA)
  if (!liberado) return erro(req, 429, TENTATIVAS, 'tentativas')

  const registrarFalha = () => admin.from('limite_tentativa').insert({ acao: 'acesso_aluno', ip_hash: ipHash })
  const vinculo = matricula && codigoTurma ? await buscarVinculo(admin, matricula, codigoTurma) : null

  const entrarNoAuth = (email: string) => anonimo.auth.signInWithPassword({ email, password: senha })

  // --- entrar -------------------------------------------------------------
  if (acao === 'entrar') {
    if (!vinculo?.inscricao || senha === '') {
      await registrarFalha()
      return erro(req, 401, CREDENCIAIS, 'credenciais')
    }

    const { data: login, error: erroLogin } = await entrarNoAuth(vinculo.inscricao.email)
    if (erroLogin || !login.session) {
      await registrarFalha()
      return erro(req, 401, CREDENCIAIS, 'credenciais')
    }

    // O aviso de bloqueio só aparece para quem acertou a senha: assim a
    // mensagem não confirma para um estranho que aquele ID existe.
    if (!vinculo.ativo) {
      await admin.auth.admin.signOut(login.session.access_token)
      return erro(req, 403, BLOQUEADA, 'bloqueado')
    }

    await admin.from('inscricao').update({ ultimo_acesso_em: new Date().toISOString() }).eq('id', vinculo.inscricao.id)
    return responder(req, 200, {
      sessao: { access_token: login.session.access_token, refresh_token: login.session.refresh_token },
      codigo_turma: vinculo.codigoTurma,
    })
  }

  // --- cadastrar ----------------------------------------------------------
  // Conta nova só com turma ativa e ID autorizado e desbloqueado.
  if (!vinculo || !vinculo.turmaAtiva || !vinculo.ativo) {
    await registrarFalha()
    return erro(req, 404, NAO_ENCONTRADO, 'nao_encontrado')
  }
  if (vinculo.inscricao) {
    return erro(req, 409, 'Já existe uma conta para este ID. Use a aba Entrar.', 'ja_existe')
  }

  const nome = texto(corpo.nome)
  if (nome.length < 3) return erro(req, 422, 'Informe seu nome completo.', 'validacao')
  const problema = problemaDaSenha(senha)
  if (problema) return erro(req, 422, problema, 'senha')
  // LGPD: sem aceite do termo, o cadastro não conclui.
  if (corpo.aceite_termo !== true) {
    return erro(req, 422, 'É preciso aceitar o termo de uso para continuar.', 'termo')
  }

  const conta = await criarConta(admin, {
    alunoAutorizadoId: vinculo.autorizadoId,
    turmaId: vinculo.turmaId,
    nome,
    senha,
  })
  if ('erro' in conta) return erro(req, conta.codigo === 'ja_existe' ? 409 : 500, conta.erro, conta.codigo)

  const { error: erroConsentimento } = await admin.from('consentimento').insert({
    perfil_id: conta.perfilId,
    finalidade: 'uso_dados_pedagogicos',
    concedido: true,
    versao_termo: VERSAO_TERMO,
    origem: 'cadastro',
  })
  const { data: login, error: erroLogin } = await entrarNoAuth(conta.email)
  if (erroConsentimento || erroLogin || !login.session) {
    // Não deixa uma conta pela metade: o aluno tenta de novo do zero.
    await apagarConta(admin, conta.perfilId)
    return erro(req, 500, FALHA)
  }

  await admin.from('inscricao').update({ ultimo_acesso_em: new Date().toISOString() }).eq('id', conta.inscricaoId)
  return responder(req, 201, {
    sessao: { access_token: login.session.access_token, refresh_token: login.session.refresh_token },
    codigo_turma: vinculo.codigoTurma,
  })
})
