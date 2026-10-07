import { vi } from 'vitest'
import { BancoFalso, criarClienteFalso } from './supabase-falso'

type Tratador = (req: Request) => Promise<Response>

// Guardado no escopo global porque `vi.resetModules()` recria este módulo
// a cada função carregada, e o SDK falso precisa enxergar o mesmo banco.
const estado = globalThis as typeof globalThis & { __bancoFalso?: BancoFalso }

// O alias de `npm:@supabase/supabase-js@2` (vitest.config.ts) aponta para o
// módulo `sdk.ts`, que entrega este cliente a qualquer `createClient`.
export function clienteAtual() {
  return criarClienteFalso(estado.__bancoFalso!)
}

/**
 * Carrega uma Edge Function de verdade (`supabase/functions/<nome>/index.ts`)
 * com `Deno` simulado e devolve o tratador que ela registrou em `Deno.serve`.
 */
export async function carregarFuncao(nome: 'acesso-aluno' | 'admin-alunos' | 'contato' | 'excluir-conta', env: Record<string, string> = {}) {
  const banco = (estado.__bancoFalso = new BancoFalso())
  let tratador: Tratador | undefined
  const variaveis: Record<string, string> = {
    SUPABASE_URL: 'http://supabase.teste',
    SUPABASE_ANON_KEY: 'chave-anonima-de-teste',
    SUPABASE_SERVICE_ROLE_KEY: 'chave-de-servico-de-teste',
    ...env,
  }
  vi.stubGlobal('Deno', {
    env: { get: (chave: string) => variaveis[chave] },
    serve: (t: Tratador) => {
      tratador = t
    },
  })
  vi.resetModules()
  await import(`../../functions/${nome}/index.ts`)
  if (!tratador) throw new Error(`A função ${nome} não chamou Deno.serve`)

  const chamar = async (corpo: unknown, opcoes: { ip?: string; metodo?: string; autorizacao?: string } = {}) => {
    const resposta = await tratador!(
      new Request(`http://funcoes.teste/${nome}`, {
        method: opcoes.metodo ?? 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': opcoes.ip ?? '203.0.113.7',
          origin: 'http://localhost:5173',
          ...(opcoes.autorizacao ? { authorization: opcoes.autorizacao } : {}),
        },
        body: opcoes.metodo === 'OPTIONS' || opcoes.metodo === 'GET' ? undefined : JSON.stringify(corpo),
      }),
    )
    const texto = await resposta.text()
    let json: Record<string, unknown> = {}
    try {
      json = JSON.parse(texto)
    } catch {
      // resposta sem JSON (ex.: preflight)
    }
    return { status: resposta.status, corpo: json, texto, cabecalhos: resposta.headers }
  }

  return { banco, chamar }
}

/** Turma ativa com dois IDs autorizados (um deles inativo) e uma turma planejada. */
export function semearTurma(banco: BancoFalso) {
  const turma = banco.inserir('turma', { codigo: 'EXCIA-CPS-2610', status: 'ativa' })
  const planejada = banco.inserir('turma', { codigo: 'FUTURA-2701', status: 'planejada' })
  const a1 = banco.inserir('aluno_autorizado', { turma_id: turma.id, matricula: 'ALUNO-0001', ativo: true })
  const a2 = banco.inserir('aluno_autorizado', { turma_id: turma.id, matricula: 'ALUNO-0002', ativo: true })
  const inativo = banco.inserir('aluno_autorizado', { turma_id: turma.id, matricula: 'ALUNO-0009', ativo: false })
  banco.inserir('aluno_autorizado', { turma_id: planejada.id, matricula: 'ALUNO-0001', ativo: true })
  return { turma, planejada, a1, a2, inativo }
}

/** Senha usada pelas contas criadas nos testes (valor de mentira). */
export const SENHA_DE_TESTE = 'Aluno' + '@' + '123'

/** Cria a conta (com senha) de um ID autorizado e o inscreve na turma. */
export function inscrever(banco: BancoFalso, autorizado: Record<string, unknown>, email: string, nome = 'Ana Souza') {
  const id = banco.idDoUsuario(email)
  banco.senhas.set(email, SENHA_DE_TESTE)
  if (!banco.linhas('perfil').some((p) => p.id === id)) banco.inserir('perfil', { id, nome, email, papel: 'aluno' })
  return banco.inserir('inscricao', {
    aluno_autorizado_id: autorizado.id,
    turma_id: autorizado.turma_id,
    perfil_id: id,
    ultimo_acesso_em: null,
  })
}
