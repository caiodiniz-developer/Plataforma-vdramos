import type { PerfilPublico } from '@/dados/landing'

/**
 * Conteúdo da landing enquanto `perfil_publico` não é preenchido no admin.
 * O texto vem do Brand Style Guide (frase de apresentação e eyebrow). Os
 * canais de contato ficam vazios de propósito: não se inventa dado de contato.
 */
export const PERFIL_PUBLICO_PADRAO: PerfilPublico = {
  nome_exibicao: 'Vitor Ramos',
  titulo: 'Dados · IA · Educação',
  bio: 'Construindo produtos e educação em dados e inteligência artificial — do modelo ao letramento, com rigor técnico e clareza didática.',
  foto_path: null,
  email_contato: '',
  telefone: null,
  linkedin_url: '',
  outros_links: [],
  cidade: null,
}
