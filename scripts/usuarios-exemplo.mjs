// Cria (ou atualiza) o admin e os dados de demonstração no projeto do `.env`:
// a turma TURMA-001, o aluno de demonstração e alguns conteúdos para testar.
//
//   npm run usuarios:exemplo
//
// Lê tudo do `.env` (nunca versionado); as senhas não ficam neste arquivo.
// A service role só é usada aqui, no terminal de quem administra o projeto.
// Pode rodar várias vezes: o que já existe é reaproveitado.

import { createClient } from '@supabase/supabase-js'

const TURMA_DEMO = 'TURMA-001'
const ID_DEMO = 'ALUNO-001'
const VERSAO_TERMO = process.env.VERSAO_TERMO || '2026-10-v1'

function exigir(nome, ...alternativas) {
  for (const chave of [nome, ...alternativas]) {
    const valor = process.env[chave]?.trim()
    if (valor) return valor
  }
  console.error(`Falta a variável ${nome} no .env (veja o .env.example).`)
  process.exit(1)
}

const url = exigir('SUPABASE_URL', 'VITE_SUPABASE_URL')
const serviceRole = exigir('SUPABASE_SERVICE_ROLE_KEY')
const admin = {
  email: exigir('ADMIN_EMAIL').toLowerCase(),
  segredo: exigir('ADMIN_SENHA'),
  nome: process.env.ADMIN_NOME?.trim() || 'Vitor Ramos',
}
const aluno = {
  segredo: exigir('ALUNO_SENHA'),
  nome: process.env.ALUNO_NOME?.trim() || 'Aluno Demonstração',
}

if (admin.segredo.length < 12) {
  console.error('ADMIN_SENHA precisa de ao menos 12 caracteres.')
  process.exit(1)
}

const supabase = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })

function falhar(etapa, erro) {
  console.error(`Falha ao ${etapa}: ${erro?.message ?? erro}`)
  process.exit(1)
}

/** Executa a consulta e devolve os dados, encerrando o script em caso de erro. */
async function ok(etapa, consulta) {
  const { data, error } = await consulta
  if (error) falhar(etapa, error)
  return data
}

async function buscarUsuario(email) {
  for (let pagina = 1; ; pagina += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 200 })
    if (error) falhar('listar usuários', error)
    const achado = data.users.find((u) => u.email?.toLowerCase() === email)
    if (achado) return achado
    if (data.users.length < 200) return null
  }
}

/** Cria o usuário no Auth ou atualiza a senha do existente. Devolve o id. */
async function garantirUsuario(email, segredo, nome) {
  const atributos = { password: segredo, user_metadata: { nome } }
  const existente = await buscarUsuario(email)
  if (existente) {
    const { error } = await supabase.auth.admin.updateUserById(existente.id, atributos)
    if (error) falhar(`atualizar ${email}`, error)
    return existente.id
  }
  const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true, ...atributos })
  if (error) falhar(`criar ${email}`, error)
  return data.user.id
}

// --- Admin ------------------------------------------------------------------
const adminId = await garantirUsuario(admin.email, admin.segredo, admin.nome)
await ok('gravar o perfil do admin', supabase.from('perfil').upsert({ id: adminId, papel: 'admin', nome: admin.nome, email: admin.email }, { onConflict: 'id' }))
console.log(`Admin pronto: ${admin.email}`)

// --- Turma de demonstração ----------------------------------------------------
let turma = await ok('buscar a turma', supabase.from('turma').select('id').eq('codigo', TURMA_DEMO).maybeSingle())
if (!turma) {
  const curso = await ok(
    'criar o curso',
    supabase
      .from('curso')
      .insert({
        nome: 'Desenvolvimento Web (demonstração)',
        tipo_formacao: 'Curso técnico',
        carga_horaria_h: 40,
        objetivo: 'Turma de demonstração da plataforma de apoio, com conteúdos, questões e atividades de exemplo.',
        ementa_md: '- HTML e estrutura de páginas\n- CSS e estilo\n- Introdução ao JavaScript',
      })
      .select('id')
      .single(),
  )
  const hoje = new Date()
  const fim = new Date(hoje.getTime() + 120 * 86_400_000)
  turma = await ok(
    'criar a turma',
    supabase
      .from('turma')
      .insert({
        curso_id: curso.id,
        codigo: TURMA_DEMO,
        instituicao: 'SENAI',
        cidade: 'Campinas',
        modalidade: 'presencial',
        data_inicio: hoje.toISOString().slice(0, 10),
        data_fim: fim.toISOString().slice(0, 10),
        vagas: 30,
        status: 'ativa',
      })
      .select('id')
      .single(),
  )
}
console.log(`Turma pronta: ${TURMA_DEMO}`)

