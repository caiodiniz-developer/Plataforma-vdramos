// Edge Function `enviar-aviso`: manda por e-mail um aviso já publicado, só
// para os alunos das turmas do aviso que autorizaram comunicações do
// professor (consentimento vigente) e informaram um e-mail de contato.
//
// Corpo: { lote_id }  (um aviso para várias turmas compartilha o lote)
// Só o professor chama. Cada aluno recebe o seu e-mail, sem ver os demais.

import { clienteAdmin, clienteDoUsuario } from '../_shared/clientes.ts'
import { emailConfigurado, enviarEmail } from '../_shared/email.ts'
import { cabecalhosCors, erro, lerCorpo, responder, texto } from '../_shared/http.ts'
import { htmlDoAviso } from '../_shared/mensagens.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors(req) })
  if (req.method !== 'POST') return erro(req, 405, 'Método não permitido.')

  const { data: quem, error: erroSessao } = await clienteDoUsuario(req).auth.getUser()
  if (erroSessao || !quem.user) return erro(req, 401, 'Sessão inválida. Entre de novo.')

  const admin = clienteAdmin()
  const { data: perfil } = await admin.from('perfil').select('papel, email').eq('id', quem.user.id).maybeSingle()
  if (perfil?.papel !== 'admin') return erro(req, 403, 'Somente o professor envia avisos.')

  const corpo = await lerCorpo(req)
  const loteId = texto(corpo?.lote_id)
  if (!loteId) return erro(req, 400, 'Requisição inválida.')

  const { data: avisos } = await admin.from('aviso').select('turma_id, titulo, texto').eq('lote_id', loteId)
  if (!avisos || avisos.length === 0) return erro(req, 404, 'Aviso não encontrado.')

  // Aviso com turma nula vale para todos os alunos.
  const paraTodos = avisos.some((a) => a.turma_id === null)
  const idsDasTurmas = avisos.map((a) => a.turma_id as string | null).filter((id): id is string => id !== null)

  const { data: lista } = await admin.from('vw_emails_comunicacao').select('turma_id, email')
  const destinatarios = [
    ...new Set(
      (lista ?? [])
        .filter((l) => paraTodos || idsDasTurmas.includes(l.turma_id as string))
        .map((l) => String(l.email).toLowerCase()),
    ),
  ]

  if (!emailConfigurado()) return responder(req, 200, { configurado: false, destinatarios: destinatarios.length, enviados: 0 })
  if (destinatarios.length === 0) return responder(req, 200, { configurado: true, destinatarios: 0, enviados: 0 })

  const { data: turmas } = idsDasTurmas.length > 0 ? await admin.from('turma').select('codigo').in('id', idsDasTurmas) : { data: [] }
  const html = htmlDoAviso(
    { titulo: avisos[0].titulo, texto: avisos[0].texto, turmas: paraTodos ? [] : (turmas ?? []).map((t) => t.codigo as string) },
    Deno.env.get('ENDERECO_DO_SITE') ?? null,
  )

  // Um e-mail por aluno: ninguém vê o endereço dos colegas.
  let enviados = 0
  for (const email of destinatarios) {
    const resultado = await enviarEmail({ para: [email], assunto: avisos[0].titulo, html, responderPara: perfil.email as string })
    if (resultado.enviado) enviados += 1
  }
  return responder(req, 200, { configurado: true, destinatarios: destinatarios.length, enviados })
})
