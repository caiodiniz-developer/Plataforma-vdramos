// Edge Function `notificar-resposta`: depois que o aluno responde uma
// atividade, envia as respostas e os arquivos para o e-mail do professor.
//
// Corpo: { atividade_id }
// Quem chama é o próprio aluno (JWT conferido). A função lê do banco o que
// ele respondeu: nada do corpo da requisição entra no e-mail.
// Cada (atividade, aluno) gera no máximo um e-mail.
//
// Assunto: "Turma - Aluno - Atividade". Corpo: detalhes da atividade, as
// respostas e os arquivos (em anexo até 8 MB no total; acima disso, link).

import { clienteAdmin, clienteDoUsuario } from '../_shared/clientes.ts'
import { emailConfigurado, enviarEmail, type Anexo } from '../_shared/email.ts'
import { cabecalhosCors, erro, lerCorpo, responder, texto } from '../_shared/http.ts'
import { assuntoDaResposta, htmlDaResposta, type ArquivoParaEmail, type RespostaParaEmail } from '../_shared/mensagens.ts'

const LIMITE_DE_ANEXOS = 8 * 1024 * 1024
const SETE_DIAS = 7 * 24 * 60 * 60

function dataHora(instante: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(instante))
}

function paraBase64(bytes: Uint8Array): string {
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binario)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors(req) })
  if (req.method !== 'POST') return erro(req, 405, 'Método não permitido.')

  const { data: quem, error: erroSessao } = await clienteDoUsuario(req).auth.getUser()
  if (erroSessao || !quem.user) return erro(req, 401, 'Sessão inválida. Entre de novo.')

  const corpo = await lerCorpo(req)
  const atividadeId = texto(corpo?.atividade_id)
  if (!atividadeId) return erro(req, 400, 'Requisição inválida.')

  // Sem provedor configurado, não há o que fazer (nem o que registrar).
  if (!emailConfigurado()) return responder(req, 200, { configurado: false, enviado: false })

  const admin = clienteAdmin()
  const { data: atividade } = await admin
    .from('atividade')
    .select('id, turma_id, titulo, descricao, prazo_em')
    .eq('id', atividadeId)
    .maybeSingle()
  if (!atividade) return erro(req, 404, 'Atividade não encontrada.')

  const { data: inscricao } = await admin
    .from('inscricao')
    .select('id, aluno_autorizado_id')
    .eq('perfil_id', quem.user.id)
    .eq('turma_id', atividade.turma_id)
    .maybeSingle()
  if (!inscricao) return erro(req, 403, 'Você não tem acesso a esta atividade.')

  // Um e-mail por atividade e aluno: a chave primária barra a repetição.
  const { error: jaEnviado } = await admin.from('atividade_email').insert({ atividade_id: atividade.id, inscricao_id: inscricao.id })
  if (jaEnviado) return responder(req, 200, { configurado: true, enviado: false, motivo: 'ja_enviado' })
  const desfazerRegistro = () => admin.from('atividade_email').delete().eq('atividade_id', atividade.id).eq('inscricao_id', inscricao.id)

  const [{ data: itens }, { data: respostas }, { data: entregas }, { data: turma }, { data: perfil }, { data: autorizado }, { data: professores }] =
    await Promise.all([
      admin.from('atividade_item').select('id, ordem, enunciado').eq('atividade_id', atividade.id),
      admin.from('atividade_resposta').select('atividade_item_id, opcao_ids, valor, texto, correta, created_at').eq('inscricao_id', inscricao.id),
      admin.from('atividade_entrega').select('arquivo_path, nome_arquivo, tamanho_bytes').eq('atividade_id', atividade.id).eq('inscricao_id', inscricao.id),
      admin.from('turma').select('codigo').eq('id', atividade.turma_id).maybeSingle(),
      admin.from('perfil').select('nome').eq('id', quem.user.id).maybeSingle(),
      admin.from('aluno_autorizado').select('matricula').eq('id', inscricao.aluno_autorizado_id).maybeSingle(),
      admin.from('perfil').select('email').eq('papel', 'admin'),
    ])

  const idsDosItens = (itens ?? []).map((i) => i.id)
  const minhas = (respostas ?? []).filter((r) => idsDosItens.includes(r.atividade_item_id))
  if (minhas.length === 0) {
    await desfazerRegistro()
    return erro(req, 409, 'Responda a atividade antes.', 'sem_resposta')
  }

  const { data: opcoes } = await admin.from('atividade_opcao').select('id, texto').in('atividade_item_id', idsDosItens)
  const textoDaOpcao = new Map((opcoes ?? []).map((o) => [o.id, o.texto as string]))

  const linhas: RespostaParaEmail[] = [...(itens ?? [])]
    .sort((a, b) => a.ordem - b.ordem)
    .map((item) => {
      const r = minhas.find((x) => x.atividade_item_id === item.id)
      const escolhidas = ((r?.opcao_ids as string[] | null) ?? []).map((id) => textoDaOpcao.get(id) ?? '').filter(Boolean)
      const resposta = escolhidas.length > 0 ? escolhidas.join(' | ') : (r?.texto ?? (r?.valor != null ? String(r.valor) : '(sem resposta)'))
      return { ordem: item.ordem, enunciado: item.enunciado, resposta, correta: r?.correta ?? null }
    })

  // Arquivos: anexa enquanto couber no limite; o resto vai como link assinado.
  const anexos: Anexo[] = []
  const arquivos: ArquivoParaEmail[] = []
  let anexado = 0
  for (const entrega of entregas ?? []) {
    const { data: assinado } = await admin.storage.from('materiais').createSignedUrl(entrega.arquivo_path, SETE_DIAS)
    let foiAnexado = false
    if (anexado + Number(entrega.tamanho_bytes) <= LIMITE_DE_ANEXOS) {
      const { data: arquivo } = await admin.storage.from('materiais').download(entrega.arquivo_path)
      if (arquivo) {
        anexos.push({ nome: entrega.nome_arquivo, conteudoBase64: paraBase64(new Uint8Array(await arquivo.arrayBuffer())) })
        anexado += Number(entrega.tamanho_bytes)
        foiAnexado = true
      }
    }
    arquivos.push({ nome: entrega.nome_arquivo, tamanhoBytes: Number(entrega.tamanho_bytes), link: assinado?.signedUrl ?? null, anexado: foiAnexado })
  }

  const dados = {
    turma: turma?.codigo ?? '',
    aluno: perfil?.nome ?? 'Aluno',
    matricula: autorizado?.matricula ?? '',
    atividade: atividade.titulo,
    descricao: atividade.descricao,
    prazo: atividade.prazo_em ? dataHora(atividade.prazo_em) : null,
    enviadaEm: dataHora(minhas.map((r) => r.created_at as string).sort().at(-1)!),
    respostas: linhas,
    arquivos,
  }

  // Destino: EMAIL_DO_PROFESSOR, se definido; senão, o e-mail das contas de professor.
  const fixo = (Deno.env.get('EMAIL_DO_PROFESSOR') ?? '').split(',').map((e) => e.trim()).filter(Boolean)
  const para = fixo.length > 0 ? fixo : (professores ?? []).map((p) => p.email as string).filter((e) => e && !e.endsWith('.test') && !e.endsWith('.invalid'))

  const resultado = await enviarEmail({ para, assunto: assuntoDaResposta(dados), html: htmlDaResposta(dados), anexos })
  // Se não saiu, libera o registro para uma nova tentativa.
  if (!resultado.enviado) await desfazerRegistro()
  return responder(req, 200, resultado)
})
