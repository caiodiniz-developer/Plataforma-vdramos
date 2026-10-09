type Arquivo = { name: string; size: number }

/**
 * Confere os arquivos que o aluno escolheu antes de enviar: quantidade (somada
 * ao que já foi enviado), arquivo vazio e tamanho. Devolve o problema, ou null
 * se pode enviar. O servidor confere tudo de novo ao registrar a entrega.
 */
export function problemaDosArquivos(
  escolhidos: Arquivo[],
  jaEnviados: number,
  limites: { maximoMb: number; porAtividade: number },
): string | null {
  if (escolhidos.length === 0) return null
  if (jaEnviados + escolhidos.length > limites.porAtividade) {
    const restam = Math.max(0, limites.porAtividade - jaEnviados)
    return restam === 0
      ? `Você já enviou o limite de ${limites.porAtividade} arquivos.`
      : `Dá para enviar mais ${restam} ${restam === 1 ? 'arquivo' : 'arquivos'}. Junte os demais em um .zip.`
  }
  const vazio = escolhidos.find((a) => a.size === 0)
  if (vazio) return `O arquivo "${vazio.name}" está vazio.`
  const grande = escolhidos.find((a) => a.size > limites.maximoMb * 1024 * 1024)
  if (grande) return `O arquivo "${grande.name}" passa de ${limites.maximoMb} MB. Compacte ou divida.`
  return null
}

/** 1536 → "2 KB"; 3 MB → "3,0 MB". */
export function tamanhoLegivel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