// --- Aluno de demonstração (ID + turma + senha) --------------------------------
const autorizado = await ok(
  'autorizar o ID de demonstração',
  supabase
    .from('aluno_autorizado')
    .upsert({ turma_id: turma.id, matricula: ID_DEMO, nome_referencia: aluno.nome, ativo: true }, { onConflict: 'turma_id,matricula' })
    .select('id')
    .single(),
)
// Mesmo formato de `supabase/functions/_shared/alunos.ts`.
const emailInterno = `aluno-${autorizado.id}@alunos.vitorramos.invalid`
const alunoId = await garantirUsuario(emailInterno, aluno.segredo, aluno.nome)
await ok('gravar o perfil do aluno', supabase.from('perfil').upsert({ id: alunoId, papel: 'aluno', nome: aluno.nome, email: emailInterno }, { onConflict: 'id' }))

const inscricao = await ok('buscar a inscrição', supabase.from('inscricao').select('id').eq('aluno_autorizado_id', autorizado.id).maybeSingle())
if (!inscricao) {
  await ok('inscrever o aluno', supabase.from('inscricao').insert({ aluno_autorizado_id: autorizado.id, turma_id: turma.id, perfil_id: alunoId }))
  await ok(
    'registrar o aceite do termo',
    supabase.from('consentimento').insert({ perfil_id: alunoId, finalidade: 'uso_dados_pedagogicos', concedido: true, versao_termo: VERSAO_TERMO, origem: 'cadastro' }),
  )
}
// Dois IDs livres, para testar a criação de conta pela tela.
await ok(
  'autorizar IDs livres',
  supabase.from('aluno_autorizado').upsert(
    [
      { turma_id: turma.id, matricula: 'ALUNO-002', nome_referencia: null },
      { turma_id: turma.id, matricula: 'ALUNO-003', nome_referencia: null },
    ],
    { onConflict: 'turma_id,matricula', ignoreDuplicates: true },
  ),
)
console.log(`Aluno pronto: ${aluno.nome} (ID ${ID_DEMO}, turma ${TURMA_DEMO})`)

// --- Conteúdos de demonstração (só na primeira vez) ---------------------------
const jaTem = await ok('conferir conteúdos', supabase.from('conteudo').select('id').eq('turma_id', turma.id).limit(1))
if (jaTem.length > 0) {
  console.log('Conteúdos de demonstração já existem; nada foi duplicado.')
  process.exit(0)
}

const conteudos = await ok(
  'criar as aulas extras',
  supabase
    .from('conteudo')
    .insert([
      {
        turma_id: turma.id,
        tipo: 'aula_extra',
        titulo: 'Introdução ao Desenvolvimento Web',
        descricao: 'Material complementar da aula presencial.',
        corpo_md:
          '## O que você vai rever\n\n- Como o navegador pede e recebe uma página\n- O papel de HTML, CSS e JavaScript\n- Como abrir as ferramentas do desenvolvedor\n\n## Para praticar\n\nAbra um site que você usa todo dia, inspecione um título e troque o texto dele pelo painel de elementos.',
        publicado: true,
      },
      {
        turma_id: turma.id,
        tipo: 'aula_extra',
        titulo: 'Primeiros passos com JavaScript',
        descricao: 'Revisão de variáveis, tipos e funções vistas em sala.',
        corpo_md:
          '## Variáveis\n\nUse `const` por padrão e `let` quando o valor precisar mudar.\n\n## Funções\n\nUma função recebe valores, faz um trabalho e devolve um resultado.\n\n```js\nfunction dobro(numero) {\n  return numero * 2\n}\n```',
        publicado: true,
      },
      {
        turma_id: turma.id,
        tipo: 'link',
        titulo: 'Documentação de HTML (MDN)',
        descricao: 'Referência para consultar as tags vistas em aula.',
        link_url: 'https://developer.mozilla.org/pt-BR/docs/Web/HTML',
        publicado: true,
      },
    ])
    .select('id, titulo'),
)
const aulaWeb = conteudos.find((c) => c.titulo === 'Introdução ao Desenvolvimento Web')

