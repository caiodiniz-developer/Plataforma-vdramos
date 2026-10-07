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
const criados = { conteudo: null, autorizado: null }
let admin = null

try {
  // 1. Professor entra
  const login = await chamar('POST', '/auth/v1/token?grant_type=password', {
    corpo: { email: adminEmail, password: adminSegredo },
  })
  admin = login.json?.access_token
  conferir('professor entra com e-mail e senha', Boolean(admin), String(login.status))
  if (!admin) throw new Error('sem sessão de admin')

  const turmas = await ler('turma', 'select=id,codigo&status=eq.ativa&order=created_at&limit=1', admin)
  const turma = turmas.json?.[0]
  conferir('existe uma turma ativa', Boolean(turma), turma?.codigo ?? 'nenhuma')
  if (!turma) throw new Error('sem turma ativa')

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

  // 8. Bloqueio
  await chamar('PATCH', `/rest/v1/aluno_autorizado?id=eq.${criados.autorizado}`, { token: admin, corpo: { ativo: false } })
  const bloqueado = await funcao('acesso-aluno', { acao: 'entrar', ...ids, senha: segredoDoAluno })
  conferir('aluno bloqueado não entra e vê o aviso', bloqueado.status === 403 && /temporariamente bloqueada/.test(bloqueado.json?.erro ?? ''), String(bloqueado.status))
  const comSessaoAntiga = await ler('conteudo', 'select=id', aluno)
  conferir('sessão antiga do aluno bloqueado não lê mais nada', (comSessaoAntiga.json ?? []).length === 0)
} catch (falha) {
  conferir('execução completa', false, falha.message)
} finally {
  // 9. Limpeza: remove tudo o que o script criou.
  if (admin) {
    if (criados.autorizado) {
      const remover = await funcao('admin-alunos', { acao: 'remover', aluno_autorizado_id: criados.autorizado }, admin)
      conferir('professor remove o aluno (conta, dúvidas e mensagens vão junto)', remover.status === 200, String(remover.status))
      const sobrou = await ler('vw_aluno', `select=matricula&matricula=eq.${matricula}`, admin)
      conferir('nada do aluno de verificação ficou no banco', (sobrou.json ?? []).length === 0)
    }
    if (criados.conteudo) await chamar('DELETE', `/rest/v1/conteudo?id=eq.${criados.conteudo}`, { token: admin })
    await chamar('POST', '/auth/v1/logout', { token: admin })
  }
}

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} verificação(ões) falharam.`)
process.exit(falhas === 0 ? 0 : 1)
