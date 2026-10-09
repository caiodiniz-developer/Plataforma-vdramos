// Gateway de e-mail das Edge Functions. Toda função que envia e-mail passa
// por aqui; trocar de provedor é trocar só este arquivo.
//
// Provedor: Resend (https://resend.com), pela API HTTP. Configuração por
// variáveis de ambiente (segredos do projeto, nunca no repositório):
//   RESEND_API_KEY   chave da API
//   EMAIL_REMETENTE  ex.: "Vitor Ramos <avisos@vitorramos.com>" (domínio
//                    verificado no provedor)
// Sem as duas, nada é enviado e quem chamou recebe `configurado: false`:
// o resto da plataforma continua funcionando.

export type Anexo = { nome: string; conteudoBase64: string }

export type Mensagem = {
  para: string[]
  assunto: string
  html: string
  anexos?: Anexo[]
  /** Para onde vai a resposta de quem recebe. */
  responderPara?: string
}

export type ResultadoDoEnvio = { configurado: boolean; enviado: boolean; motivo?: string }

export function emailConfigurado(): boolean {
  return Boolean(Deno.env.get('RESEND_API_KEY') && Deno.env.get('EMAIL_REMETENTE'))
}

export async function enviarEmail(mensagem: Mensagem): Promise<ResultadoDoEnvio> {
  const chave = Deno.env.get('RESEND_API_KEY')
  const remetente = Deno.env.get('EMAIL_REMETENTE')
  if (!chave || !remetente) return { configurado: false, enviado: false, motivo: 'nao_configurado' }
  if (mensagem.para.length === 0) return { configurado: true, enviado: false, motivo: 'sem_destinatario' }

  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: remetente,
        to: mensagem.para,
        subject: mensagem.assunto,
        html: mensagem.html,
        reply_to: mensagem.responderPara,
        attachments: mensagem.anexos?.map((a) => ({ filename: a.nome, content: a.conteudoBase64 })),
      }),
    })
    // O corpo do erro do provedor não volta para o cliente: pode citar endereços.
    return resposta.ok
      ? { configurado: true, enviado: true }
      : { configurado: true, enviado: false, motivo: `provedor_${resposta.status}` }
  } catch {
    return { configurado: true, enviado: false, motivo: 'rede' }
  }
}
