/**
 * Uma versão anterior da landing deixava a pessoa escolher o nível de animação
 * (completo, essencial ou nenhum) e guardava a escolha no navegador. Por
 * decisão do dono do produto, a landing passou a animar sempre por inteiro e
 * o controle saiu.
 *
 * A chave antiga é apagada na inicialização para que nenhuma escolha guardada
 * fique esquecida no navegador de quem já visitou o site.
 */
export const CHAVE_ANTIGA_DE_MOVIMENTO = 'vr:movimento'

export function apagarEscolhaAntigaDeMovimento(guarda?: Pick<Storage, 'removeItem'>) {
  try {
    ;(guarda ?? window.localStorage).removeItem(CHAVE_ANTIGA_DE_MOVIMENTO)
  } catch {
    // Armazenamento bloqueado ou inexistente: não há o que apagar.
  }
}
