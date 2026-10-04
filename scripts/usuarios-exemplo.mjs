// Cria (ou atualiza) os usuários de exemplo: o admin (professor) e um aluno
// inscrito na turma de exemplo do `supabase/seed.sql`.
//
//   npm run usuarios:exemplo
//
// Lê tudo do `.env` (nunca versionado). A service role só é usada aqui, no
// terminal de quem administra o projeto; ela nunca vai para o frontend.
// O script pode rodar várias vezes: o que já existe é reaproveitado.

import { createClient } from '@supabase/supabase-js'

const TURMA_EXEMPLO = 'EXCIA-CPS-2610'
const MATRICULA_EXEMPLO = 'ALUNO-0001'
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
  senha: exigir('ADMIN_SENHA'),
  nome: process.env.ADMIN_NOME?.trim() || 'Vitor Ramos',
}
const aluno = {
  email: exigir('ALUNO_EMAIL').toLowerCase(),
  nome: process.env.ALUNO_NOME?.trim() || 'Aluno de Exemplo',
}

if (admin.senha.length < 12) {
  console.error('ADMIN_SENHA precisa de ao menos 12 caracteres.')
  process.exit(1)
}

const supabase = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })

async function falhar(etapa, erro) {
  console.error(`Falha ao ${etapa}: ${erro?.message ?? erro}`)
  process.exit(1)
}

async function buscarUsuario(email) {
  for (let pagina = 1; ; pagina += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 200 })
    if (error) await falhar('listar usuários', error)
    const achado = data.users.find((u) => u.email?.toLowerCase() === email)
    if (achado) return achado
    if (data.users.length < 200) return null
  }
}

/** Cria o usuário no Auth ou atualiza o existente. Devolve o id. */
async function garantirUsuario(email, atributos) {
  const existente = await buscarUsuario(email)
  if (existente) {
    const { error } = await supabase.auth.admin.updateUserById(existente.id, atributos)
    if (error) await falhar(`atualizar ${email}`, error)
    return existente.id
  }
  const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true, ...atributos })
  if (error) await falhar(`criar ${email}`, error)
  return data.user.id
}

async function garantirPerfil(id, papel, nome, email) {
  const { error } = await supabase.from('perfil').upsert({ id, papel, nome, email }, { onConflict: 'id' })
  if (error) await falhar(`gravar o perfil de ${email}`, error)
}

// --- Admin ------------------------------------------------------------------
const adminId = await garantirUsuario(admin.email, {
  password: admin.senha,
  user_metadata: { nome: admin.nome },
})
await garantirPerfil(adminId, 'admin', admin.nome, admin.email)
console.log(`Admin pronto: ${admin.email}`)

// --- Aluno de exemplo ---------------------------------------------------------
// Aluno não tem senha: entra com matrícula + código da turma + código por e-mail.
const alunoId = await garantirUsuario(aluno.email, { user_metadata: { nome: aluno.nome } })
await garantirPerfil(alunoId, 'aluno', aluno.nome, aluno.email)

const { data: turma, error: erroTurma } = await supabase
  .from('turma')
  .select('id')
  .eq('codigo', TURMA_EXEMPLO)
  .maybeSingle()
if (erroTurma) await falhar('buscar a turma de exemplo', erroTurma)
if (!turma) {
  console.error(`A turma ${TURMA_EXEMPLO} não existe. Rode o seed (supabase db reset) antes deste script.`)
  process.exit(1)
}

const { data: autorizado, error: erroAutorizado } = await supabase
  .from('aluno_autorizado')
  .upsert({ turma_id: turma.id, matricula: MATRICULA_EXEMPLO, nome_referencia: aluno.nome }, { onConflict: 'turma_id,matricula' })
  .select('id')
  .single()
if (erroAutorizado) await falhar('autorizar a matrícula de exemplo', erroAutorizado)

const { data: inscricao } = await supabase
  .from('inscricao')
  .select('id')
  .eq('aluno_autorizado_id', autorizado.id)
  .maybeSingle()

if (!inscricao) {
  const { error } = await supabase
    .from('inscricao')
    .insert({ aluno_autorizado_id: autorizado.id, turma_id: turma.id, perfil_id: alunoId })
  if (error) await falhar('inscrever o aluno de exemplo', error)

  const base = { perfil_id: alunoId, versao_termo: VERSAO_TERMO, origem: 'cadastro' }
  const { error: erroConsentimento } = await supabase.from('consentimento').insert([
    { ...base, finalidade: 'uso_dados_pedagogicos', concedido: true },
    { ...base, finalidade: 'comunicacao_professor', concedido: false },
  ])
  if (erroConsentimento) await falhar('registrar o consentimento do aluno', erroConsentimento)
}

console.log(`Aluno pronto: ${aluno.email} (matrícula ${MATRICULA_EXEMPLO}, turma ${TURMA_EXEMPLO})`)
