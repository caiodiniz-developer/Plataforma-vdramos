// Montagem dos e-mails (assunto e HTML). Funções puras: não acessam rede nem
// banco, para serem testadas diretamente.

/** Escapa texto do usuário antes de entrar no HTML do e-mail. */
export function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const LINK = /\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"')\]]+)/g

/**
 * Texto do professor em HTML: escapa tudo, transforma `[texto](https://…)` e
 * endereços soltos em links e mantém as quebras de linha. Só http e https.
 */
export function textoParaHtml(texto: string): string {
  let html = ''
  let ultimo = 0
  for (const achado of texto.matchAll(LINK)) {
    const inicio = achado.index ?? 0
    html += escapar(texto.slice(ultimo, inicio))
    // Pontuação no fim de um endereço solto é da frase, não do link.
    const solto = achado[3]?.replace(/[.,;:!?]+$/, '')
    const url = achado[2] ?? solto!
    const rotulo = achado[1] ?? solto!
    html += `<a href="${escapar(url)}">${escapar(rotulo)}</a>`
    ultimo = inicio + (achado[2] ? achado[0].length : solto!.length)
  }
  html += escapar(texto.slice(ultimo))
  return html.replace(/\r?\n/g, '<br>')
}

const ESTILO = 'font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#181a1e'

function moldura(titulo: string, corpo: string, rodape: string): string {
  return `<div style="${ESTILO};max-width:640px">
<h2 style="font-size:20px;margin:0 0 16px">${escapar(titulo)}</h2>
${corpo}
<hr style="border:0;border-top:1px solid #c9c9c4;margin:24px 0 12px">
<p style="font-size:12px;color:#5a5a56;margin:0">${rodape}</p>
</div>`
}

export type RespostaParaEmail = { ordem: number; enunciado: string; resposta: string; correta: boolean | null }
export type ArquivoParaEmail = { nome: string; tamanhoBytes: number; link: string | null; anexado: boolean }

export type DadosDaResposta = {
  turma: string
  aluno: string
  matricula: string
  atividade: string
  descricao: string | null
  prazo: string | null
  enviadaEm: string
  respostas: RespostaParaEmail[]
  arquivos: ArquivoParaEmail[]
}

/** Assunto pedido pelo professor: "Turma - Aluno - Atividade". */
export function assuntoDaResposta(d: Pick<DadosDaResposta, 'turma' | 'aluno' | 'atividade'>): string {
  return `${d.turma} - ${d.aluno} - ${d.atividade}`
}

function tamanho(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function htmlDaResposta(d: DadosDaResposta): string {
  const linha = (rotulo: string, valor: string) =>
    `<tr><td style="padding:2px 16px 2px 0;color:#5a5a56">${rotulo}</td><td style="padding:2px 0"><strong>${escapar(valor)}</strong></td></tr>`

  const detalhes = `<table style="border-collapse:collapse;font-size:14px;margin:0 0 16px">
${linha('Turma', d.turma)}
${linha('Aluno', `${d.aluno} (${d.matricula})`)}
${linha('Atividade', d.atividade)}
${d.prazo ? linha('Prazo', d.prazo) : ''}
${linha('Enviada em', d.enviadaEm)}
</table>
${d.descricao ? `<p style="margin:0 0 16px">${textoParaHtml(d.descricao)}</p>` : ''}`

  const respostas = d.respostas
    .map((r) => {
      const selo = r.correta === null ? '' : r.correta ? ' <span style="color:#1f7a45">(certa)</span>' : ' <span style="color:#a8530f">(errada)</span>'
      return `<p style="margin:0 0 4px;color:#5a5a56">${r.ordem}. ${escapar(r.enunciado)}</p>
<p style="margin:0 0 14px;padding-left:12px;border-left:3px solid #2f6fed">${textoParaHtml(r.resposta)}${selo}</p>`
    })
    .join('\n')

  const arquivos =
    d.arquivos.length === 0
      ? ''
      : `<h3 style="font-size:15px;margin:16px 0 8px">Arquivos enviados</h3><ul style="margin:0;padding-left:18px">${d.arquivos
          .map((a) => {
            const nome = a.link ? `<a href="${escapar(a.link)}">${escapar(a.nome)}</a>` : escapar(a.nome)
            const onde = a.anexado ? 'em anexo' : a.link ? 'link válido por 7 dias' : 'abra pelo painel'
            return `<li>${nome} — ${tamanho(a.tamanhoBytes)} (${onde})</li>`
          })
          .join('')}</ul>`

  return moldura(
    'Nova resposta de atividade',
    `${detalhes}<h3 style="font-size:15px;margin:16px 0 8px">Respostas</h3>${respostas || '<p>Sem respostas em texto.</p>'}${arquivos}`,
    'Enviado pela plataforma de apoio às aulas. As respostas também ficam em Atividades &gt; Ver respostas.',
  )
}

export function htmlDoAviso(aviso: { titulo: string; texto: string; turmas: string[] }, enderecoDoSite: string | null): string {
  const para = aviso.turmas.length === 0 ? 'todos os alunos' : aviso.turmas.length === 1 ? `a turma ${aviso.turmas[0]}` : `as turmas ${aviso.turmas.join(', ')}`
  const acesso = enderecoDoSite ? ` Para deixar de receber, entre em <a href="${escapar(enderecoDoSite)}/aluno/meus-dados">Meus dados</a> e desligue as comunicações.` : ' Para deixar de receber, desligue as comunicações em Meus dados, na área do aluno.'
  return moldura(
    aviso.titulo,
    `<p style="margin:0 0 16px">${textoParaHtml(aviso.texto)}</p>`,
    `Aviso do professor Vitor Ramos para ${escapar(para)}. Você recebeu porque autorizou comunicações por e-mail.${acesso}`,
  )
}
