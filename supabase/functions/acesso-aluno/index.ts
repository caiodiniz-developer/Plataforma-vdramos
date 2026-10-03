// Edge Function `acesso-aluno` (PRD F3 e F4): valida ID do aluno + ID da
// turma no servidor, envia o código OTP e conclui o cadastro ou o login.
//
// Ações (campo `acao` do corpo):
//   verificar  → { etapa: 'cadastro' } ou { etapa: 'codigo', email_mascarado }
//   cadastrar  → { etapa: 'codigo', email_mascarado }
//   confirmar  → { sessao: { access_token, refresh_token }, codigo_turma }
//
// O e-mail de quem já tem inscrição nunca sai do servidor: por isso a
// verificação do código também acontece aqui, e não no cliente.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { clienteAdmin, clienteAnonimo } from '../_shared/clientes.ts'
import { cabecalhosCors, erro, hashDoIp, lerCorpo, responder, texto } from '../_shared/http.ts'

const VERSAO_TERMO = Deno.env.get('VERSAO_TERMO') ?? '2026-10-v1'
const PADRAO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Seção 7: a mesma mensagem para qualquer falha de identificação, para não
// revelar qual dos dois campos está errado.
const NAO_ENCONTRADO = 'Não encontramos essa combinação. Confira com o professor.'
const BLOQUEADO = 'Muitas tentativas. Aguarde 15 minutos e tente de novo.'
const FALHA = 'Não foi possível concluir agora. Tente de novo.'

type Vinculo = {
  autorizadoId: string
  turmaId: string
  codigoTurma: string
  turmaAtiva: boolean
  inscricao: { id: string; perfilId: string; email: string } | null
}

