import { ErroDeDados, paraErroDeDados, supabase, supabaseConfigurado } from './supabase'

export type Papel = 'admin' | 'aluno'

export type PerfilLogado = { id: string; papel: Papel; nome: string; email: string }

/** Perfil do usuário logado, ou null sem sessão (ou sem perfil). */
export async function buscarPerfilLogado(): Promise<PerfilLogado | null> {
  if (!supabaseConfigurado) return null
  const { data: sessao } = await supabase().auth.getSession()
  const usuario = sessao.session?.user
  if (!usuario) return null

  const { data, error } = await supabase()
    .from('perfil')
    .select('id, papel, nome, email')
    .eq('id', usuario.id)
    .maybeSingle()
  if (error) throw paraErroDeDados(error)
  return data as PerfilLogado | null
}

/** Avisa quando a sessão muda (login, logout, renovação). Devolve o cancelamento. */
export function aoMudarSessao(avisar: () => void): () => void {
  if (!supabaseConfigurado) return () => {}
  const { data } = supabase().auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') avisar()
  })
  return () => data.subscription.unsubscribe()
}

export async function sair(): Promise<void> {
  if (!supabaseConfigurado) return
  await supabase().auth.signOut()
}

/** PRD F14: login do professor com e-mail e senha; exige papel admin. */
export async function entrarComoAdmin(email: string, senha: string): Promise<PerfilLogado> {
  const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: senha })
  if (error) throw new ErroDeDados('E-mail ou senha incorretos.', 'credenciais')

  const perfil = await buscarPerfilLogado()
  if (perfil?.papel !== 'admin') {
    await sair()
    throw new ErroDeDados('E-mail ou senha incorretos.', 'credenciais')
  }
  return perfil
}
