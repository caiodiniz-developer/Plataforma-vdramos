export type Finalidade = 'comunicacao_professor' | 'uso_dados_pedagogicos'
export type OrigemConsentimento = 'cadastro' | 'area_aluno' | 'admin'

export type Consentimento = {
  finalidade: Finalidade
  concedido: boolean
  versao_termo: string
  origem: OrigemConsentimento
  created_at: string
}

/**
 * Versão vigente do termo de uso e da política de privacidade. O texto fica
 * em `src/conteudo/privacidade.ts`; ao alterá-lo, troque a versão aqui para
 * que os alunos aceitem de novo no próximo login (PRD, seção 7 — LGPD).
 */
export const VERSAO_TERMO_VIGENTE = '2026-10-v1'

export const ROTULO_FINALIDADE: Record<Finalidade, string> = {
  comunicacao_professor: 'Comunicações do professor por e-mail',
  uso_dados_pedagogicos: 'Uso dos dados para fins pedagógicos',
}

/** A tabela é append-only: vale o registro mais recente de cada finalidade. */
export function consentimentoVigente(
  historico: Consentimento[],
  finalidade: Finalidade,
): Consentimento | null {
  return (
    historico
      .filter((c) => c.finalidade === finalidade)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  )
}

export function concedeu(historico: Consentimento[], finalidade: Finalidade): boolean {
  return consentimentoVigente(historico, finalidade)?.concedido ?? false
}

/**
 * O aluno precisa aceitar o termo de novo quando nunca aceitou, quando
 * revogou ou quando a versão aceita não é mais a vigente.
 */
export function precisaAceitarTermo(
  historico: Consentimento[],
  versaoVigente: string = VERSAO_TERMO_VIGENTE,
): boolean {
  const atual = consentimentoVigente(historico, 'uso_dados_pedagogicos')
  return !atual || !atual.concedido || atual.versao_termo !== versaoVigente
}

/** Registros gravados no cadastro: o aceite do termo e a escolha do switch. */
export function consentimentosDoCadastro(
  querComunicacao: boolean,
  versao: string = VERSAO_TERMO_VIGENTE,
): Omit<Consentimento, 'created_at'>[] {
  return [
    { finalidade: 'uso_dados_pedagogicos', concedido: true, versao_termo: versao, origem: 'cadastro' },
    {
      finalidade: 'comunicacao_professor',
      concedido: querComunicacao,
      versao_termo: versao,
      origem: 'cadastro',
    },
  ]
}

/**
 * O aluno ainda não disse se quer receber comunicações do professor? Enquanto
 * não houver nenhum registro dessa finalidade, a pergunta aparece antes do
 * portal. Responder "não" também é uma resposta: não pergunta de novo.
 */
export function precisaResponderComunicacao(historico: Consentimento[]): boolean {
  return !historico.some((c) => c.finalidade === 'comunicacao_professor')
}

/** E-mail com formato aceitável (o mesmo critério do banco). */
export function emailValido(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
}
