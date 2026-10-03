import { PERFIL_PUBLICO_PADRAO } from '@/conteudo/padrao'
import type { FormularioContato } from '@/dominio/contato'
import type { Experiencia } from '@/dominio/experiencia'
import { chamarFuncao, paraErroDeDados, supabase, supabaseConfigurado } from './supabase'

export type LinkExterno = { rotulo: string; url: string }

export type PerfilPublico = {
  nome_exibicao: string
  titulo: string
  bio: string
  foto_path: string | null
  email_contato: string
  telefone: string | null
  linkedin_url: string
  outros_links: LinkExterno[]
  cidade: string | null
}

export type DadosDaLanding = {
  perfil: PerfilPublico
  experiencias: Experiencia[]
}

/**
 * PRD F1: perfil público e experiências publicadas. Sem backend configurado
 * (ou antes de o professor preencher o perfil), a landing usa o conteúdo
 * padrão do guia de marca, para nunca ficar em branco.
 */
export async function buscarLanding(): Promise<DadosDaLanding> {
  if (!supabaseConfigurado) return { perfil: PERFIL_PUBLICO_PADRAO, experiencias: [] }

  const [perfil, experiencias] = await Promise.all([
    supabase().from('perfil_publico').select('*').maybeSingle(),
    supabase()
      .from('experiencia')
      .select('*')
      .eq('publicado', true)
      .order('ordem')
      .order('data_inicio', { ascending: false }),
  ])
  if (perfil.error) throw paraErroDeDados(perfil.error)
  if (experiencias.error) throw paraErroDeDados(experiencias.error)

  return {
    perfil: (perfil.data as PerfilPublico | null) ?? PERFIL_PUBLICO_PADRAO,
    experiencias: (experiencias.data ?? []) as Experiencia[],
  }
}

export function urlDaFoto(fotoPath: string | null): string | null {
  if (!fotoPath || !supabaseConfigurado) return null
  return supabase().storage.from('publico').getPublicUrl(fotoPath).data.publicUrl
}

/** PRD F2: o envio passa pela Edge Function `contato` (limite por IP). */
export async function enviarContato(formulario: FormularioContato): Promise<void> {
  await chamarFuncao('contato', {
    nome: formulario.nome.trim(),
    email: formulario.email.trim(),
    assunto: formulario.assunto,
    assunto_outro: formulario.assunto === 'outro' ? formulario.assunto_outro.trim() : null,
    mensagem: formulario.mensagem.trim(),
    aceitou_privacidade: formulario.aceitou_privacidade,
  })
}
