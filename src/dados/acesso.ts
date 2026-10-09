import { normalizarMatricula } from '@/dominio/matricula'
import { chamarFuncao, ErroDeDados, supabase } from './supabase'

export type IdsDeAcesso = { matricula: string; codigoTurma: string }

type RespostaSessao = { sessao: { access_token: string; refresh_token: string }; codigo_turma: string }

function ids({ matricula, codigoTurma }: IdsDeAcesso) {
  // A mesma normalização vale no servidor; aqui só evita uma ida à toa.
  return { matricula: normalizarMatricula(matricula), codigo_turma: normalizarMatricula(codigoTurma) }
}

/** Instala no navegador a sessão que a Edge Function devolveu. */
async function instalarSessao(resposta: RespostaSessao): Promise<string> {
  const falha = new ErroDeDados('Não foi possível iniciar a sessão. Tente de novo.', 'sessao')
  try {
    const { error } = await supabase().auth.setSession(resposta.sessao)
    if (error) throw falha
  } catch {
    // O SDK pode lançar erro em inglês com detalhe técnico; a tela mostra só a mensagem em pt-BR.
    throw falha
  }
  return resposta.codigo_turma
}

/**
 * Entrada do aluno com ID do aluno + ID da turma + senha. A conferência é
 * feita na Edge Function `acesso-aluno` (a senha é verificada pelo Supabase
 * Auth, que guarda só o hash). Devolve o código da turma.
 */
export async function entrar(acesso: IdsDeAcesso, senha: string): Promise<string> {
  return instalarSessao(await chamarFuncao<RespostaSessao>('acesso-aluno', { acao: 'entrar', ...ids(acesso), senha }))
}

/**
 * Cria a conta de um ID autorizado pelo professor e já deixa o aluno logado.
 * O servidor recusa ID fora da lista, turma inexistente, ID que já tem conta
 * e senha fraca.
 */
export async function cadastrar(
  acesso: IdsDeAcesso,
  dados: { nome: string; senha: string; aceiteTermo: boolean; email?: string },
): Promise<string> {
  return instalarSessao(
    await chamarFuncao<RespostaSessao>('acesso-aluno', {
      acao: 'cadastrar',
      ...ids(acesso),
      nome: dados.nome.trim(),
      senha: dados.senha,
      aceite_termo: dados.aceiteTermo,
      // Opcional: só é usado para comunicações se o aluno consentir depois.
      email: dados.email?.trim() || undefined,
    }),
  )
}
