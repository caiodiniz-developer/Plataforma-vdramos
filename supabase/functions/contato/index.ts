// Edge Function `contato` (PRD F2): recebe o formulário da landing, aplica o
// limite de 3 envios por IP por hora e grava em `contato_mensagem`.

import { clienteAdmin } from '../_shared/clientes.ts'
import { cabecalhosCors, erro, hashDoIp, lerCorpo, responder, texto } from '../_shared/http.ts'

const ASSUNTOS = ['consultoria', 'treinamento', 'palestra', 'outro']
const PADRAO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors(req) })
  if (req.method !== 'POST') return erro(req, 405, 'Método não permitido.')

  const corpo = await lerCorpo(req)
  if (!corpo) return erro(req, 400, 'Requisição inválida.')

  const nome = texto(corpo.nome)
  const email = texto(corpo.email).toLowerCase()
  const assunto = texto(corpo.assunto)
  const assuntoOutro = texto(corpo.assunto_outro)
  const mensagem = texto(corpo.mensagem)

  // Mesmas regras de `src/dominio/contato.ts`; o servidor não confia no cliente.
  if (
    nome === '' ||
    !PADRAO_EMAIL.test(email) ||
    !ASSUNTOS.includes(assunto) ||
    (assunto === 'outro' && assuntoOutro === '') ||
    mensagem.length < 10 ||
    mensagem.length > 2000 ||
    corpo.aceitou_privacidade !== true
  ) {
    return erro(req, 422, 'Confira os campos do formulário.', 'validacao')
  }

  const admin = clienteAdmin()

  const { data: liberado, error: erroLimite } = await admin.rpc('dentro_do_limite', {
    p_acao: 'contato',
    p_ip_hash: await hashDoIp(req),
    p_maximo: 3,
    p_janela: '1 hour',
  })
  if (erroLimite) return erro(req, 500, 'Não foi possível enviar agora. Tente de novo.')
  if (!liberado) {
    return erro(req, 429, 'Você atingiu o limite de mensagens por hora. Tente mais tarde.', 'limite')
  }

  const { error } = await admin.from('contato_mensagem').insert({
    nome,
    email,
    assunto,
    assunto_outro: assunto === 'outro' ? assuntoOutro : null,
    mensagem,
  })
  if (error) return erro(req, 500, 'Não foi possível enviar agora. Tente de novo.')

  return responder(req, 201, { ok: true })
})
