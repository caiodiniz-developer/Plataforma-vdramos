import { normalizarMatricula } from '@/dominio/matricula'
import { chamarFuncao, ErroDeDados, supabase } from './supabase'

export type IdsDeAcesso = { matricula: string; codigoTurma: string }

export type EtapaDeAcesso = { etapa: 'cadastro' } | { etapa: 'codigo'; emailMascarado: string }

export type DadosDeCadastro = {
  nome: string
  email: string
  aceiteTermo: boolean
  querComunicacao: boolean
}

type RespostaEtapa = { etapa: 'cadastro' | 'codigo'; email_mascarado?: string }
type RespostaSessao = { sessao: { access_token: string; refresh_token: string }; codigo_turma: string }

function ids({ matricula, codigoTurma }: IdsDeAcesso) {
  // A mesma normalização vale no servidor; aqui só evita uma ida à toa.
  return { matricula: normalizarMatricula(matricula), codigo_turma: normalizarMatricula(codigoTurma) }
}

function paraEtapa(resposta: RespostaEtapa): EtapaDeAcesso {
  return resposta.etapa === 'cadastro'
    ? { etapa: 'cadastro' }
    : { etapa: 'codigo', emailMascarado: resposta.email_mascarado ?? '•••' }
}

/**
 * PRD F3 e F4, etapa 1: valida os dois IDs na Edge Function `acesso-aluno`.
 * Quem já tem inscrição recebe o código no e-mail cadastrado; quem não tem
 * segue para o cadastro. Também serve para reenviar o código.
 */
export async function verificarIds(acesso: IdsDeAcesso): Promise<EtapaDeAcesso> {
  return paraEtapa(await chamarFuncao<RespostaEtapa>('acesso-aluno', { acao: 'verificar', ...ids(acesso) }))
}

/** PRD F3, etapa 2: envia o cadastro e dispara o código para o e-mail informado. */
export async function cadastrar(acesso: IdsDeAcesso, dados: DadosDeCadastro): Promise<EtapaDeAcesso> {
  return paraEtapa(
    await chamarFuncao<RespostaEtapa>('acesso-aluno', {
      acao: 'cadastrar',
      ...ids(acesso),
      nome: dados.nome.trim(),
      email: dados.email.trim(),
      aceite_termo: dados.aceiteTermo,
      quer_comunicacao: dados.querComunicacao,
    }),
  )
}

/**
 * Etapa 3: confere o código no servidor e instala a sessão no navegador.
 * Devolve o código da turma para o redirecionamento.
 */
export async function confirmarCodigo(acesso: IdsDeAcesso, codigo: string): Promise<string> {
  const resposta = await chamarFuncao<RespostaSessao>('acesso-aluno', {
    acao: 'confirmar',
    ...ids(acesso),
    codigo,
  })
  const { error } = await supabase().auth.setSession(resposta.sessao)
  if (error) throw new ErroDeDados('Não foi possível iniciar a sessão. Tente de novo.', 'sessao')
  return resposta.codigo_turma
}
