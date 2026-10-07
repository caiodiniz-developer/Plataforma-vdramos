import type { AlunoDoProfessor } from '@/dados/professor'

/** Rótulo e cor do status do aluno, iguais na tabela e no perfil. */
export const ROTULO_SITUACAO: Record<AlunoDoProfessor['situacao'], string> = {
  ativo: 'Ativo',
  bloqueado: 'Bloqueado',
  sem_conta: 'Sem conta',
}

export const VARIANTE_SITUACAO: Record<AlunoDoProfessor['situacao'], 'green' | 'orange' | 'neutro'> = {
  ativo: 'green',
  bloqueado: 'orange',
  sem_conta: 'neutro',
}
