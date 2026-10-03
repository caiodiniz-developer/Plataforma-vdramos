import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Único ponto de criação do cliente Supabase. O restante do app fala com o
 * backend pelos módulos de `src/dados` (gateway), nunca direto com o SDK.
 *
 * As duas variáveis são públicas por desenho: a proteção dos dados é feita
 * pela RLS. A service role nunca entra no frontend.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chaveAnonima = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigurado = Boolean(url && chaveAnonima)

let cliente: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (!supabaseConfigurado) {
    throw new ErroDeDados('O backend ainda não foi configurado neste ambiente.', 'sem_backend')
  }
  cliente ??= createClient(url!, chaveAnonima!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  })
  return cliente
}

/** Erro com mensagem pronta para a tela (pt-BR) e um código para decisões. */
export class ErroDeDados extends Error {
  readonly codigo: string

  constructor(mensagem: string, codigo = 'desconhecido') {
    super(mensagem)
    this.name = 'ErroDeDados'
    this.codigo = codigo
  }
}

const FALHA_GENERICA = 'Não foi possível concluir agora. Tente de novo.'

/** Converte qualquer falha do SDK em `ErroDeDados` sem vazar detalhes técnicos. */
export function paraErroDeDados(erro: unknown, mensagem = FALHA_GENERICA): ErroDeDados {
  if (erro instanceof ErroDeDados) return erro
  const original = erro as { message?: string; code?: string } | null
  // As funções do banco levantam P0001 com texto já escrito para o usuário.
  if (original?.code === 'P0001' || original?.code === '22023' || original?.code === '23505') {
    return new ErroDeDados(original.message ?? mensagem, original.code)
  }
  if (original?.code === '42501') {
    return new ErroDeDados('Você não tem acesso a este conteúdo.', 'sem_acesso')
  }
  return new ErroDeDados(mensagem, original?.code ?? 'desconhecido')
}

/**
 * Chama uma Edge Function e devolve o corpo. Em erro, usa a mensagem que a
 * própria função escreveu (campo `erro`).
 */
export async function chamarFuncao<T>(nome: string, corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().functions.invoke(nome, { body: corpo })
  if (!error) return data as T

  const resposta = (error as { context?: Response }).context
  if (resposta && typeof resposta.json === 'function') {
    try {
      const detalhe = (await resposta.json()) as { erro?: string; codigo?: string }
      if (detalhe.erro) throw new ErroDeDados(detalhe.erro, detalhe.codigo ?? String(resposta.status))
    } catch (falha) {
      if (falha instanceof ErroDeDados) throw falha
    }
  }
  throw new ErroDeDados(FALHA_GENERICA, 'rede')
}
