export const SENHA_MINIMA = 8
export const SENHA_MAXIMA = 72

/**
 * Regra de senha do aluno. É a mesma de `supabase/functions/_shared/alunos.ts`:
 * o servidor valida de novo; aqui a regra só evita uma ida à toa e mostra o
 * motivo no campo. Devolve o problema, ou null se a senha serve.
 */
export function problemaDaSenha(senha: string): string | null {
  if (senha.length < SENHA_MINIMA) return `A senha precisa ter ao menos ${SENHA_MINIMA} caracteres.`
  if (senha.length > SENHA_MAXIMA) return `A senha pode ter no máximo ${SENHA_MAXIMA} caracteres.`
  if (!/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) return 'A senha precisa ter letras e números.'
  return null
}

export type CadastroDeAluno = {
  nome: string
  matricula: string
  codigoTurma: string
  senha: string
  confirmacao: string
  aceiteTermo: boolean
  /** Opcional: e-mail de contato, para comunicações que o aluno autorizar depois. */
  email?: string
}

export type ErrosDeCadastro = Partial<Record<keyof CadastroDeAluno, string>>

/** Erro por campo do formulário "Criar conta"; objeto vazio = pode enviar. */
export function validarCadastro(c: CadastroDeAluno): ErrosDeCadastro {
  const erros: ErrosDeCadastro = {}
  if (c.nome.trim().length < 3) erros.nome = 'Informe seu nome completo.'
  if (c.matricula.trim() === '') erros.matricula = 'Informe o seu ID de aluno.'
  if (c.codigoTurma.trim() === '') erros.codigoTurma = 'Informe o ID da turma.'
  const problema = problemaDaSenha(c.senha)
  if (problema) erros.senha = problema
  if (c.confirmacao !== c.senha) erros.confirmacao = 'As senhas não coincidem.'
  if (!c.aceiteTermo) erros.aceiteTermo = 'É preciso aceitar o termo de uso para continuar.'
  const email = c.email?.trim() ?? ''
  if (email !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) erros.email = 'Confira o e-mail ou deixe o campo em branco.'
  return erros
}
