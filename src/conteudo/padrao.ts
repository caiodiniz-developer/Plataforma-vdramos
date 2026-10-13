import type { PerfilPublico } from '@/dados/landing'
import { PROPOSTA_DE_VALOR, TITULO_DO_PERFIL } from './marca'

/**
 * Conteúdo da landing enquanto `perfil_publico` não é preenchido no admin.
 * O título e a frase são o posicionamento de marca (`./marca.ts`). Os
 * canais de contato ficam vazios de propósito: não se inventa dado de contato.
 */
export const PERFIL_PUBLICO_PADRAO: PerfilPublico = {
  nome_exibicao: 'Vitor Ramos',
  titulo: TITULO_DO_PERFIL,
  bio: PROPOSTA_DE_VALOR,
  foto_path: null,
  email_contato: '',
  telefone: null,
  linkedin_url: '',
  outros_links: [],
  cidade: null,
}
