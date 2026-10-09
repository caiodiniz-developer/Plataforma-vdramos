// Verificação de ponta a ponta contra o projeto Supabase REAL do `.env`.
//
//   npm run verificar:backend
//
// Faz o caminho completo professor → banco → aluno com um aluno temporário
// (ID `VERIFICA-<n>`), confere as regras de acesso e apaga tudo o que criou.
// Não imprime senhas nem chaves. Precisa do admin já criado
// (`npm run usuarios:exemplo`) e de pelo menos uma turma ativa.

import { randomBytes } from 'node:crypto'

const exigir = (nome, ...alternativas) => {
  for (const chave of [nome, ...alternativas]) if (process.env[chave]?.trim()) return process.env[chave].trim()
  console.error(`Falta a variável ${nome} no .env.`)
  process.exit(1)
}
const URL_BASE = exigir('SUPABASE_URL', 'VITE_SUPABASE_URL')
const PUBLICA = exigir('VITE_SUPABASE_ANON_KEY')
const adminEmail = exigir('ADMIN_EMAIL')
const adminSegredo = exigir('ADMIN_SENHA')

let falhas = 0
const conferir = (nome, ok, detalhe = '') => {
  if (!ok) falhas += 1
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome}${detalhe ? ' — ' + detalhe : ''}`)
}

const cabecalhos = (token = PUBLICA) => ({ apikey: PUBLICA, Authorization: 'Bearer ' + token, 'content-type': 'application/json' })

async function chamar(metodo, caminho, { token, corpo, prefer } = {}) {
  const r = await fetch(URL_BASE + caminho, {
    method: metodo,
    headers: { ...cabecalhos(token), ...(prefer ? { Prefer: prefer } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  let json = null
  try {
    json = await r.json()
  } catch {
    // sem corpo
  }
  return { status: r.status, json }
}
const funcao = (nome, corpo, token) => chamar('POST', '/functions/v1/' + nome, { corpo, token })
const ler = (tabela, consulta, token) => chamar('GET', `/rest/v1/${tabela}?${consulta}`, { token })
const inserir = (tabela, corpo, token) =>
  chamar('POST', '/rest/v1/' + tabela, { corpo, token, prefer: 'return=representation' })

// Valor aleatório a cada execução; nunca é impresso.
const segredoDoAluno = 'V' + randomBytes(9).toString('base64url') + '7a'
const matricula = 'VERIFICA-' + Date.now().toString().slice(-6)
const criados = { conteudo: null, autorizado: null, curso: null, turmas: [] }
const sufixo = Date.now().toString().slice(-6)
let admin = null

try {
  // 1. Professor entra
  const login = await chamar('POST', '/auth/v1/token?grant_type=password', {
    corpo: { email: adminEmail, password: adminSegredo },
  })
  admin = login.json?.access_token
  conferir('professor entra com e-mail e senha', Boolean(admin), String(login.status))
  if (!admin) throw new Error('sem sessão de admin')

  // Duas turmas temporárias, só deste script: o que ele publica não chega a
  // nenhum aluno de verdade. São apagadas no fim.
  const curso = await inserir('curso', { nome: 'Verificação automática ' + sufixo, carga_horaria_h: 1, objetivo: 'Verificação', ementa_md: '' }, admin)
  criados.curso = curso.json?.[0]?.id ?? null
  const hoje = new Date().toISOString().slice(0, 10)
  const novas = await inserir(
    'turma',
    ['VERIF-A-' + sufixo, 'VERIF-B-' + sufixo].map((codigo) => ({
      curso_id: criados.curso, codigo, instituicao: 'Verificação', cidade: 'Campinas', modalidade: 'presencial', data_inicio: hoje, data_fim: hoje, status: 'ativa',
    })),
    admin,
  )
  criados.turmas = (novas.json ?? []).map((t) => t.id)
  const [turma, outraTurma] = novas.json ?? []
  conferir('professor cria turmas', novas.status === 201 && criados.turmas.length === 2, String(novas.status))
  if (!turma || !outraTurma) throw new Error('sem turma temporária')

  // 2. Professor cria o aluno já com conta
  const criar = await funcao(
    'admin-alunos',
    { acao: 'criar', turma_id: turma.id, matricula, nome: 'Aluno de Verificação', senha: segredoDoAluno },
    admin,
  )
  criados.autorizado = criar.json?.aluno_autorizado_id ?? null
  conferir('professor cria aluno com conta', criar.status === 201 && criar.json?.conta_criada === true, String(criar.status))

  const semPermissao = await funcao('admin-alunos', { acao: 'criar', turma_id: turma.id, matricula: 'X-1', nome: 'Invasor' })
  conferir('visitante não gerencia alunos', semPermissao.status === 401 || semPermissao.status === 403, String(semPermissao.status))

  // 3. Aluno entra com ID + turma + senha
  const ids = { matricula, codigo_turma: turma.codigo }
  const errada = await funcao('acesso-aluno', { acao: 'entrar', ...ids, senha: segredoDoAluno + 'x' })
  conferir('senha errada é recusada com mensagem genérica', errada.status === 401 && errada.json?.erro === 'ID, turma ou senha incorretos.', String(errada.status))

  const entrar = await funcao('acesso-aluno', { acao: 'entrar', ...ids, senha: segredoDoAluno })
  const aluno = entrar.json?.sessao?.access_token
  conferir('aluno entra com ID, turma e senha', entrar.status === 200 && Boolean(aluno), String(entrar.status))
  if (!aluno) throw new Error('sem sessão de aluno')

  const duplicada = await funcao('acesso-aluno', {
    acao: 'cadastrar', ...ids, nome: 'Outra Pessoa', senha: segredoDoAluno, aceite_termo: true,
  })
  conferir('não cria segunda conta para o mesmo ID', duplicada.status === 409, String(duplicada.status))

  // 4. Regras de acesso do aluno
  const minhasTurmas = await ler('turma', 'select=codigo', aluno)
  conferir('aluno vê só a própria turma', minhasTurmas.json?.length === 1 && minhasTurmas.json[0].codigo === turma.codigo, JSON.stringify(minhasTurmas.json?.map((t) => t.codigo)))
  const listaDeIds = await ler('aluno_autorizado', 'select=matricula', aluno)
  conferir('aluno não lê a lista de IDs', (listaDeIds.json ?? []).length === 0)
  const outrosPerfis = await ler('perfil', 'select=id', aluno)
  conferir('aluno lê só o próprio perfil', outrosPerfis.json?.length === 1)
  const tentaCriar = await inserir('conteudo', { tipo: 'aula', titulo: 'Do aluno', publicado: true }, aluno)
  conferir('aluno não cria conteúdo', tentaCriar.status >= 400, String(tentaCriar.status))

  // 5. Professor publica conteúdo → aluno vê e é notificado
  const conteudo = await inserir(
    'conteudo',
    { turma_id: turma.id, tipo: 'aula_extra', titulo: 'Verificação automática ' + matricula, descricao: 'Criado e apagado pelo script.', publicado: true },
    admin,
  )
  criados.conteudo = conteudo.json?.[0]?.id ?? null
  conferir('professor publica conteúdo', conteudo.status === 201 && Boolean(criados.conteudo), String(conteudo.status))

  const visto = await ler('conteudo', `select=titulo&id=eq.${criados.conteudo}`, aluno)
  conferir('aluno vê o conteúdo da turma', visto.json?.length === 1)
  const acesso = await chamar('POST', '/rest/v1/rpc/registrar_acesso', { token: aluno, corpo: { p_conteudo_id: criados.conteudo } })
  conferir('acesso ao conteúdo é registrado', acesso.status < 300, String(acesso.status))
  const notificacoes = await ler('notificacao', 'select=tipo,titulo&order=created_at.desc', aluno)
  conferir('aluno recebe notificação do conteúdo', (notificacoes.json ?? []).some((n) => n.tipo === 'conteudo' && n.titulo.includes(matricula)))

  // 6. Dúvida: aluno → professor → resposta → notificação
  const inscricao = (await ler('inscricao', 'select=id,turma_id', aluno)).json?.[0]
  const duvida = await inserir(
    'duvida',
    { inscricao_id: inscricao.id, turma_id: inscricao.turma_id, titulo: 'Dúvida de verificação', pergunta: 'Esta dúvida é um teste automático.' },
    aluno,
  )
  const duvidaId = duvida.json?.[0]?.id
  conferir('aluno envia dúvida', duvida.status === 201 && duvida.json?.[0]?.status === 'aberta', String(duvida.status))

  const responder = await chamar('PATCH', `/rest/v1/duvida?id=eq.${duvidaId}`, {
    token: admin, corpo: { status: 'respondida', resposta: 'Resposta de verificação.' }, prefer: 'return=representation',
  })
  conferir('professor responde a dúvida', responder.json?.[0]?.status === 'respondida', String(responder.status))
  const minha = await ler('duvida', `select=resposta,status&id=eq.${duvidaId}`, aluno)
  conferir('aluno lê a resposta', minha.json?.[0]?.resposta === 'Resposta de verificação.')
  const aposResposta = await ler('notificacao', 'select=tipo&tipo=eq.duvida', aluno)
  conferir('aluno é notificado da resposta', (aposResposta.json ?? []).length === 1)

  // 7. Mensagem privada e feedback
  const mensagem = await inserir('mensagem_privada', { inscricao_id: inscricao.id, autor: 'aluno', texto: 'Mensagem de verificação.' }, aluno)
  conferir('aluno envia mensagem ao professor', mensagem.status === 201, String(mensagem.status))
  const forjada = await inserir('mensagem_privada', { inscricao_id: inscricao.id, autor: 'professor', texto: 'Forjada.' }, aluno)
  conferir('aluno não se passa pelo professor', forjada.status >= 400, String(forjada.status))
  const feedback = await inserir('feedback', { inscricao_id: inscricao.id, turma_id: inscricao.turma_id, tipo: 'sugestao', texto: 'Feedback de verificação.' }, aluno)
  conferir('aluno envia feedback', feedback.status === 201, String(feedback.status))

  const painel = await ler('vw_aluno', `select=nome,situacao,conteudos_acessados,duvidas,feedbacks&matricula=eq.${matricula}`, admin)
  const linha = painel.json?.[0]
  conferir('painel do professor mostra o progresso do aluno', linha?.situacao === 'ativo' && Number(linha?.conteudos_acessados) === 1 && Number(linha?.duvidas) === 1 && Number(linha?.feedbacks) === 1, JSON.stringify(linha))
  const recente = await ler('vw_atividade_recente', 'select=aluno,descricao&order=quando.desc&limit=10', admin)
  conferir('atividade recente registra o que o aluno fez', (recente.json ?? []).some((r) => r.aluno === 'Aluno de Verificação'))

  // 8. Ajustes do guia do professor
  // 8.1 Consentimento de comunicações e e-mail de contato
  const meuPerfil = (await ler('perfil', 'select=id', aluno)).json?.[0]
  const contato = await chamar('PATCH', `/rest/v1/perfil?id=eq.${meuPerfil.id}`, { token: aluno, corpo: { email_contato: 'verificacao@exemplo.com' }, prefer: 'return=representation' })
  conferir('aluno grava o e-mail de contato', contato.json?.[0]?.email_contato === 'verificacao@exemplo.com', String(contato.status))
  const consente = await inserir('consentimento', { perfil_id: meuPerfil.id, finalidade: 'comunicacao_professor', concedido: true, versao_termo: '2026-10-v1', origem: 'area_aluno' }, aluno)
  conferir('aluno autoriza comunicações', consente.status === 201, String(consente.status))
  const lista = await ler('vw_emails_comunicacao', `select=email&turma_id=eq.${turma.id}`, admin)
  conferir('lista de envio traz quem consentiu e informou e-mail', lista.json?.length === 1 && lista.json[0].email === 'verificacao@exemplo.com', JSON.stringify(lista.json))

  // 8.2 Aluno em mais de uma turma
  const matricular = await chamar('POST', '/rest/v1/rpc/matricular_em_turma', { token: admin, corpo: { p_aluno_autorizado_id: criados.autorizado, p_turma_id: outraTurma.id } })
  conferir('professor adiciona o aluno a outra turma', matricular.status === 200, String(matricular.status))
  const duas = await ler('turma', 'select=codigo&order=codigo', aluno)
  conferir('aluno passa a ver as duas turmas', duas.json?.length === 2, JSON.stringify(duas.json?.map((t) => t.codigo)))
  const sair = await chamar('POST', '/rest/v1/rpc/sair_da_turma', { token: aluno, corpo: { p_turma_id: outraTurma.id } })
  conferir('aluno sai de uma turma', sair.status < 300, String(sair.status))
  const sairDaUltima = await chamar('POST', '/rest/v1/rpc/sair_da_turma', { token: aluno, corpo: { p_turma_id: turma.id } })
  conferir('aluno não sai da última turma', sairDaUltima.status >= 400 && /ao menos uma turma/.test(sairDaUltima.json?.message ?? ''), String(sairDaUltima.status))
  const voltar = await chamar('POST', '/rest/v1/rpc/entrar_na_turma', { token: aluno, corpo: { p_codigo: outraTurma.codigo.toLowerCase() } })
  conferir('aluno entra em outra turma pelo ID', voltar.status === 200, String(voltar.status))
  const inexistente = await chamar('POST', '/rest/v1/rpc/entrar_na_turma', { token: aluno, corpo: { p_codigo: 'NAO-EXISTE-' + sufixo } })
  conferir('ID de turma inexistente é recusado', inexistente.status >= 400, String(inexistente.status))

  // 8.3 Questão nasce oculta; o professor libera e oculta
  const questao = await inserir('atividade', { turma_id: turma.id, tipo: 'questao', titulo: 'Questão de verificação', mostrar_resultado: 'apos_responder' }, admin)
  const questaoId = questao.json?.[0]?.id
  const item = await inserir('atividade_item', { atividade_id: questaoId, ordem: 1, enunciado: 'Quanto é 1 + 1?', tipo_resposta: 'escolha_unica' }, admin)
  await inserir('atividade_opcao', [{ atividade_item_id: item.json?.[0]?.id, ordem: 1, texto: '2', correta: true }, { atividade_item_id: item.json?.[0]?.id, ordem: 2, texto: '3', correta: false }], admin)
  const oculta = await ler('atividade', `select=id&id=eq.${questaoId}`, aluno)
  conferir('questão nova nasce oculta para o aluno', questao.json?.[0]?.status === 'rascunho' && (oculta.json ?? []).length === 0)
  const liberar = await chamar('POST', '/rest/v1/rpc/definir_visibilidade', { token: admin, corpo: { p_ids: [questaoId], p_visivel: true } })
  const visivel = await ler('atividade', `select=id&id=eq.${questaoId}`, aluno)
  conferir('professor libera a questão e o aluno passa a ver', liberar.json?.alteradas === 1 && visivel.json?.length === 1, JSON.stringify(liberar.json))
  const alunoLibera = await chamar('POST', '/rest/v1/rpc/definir_visibilidade', { token: aluno, corpo: { p_ids: [questaoId], p_visivel: false } })
  conferir('aluno não muda a visibilidade', alunoLibera.status >= 400, String(alunoLibera.status))
  await chamar('POST', '/rest/v1/rpc/definir_visibilidade', { token: admin, corpo: { p_ids: [questaoId], p_visivel: false } })
  const ocultaDeNovo = await ler('atividade', `select=id&id=eq.${questaoId}`, aluno)
  conferir('professor oculta de novo', (ocultaDeNovo.json ?? []).length === 0)

  // 8.4 Atividade com entrega de arquivo e e-mail ao professor
  const licao = await inserir('atividade', { turma_id: turma.id, tipo: 'licao', titulo: 'Lição de verificação', aceita_arquivo: true, mostrar_resultado: 'apos_responder' }, admin)
  const licaoId = licao.json?.[0]?.id
  const itemDaLicao = await inserir('atividade_item', { atividade_id: licaoId, ordem: 1, enunciado: 'O que você fez?', tipo_resposta: 'texto_livre' }, admin)
  await chamar('POST', '/rest/v1/rpc/publicar_atividade', { token: admin, corpo: { p_atividade_id: licaoId } })
  const caminho = `entregas/${meuPerfil.id}/verificacao-${sufixo}.zip`
  const envio = await fetch(`${URL_BASE}/storage/v1/object/materiais/${caminho}`, {
    method: 'POST', headers: { apikey: PUBLICA, Authorization: 'Bearer ' + aluno, 'content-type': 'application/zip' }, body: new Uint8Array([80, 75, 5, 6, ...new Array(18).fill(0)]),
  })
  conferir('aluno envia arquivo para a própria pasta', envio.ok, String(envio.status))
  const foraDaPasta = await fetch(`${URL_BASE}/storage/v1/object/materiais/entregas/outra-pessoa/x.zip`, {
    method: 'POST', headers: { apikey: PUBLICA, Authorization: 'Bearer ' + aluno, 'content-type': 'application/zip' }, body: new Uint8Array([1]),
  })
  conferir('aluno não envia arquivo para a pasta de outro', !foraDaPasta.ok, String(foraDaPasta.status))
  const entrega = await chamar('POST', '/rest/v1/rpc/registrar_entrega', { token: aluno, corpo: { p_atividade_id: licaoId, p_arquivo_path: caminho, p_nome_arquivo: 'projeto.zip', p_tamanho_bytes: 22 } })
  conferir('entrega do arquivo é registrada', entrega.status === 200, String(entrega.status))
  const responde = await chamar('POST', '/rest/v1/rpc/responder_atividade', { token: aluno, corpo: { p_atividade_id: licaoId, p_respostas: [{ item_id: itemDaLicao.json?.[0]?.id, texto: 'Resposta de verificação.' }] } })
  conferir('aluno responde a atividade', responde.status < 300, String(responde.status))
  const doProfessor = await ler('atividade_entrega', `select=nome_arquivo&atividade_id=eq.${licaoId}`, admin)
  conferir('professor vê o arquivo entregue', doProfessor.json?.[0]?.nome_arquivo === 'projeto.zip')
  const email = await funcao('notificar-resposta', { atividade_id: licaoId }, aluno)
  conferir(
    'e-mail da resposta ao professor: ' + (email.json?.configurado ? (email.json?.enviado ? 'enviado' : 'não saiu (' + email.json?.motivo + ')') : 'provedor ainda não configurado'),
    email.status === 200 && (email.json?.configurado === false || email.json?.enviado === true),
    String(email.status),
  )
  await fetch(`${URL_BASE}/storage/v1/object/materiais/${caminho}`, { method: 'DELETE', headers: { apikey: PUBLICA, Authorization: 'Bearer ' + admin } })

  // 8.5 Aviso para as duas turmas (um lote) e envio por e-mail
  const lote = crypto.randomUUID()
  const aviso = await inserir('aviso', [turma.id, outraTurma.id].map((turma_id) => ({ turma_id, lote_id: lote, titulo: 'Aviso de verificação', texto: 'Veja https://exemplo.com' })), admin)
  conferir('professor publica aviso para duas turmas', aviso.status === 201 && aviso.json?.length === 2, String(aviso.status))
  const avisoPorEmail = await funcao('enviar-aviso', { lote_id: lote }, admin)
  conferir(
    'aviso por e-mail alcança 1 aluno que consentiu: ' + (avisoPorEmail.json?.configurado ? avisoPorEmail.json?.enviados + ' enviado(s)' : 'provedor ainda não configurado'),
    avisoPorEmail.status === 200 && avisoPorEmail.json?.destinatarios === 1,
    JSON.stringify(avisoPorEmail.json),
  )
  const alunoEnvia = await funcao('enviar-aviso', { lote_id: lote }, aluno)
  conferir('aluno não dispara e-mail de aviso', alunoEnvia.status === 403, String(alunoEnvia.status))

  // 9. Bloqueio
  await chamar('PATCH', `/rest/v1/aluno_autorizado?id=eq.${criados.autorizado}`, { token: admin, corpo: { ativo: false } })
  const bloqueado = await funcao('acesso-aluno', { acao: 'entrar', ...ids, senha: segredoDoAluno })
  conferir('aluno bloqueado não entra e vê o aviso', bloqueado.status === 403 && /temporariamente bloqueada/.test(bloqueado.json?.erro ?? ''), String(bloqueado.status))
  const comSessaoAntiga = await ler('conteudo', 'select=id', aluno)
  conferir('sessão antiga do aluno bloqueado não lê mais nada', (comSessaoAntiga.json ?? []).length === 0)
} catch (falha) {
  conferir('execução completa', false, falha.message)
} finally {
  // 10. Limpeza: remove tudo o que o script criou.
  if (admin) {
    if (criados.autorizado) {
      // Ele ficou em duas turmas: remove os dois vínculos (a conta sai com o último).
      const vinculos = await ler('vw_aluno', `select=aluno_autorizado_id&matricula=eq.${matricula}`, admin)
      for (const v of (vinculos.json ?? []).filter((x) => x.aluno_autorizado_id !== criados.autorizado)) {
        await funcao('admin-alunos', { acao: 'remover', aluno_autorizado_id: v.aluno_autorizado_id }, admin)
      }
      const remover = await funcao('admin-alunos', { acao: 'remover', aluno_autorizado_id: criados.autorizado }, admin)
      conferir('professor remove o aluno (conta, dúvidas e mensagens vão junto)', remover.status === 200, String(remover.status))
      const sobrou = await ler('vw_aluno', `select=matricula&matricula=eq.${matricula}`, admin)
      conferir('nada do aluno de verificação ficou no banco', (sobrou.json ?? []).length === 0)
    }
    if (criados.conteudo) await chamar('DELETE', `/rest/v1/conteudo?id=eq.${criados.conteudo}`, { token: admin })
    // As turmas temporárias levam junto atividades, avisos e o que mais foi criado nelas.
    if (criados.turmas.length > 0) await chamar('DELETE', `/rest/v1/turma?id=in.(${criados.turmas.join(',')})`, { token: admin })
    if (criados.curso) await chamar('DELETE', `/rest/v1/curso?id=eq.${criados.curso}`, { token: admin })
    const sobraram = await ler('turma', `select=id&codigo=like.VERIF-*-${sufixo}`, admin)
    conferir('turmas temporárias apagadas', (sobraram.json ?? []).length === 0)
    await chamar('POST', '/auth/v1/logout', { token: admin })
  }
}

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} verificação(ões) falharam.`)
process.exit(falhas === 0 ? 0 : 1)
