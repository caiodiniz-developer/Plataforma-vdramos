// Substituto de `npm:@supabase/supabase-js@2` nos testes das Edge Functions.
import { clienteAtual } from './ambiente'

export type SupabaseClient = ReturnType<typeof clienteAtual>

export function createClient(): SupabaseClient {
  return clienteAtual()
}