function mascarar(email: string): string {
  const [usuario, dominio] = email.split('@')
  return usuario && dominio ? `${usuario[0]}•••@${dominio}` : '•••'
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
    .select('id')
    .eq('turma_id', turma.id)
    .eq('matricula', matricula)
    .eq('ativo', true)
    .maybeSingle()
  if (!autorizado) return null

  const { data: inscricao } = await admin
    .from('inscricao')
    .select('id, perfil_id, perfil:perfil_id (email)')
    .eq('aluno_autorizado_id', autorizado.id)
    .maybeSingle()

  const perfil = inscricao?.perfil as { email: string } | { email: string }[] | null | undefined
  const email = Array.isArray(perfil) ? perfil[0]?.email : perfil?.email

  // Turma encerrada: quem já tem inscrição entra em modo leitura; cadastro novo não.
  if (turma.status !== 'ativa' && !inscricao) return null

  return {
    autorizadoId: autorizado.id,
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
  if (!['verificar', 'cadastrar', 'confirmar'].includes(acao)) return erro(req, 400, 'Ação inválida.')

  const admin = clienteAdmin()
  const anonimo = clienteAnonimo()
  const ipHash = await hashDoIp(req)

  // Seção 7: mais de 5 tentativas inválidas por IP em 15 min bloqueiam por 15 min.
  // Aqui só se consulta; a tentativa é registrada quando a identificação falha.
  const limite = { p_acao: 'acesso_aluno', p_ip_hash: ipHash, p_maximo: 5, p_janela: '15 minutes' }
  const { data: liberado, error: erroLimite } = await admin.rpc('dentro_do_limite', {
    ...limite,
    p_registrar: false,
  })
  if (erroLimite) return erro(req, 500, FALHA)
  if (!liberado) return erro(req, 429, BLOQUEADO, 'bloqueado')

  const registrarFalha = () => admin.from('limite_tentativa').insert({ acao: 'acesso_aluno', ip_hash: ipHash })

  const vinculo = matricula && codigoTurma ? await buscarVinculo(admin, matricula, codigoTurma) : null
  if (!vinculo) {
    await registrarFalha()
    return erro(req, 404, NAO_ENCONTRADO, 'nao_encontrado')
  }

  const enviarCodigo = (email: string, criarUsuario: boolean, nome?: string) =>
    anonimo.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: criarUsuario, data: nome ? { nome } : undefined },
    })

  // --- verificar ----------------------------------------------------------
  if (acao === 'verificar') {
    if (!vinculo.inscricao) return responder(req, 200, { etapa: 'cadastro' })

    const { error } = await enviarCodigo(vinculo.inscricao.email, false)
    if (error) return erro(req, 502, 'Não foi possível enviar o código. Tente de novo em instantes.', 'envio')
    return responder(req, 200, { etapa: 'codigo', email_mascarado: mascarar(vinculo.inscricao.email) })
  }

  // --- cadastrar ----------------------------------------------------------
  if (acao === 'cadastrar') {
    // ID já inscrito tentando novo cadastro: segue o login recorrente, com o
    // e-mail já cadastrado. Troca de e-mail só pelo admin (seção 7).
    if (vinculo.inscricao) {
      const { error } = await enviarCodigo(vinculo.inscricao.email, false)
      if (error) return erro(req, 502, 'Não foi possível enviar o código. Tente de novo em instantes.', 'envio')
      return responder(req, 200, { etapa: 'codigo', email_mascarado: mascarar(vinculo.inscricao.email) })
    }

    const nome = texto(corpo.nome)
    const email = texto(corpo.email).toLowerCase()
    if (nome === '' || !PADRAO_EMAIL.test(email)) {
      return erro(req, 422, 'Confira o nome e o e-mail informados.', 'validacao')
    }
    // LGPD: sem aceite do termo, o cadastro não conclui.
    if (corpo.aceite_termo !== true) {
      return erro(req, 422, 'É preciso aceitar o termo de uso para continuar.', 'termo')
    }

    const { error: erroPendente } = await admin.from('cadastro_pendente').upsert({
      aluno_autorizado_id: vinculo.autorizadoId,
      nome,
      email,
      // Nunca pré-marcado: só vale true quando o aluno ligou o switch.
      quer_comunicacao: corpo.quer_comunicacao === true,
      versao_termo: VERSAO_TERMO,
      expira_em: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })
    if (erroPendente) return erro(req, 500, FALHA)

    const { error } = await enviarCodigo(email, true, nome)
    if (error) return erro(req, 502, 'Não foi possível enviar o código. Tente de novo em instantes.', 'envio')
    return responder(req, 200, { etapa: 'codigo', email_mascarado: mascarar(email) })
  }

  // --- confirmar ----------------------------------------------------------
  const codigo = texto(corpo.codigo)
  if (!/^\d{6}$/.test(codigo)) return erro(req, 422, 'Informe o código de 6 dígitos.', 'codigo')

  let pendente: { nome: string; email: string; quer_comunicacao: boolean; versao_termo: string } | null = null
  if (!vinculo.inscricao) {
    const { data } = await admin
      .from('cadastro_pendente')
      .select('nome, email, quer_comunicacao, versao_termo')
      .eq('aluno_autorizado_id', vinculo.autorizadoId)
      .gt('expira_em', new Date().toISOString())
      .maybeSingle()
    pendente = data
    if (!pendente) return erro(req, 410, 'O cadastro expirou. Comece de novo.', 'expirado')
  }

  const email = vinculo.inscricao?.email ?? pendente!.email
  const { data: verificado, error: erroCodigo } = await anonimo.auth.verifyOtp({
    email,
    token: codigo,
    type: 'email',
  })
  if (erroCodigo || !verificado.session || !verificado.user) {
    await registrarFalha()
    return erro(req, 401, 'Código inválido ou expirado.', 'codigo')
  }

  let inscricaoId = vinculo.inscricao?.id

  if (!inscricaoId && pendente) {
    // E-mail já usado em outra turma: reaproveita o perfil e mantém o nome.
    const { error: erroPerfil } = await admin
      .from('perfil')
      .upsert(
        { id: verificado.user.id, nome: pendente.nome, email, papel: 'aluno' },
        { onConflict: 'id', ignoreDuplicates: true },
      )
    if (erroPerfil) return erro(req, 500, FALHA)

    const { data: nova, error: erroInscricao } = await admin
      .from('inscricao')
      .insert({
        aluno_autorizado_id: vinculo.autorizadoId,
        turma_id: vinculo.turmaId,
        perfil_id: verificado.user.id,
      })
      .select('id')
      .single()
    // Clique duplo ou corrida: a unique constraint impede a duplicata.
    if (erroInscricao && erroInscricao.code !== '23505') return erro(req, 500, FALHA)
    inscricaoId = nova?.id

    if (nova) {
      const base = { perfil_id: verificado.user.id, versao_termo: pendente.versao_termo, origem: 'cadastro' }
      await admin.from('consentimento').insert([
        { ...base, finalidade: 'uso_dados_pedagogicos', concedido: true },
        { ...base, finalidade: 'comunicacao_professor', concedido: pendente.quer_comunicacao },
      ])
    }
    await admin.from('cadastro_pendente').delete().eq('aluno_autorizado_id', vinculo.autorizadoId)
  }

  if (inscricaoId) {
    await admin.from('inscricao').update({ ultimo_acesso_em: new Date().toISOString() }).eq('id', inscricaoId)
  }

  return responder(req, 200, {
    sessao: {
      access_token: verificado.session.access_token,
      refresh_token: verificado.session.refresh_token,
    },
    codigo_turma: vinculo.codigoTurma,
  })
})
