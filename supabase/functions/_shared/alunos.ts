// Regras de conta de aluno compartilhadas entre `acesso-aluno` e `admin-alunos`.
//
// O aluno entra com ID do aluno + ID da turma + senha. O Supabase Auth exige um
// e-mail por conta, então cada ID autorizado recebe um endereço interno, que
// nunca é mostrado nem usado para envio (`.invalid` é um domínio reservado que
// não entrega e-mail). A senha fica no Auth, guardada com hash (bcrypt).

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const SENHA_MINIMA = 8

/** E-mail interno da conta de um ID autorizado. */
export function emailInterno(alunoAutorizadoId: string): string {
  return `aluno-${alunoAutorizadoId}@alunos.vitorramos.invalid`
}

/** Devolve o motivo da recusa, ou null se a senha serve. */
export function problemaDaSenha(senha: unknown): string | null {
  if (typeof senha !== 'string' || senha.length < SENHA_MINIMA) {
    return `A senha precisa ter ao menos ${SENHA_MINIMA} caracteres.`
  }
  if (senha.length > 72) return 'A senha pode ter no máximo 72 caracteres.'
  if (!/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) return 'A senha precisa ter letras e números.'
  return null
}

export type ContaCriada = { perfilId: string; inscricaoId: string; email: string }

/**
 * Cria a conta de um ID autorizado: usuário no Auth, perfil e inscrição.
 * Se algum passo falhar depois de criar o usuário, desfaz tudo — nunca sobra
 * um usuário sem inscrição.
 */
export async function criarConta(
  admin: SupabaseClient,
  dados: { alunoAutorizadoId: string; turmaId: string; nome: string; senha: string },
): Promise<ContaCriada | { erro: string; codigo: string }> {
  const email = emailInterno(dados.alunoAutorizadoId)

  const { data: criado, error: erroUsuario } = await admin.auth.admin.createUser({
    email,
    password: dados.senha,
    email_confirm: true,
    user_metadata: { nome: dados.nome },
  })
  if (erroUsuario || !criado?.user) {
    return { erro: 'Já existe uma conta para este ID. Use a aba Entrar.', codigo: 'ja_existe' }
  }
  const perfilId = criado.user.id
  const desfazer = () => admin.auth.admin.deleteUser(perfilId)

  const { error: erroPerfil } = await admin
    .from('perfil')
    .insert({ id: perfilId, nome: dados.nome, email, papel: 'aluno' })
  if (erroPerfil) {
    await desfazer()
    return { erro: 'Não foi possível criar a conta. Tente de novo.', codigo: 'falha' }
  }

  const { data: inscricao, error: erroInscricao } = await admin
    .from('inscricao')
    .insert({ aluno_autorizado_id: dados.alunoAutorizadoId, turma_id: dados.turmaId, perfil_id: perfilId })
    .select('id')
    .single()
  if (erroInscricao || !inscricao) {
    await desfazer()
    return erroInscricao?.code === '23505'
      ? { erro: 'Já existe uma conta para este ID. Use a aba Entrar.', codigo: 'ja_existe' }
      : { erro: 'Não foi possível criar a conta. Tente de novo.', codigo: 'falha' }
  }

  return { perfilId, inscricaoId: inscricao.id, email }
}

/**
 * Apaga a conta de um aluno: as perguntas da sala (a autoria fica em tabela
 * separada, sem cascata a partir do perfil) e o usuário do Auth, que leva
 * perfil, inscrições, respostas, dúvidas, mensagens e feedbacks em cascata.
 */
export async function apagarConta(admin: SupabaseClient, perfilId: string): Promise<boolean> {
  const { data: inscricoes } = await admin.from('inscricao').select('id').eq('perfil_id', perfilId)
  const ids = (inscricoes ?? []).map((i) => i.id)
  if (ids.length > 0) {
    const { data: autorias } = await admin.from('pergunta_autoria').select('pergunta_id').in('inscricao_id', ids)
    const perguntas = (autorias ?? []).map((a) => a.pergunta_id)
    if (perguntas.length > 0) {
      const { error } = await admin.from('pergunta').delete().in('id', perguntas)
      if (error) return false
    }
  }
  const { error } = await admin.auth.admin.deleteUser(perfilId)
  return !error
}