/** Cria uma atividade publicada com os seus itens e opções. */
async function criarAtividade(dados, itens) {
  const atividade = await ok(
    `criar "${dados.titulo}"`,
    supabase
      .from('atividade')
      .insert({ turma_id: turma.id, status: 'publicada', publicada_em: new Date().toISOString(), ...dados })
      .select('id')
      .single(),
  )
  for (const [indice, item] of itens.entries()) {
    const { opcoes = [], ...campos } = item
    const criado = await ok(
      'criar item',
      supabase.from('atividade_item').insert({ atividade_id: atividade.id, ordem: indice + 1, ...campos }).select('id').single(),
    )
    if (opcoes.length > 0) {
      await ok(
        'criar opções',
        supabase.from('atividade_opcao').insert(opcoes.map(([texto, correta], i) => ({ atividade_item_id: criado.id, ordem: i + 1, texto, correta }))),
      )
    }
  }
}

const questao = (titulo, categoria, dificuldade, opcoes, explicacao, conteudoId = null) =>
  criarAtividade(
    { tipo: 'questao', titulo, categoria, dificuldade, mostrar_resultado: 'apos_responder', conteudo_id: conteudoId },
    [{ enunciado: titulo, tipo_resposta: 'escolha_unica', explicacao, opcoes }],
  )

await questao(
  'O que é HTML?',
  'Web',
  'facil',
  [['Linguagem de programação', false], ['Linguagem de marcação', true], ['Banco de dados', false], ['Sistema operacional', false]],
  'HTML é uma linguagem de marcação: descreve a estrutura da página, não executa lógica.',
  aulaWeb?.id ?? null,
)
await questao(
  'Qual propriedade de CSS muda a cor do texto?',
  'Web',
  'facil',
  [['background', false], ['font-style', false], ['color', true], ['text-align', false]],
  'A propriedade `color` define a cor do texto; `background` muda o fundo.',
)
await questao(
  'Qual palavra declara uma variável que não pode ser reatribuída em JavaScript?',
  'JavaScript',
  'medio',
  [['var', false], ['let', false], ['const', true], ['static', false]],
  '`const` impede a reatribuição. O conteúdo de um objeto ou lista declarado com `const` ainda pode mudar.',
)

await criarAtividade(
  {
    tipo: 'licao',
    titulo: 'Atividade — Introdução ao JavaScript',
    descricao: 'Fixação do que foi visto na aula sobre variáveis e funções.',
    instrucoes_md: 'Responda com as suas palavras. Não precisa copiar a definição do material.',
    prazo_em: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    mostrar_resultado: 'apos_responder',
  },
  [
    { enunciado: 'Explique a diferença entre `let` e `const`.', tipo_resposta: 'texto_livre' },
    {
      enunciado: 'O que a função abaixo devolve para `dobro(4)`? `function dobro(n) { return n * 2 }`',
      tipo_resposta: 'escolha_unica',
      explicacao: '4 × 2 = 8.',
      opcoes: [['4', false], ['6', false], ['8', true], ['42', false]],
    },
  ],
)
await criarAtividade(
  {
    tipo: 'licao',
    titulo: 'Atividade — Estrutura de uma página HTML',
    descricao: 'Monte mentalmente uma página simples e descreva as partes.',
    instrucoes_md: 'Use o material da aula extra "Introdução ao Desenvolvimento Web" como apoio.',
    mostrar_resultado: 'apos_responder',
    conteudo_id: aulaWeb?.id ?? null,
  },
  [
    { enunciado: 'Para que servem as tags `<head>` e `<body>`?', tipo_resposta: 'texto_livre' },
    { enunciado: 'Cite três tags que você usaria numa página de apresentação pessoal.', tipo_resposta: 'texto_livre' },
  ],
)

await ok(
  'criar os avisos',
  supabase.from('aviso').insert([
    { turma_id: turma.id, titulo: 'Revisão para a próxima aula', texto: 'Pessoal, não esqueçam de revisar o conteúdo de HTML para a próxima aula.' },
    { turma_id: null, titulo: 'Boas-vindas', texto: 'Esta é a plataforma de apoio das aulas. Use a área de dúvidas sempre que precisar.' },
  ]),
)

console.log('Conteúdos de demonstração criados: 2 aulas extras, 1 link, 3 questões, 2 atividades e 2 avisos.')
