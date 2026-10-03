import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

function variavel(nome: string): string {
  const valor = Deno.env.get(nome)
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`)
  return valor
}

const SEM_SESSAO = { auth: { persistSession: false, autoRefreshToken: false } }

/**
 * Cliente com a service role: ignora a RLS. Só existe dentro das Edge
 * Functions; a chave nunca vai para o frontend nem para o repositório.
 */
export function clienteAdmin(): SupabaseClient {
  return createClient(variavel('SUPABASE_URL'), variavel('SUPABASE_SERVICE_ROLE_KEY'), SEM_SESSAO)
}

/** Cliente anônimo, usado para enviar e verificar o código OTP. */
export function clienteAnonimo(): SupabaseClient {
  return createClient(variavel('SUPABASE_URL'), variavel('SUPABASE_ANON_KEY'), SEM_SESSAO)
}

/** Cliente com o JWT de quem chamou a função (a RLS vale normalmente). */
export function clienteDoUsuario(req: Request): SupabaseClient {
  return createClient(variavel('SUPABASE_URL'), variavel('SUPABASE_ANON_KEY'), {
    ...SEM_SESSAO,
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
}
