import type { TipoBloco } from '@/dominio/blocos'
import type { EncontroAgendado } from '@/dominio/calendario'
import type { StatusTurma } from '@/dominio/turma'
import { ErroDeDados, paraErroDeDados, supabase } from './supabase'

export type Capacidade = { id: string; codigo: string; tipo: 'tecnica' | 'socioemocional'; descricao: string }

export type Curso = {
  id: string
  nome: string
  tipo_formacao: string | null
  carga_horaria_h: number
  objetivo: string
  ementa_md: string
  publico_alvo: string | null
  pre_requisitos: string | null
  criterios_avaliacao_md: string | null
  capacidades: Capacidade[]
}

export type Bloco = {
  id: string
  ordem: number
  hora_inicio: string
  duracao_min: number
  tipo: TipoBloco
  titulo: string
  descricao: string | null
}

export type Encontro = EncontroAgendado & {
  blocos: Bloco[]
  sessao: { id: string; status: 'agendada' | 'aberta' | 'encerrada' } | null
}

export type TipoMaterial = 'link' | 'arquivo' | 'video' | 'slides' | 'exercicio' | 'outro'

export type Material = {
  id: string
  encontro_id: string | null
  titulo: string
  tipo: TipoMaterial
  tipo_outro: string | null
  url: string | null
  arquivo_path: string | null
  ordem: number
}

export type Turma = {
  id: string
  codigo: string
  instituicao: string
  cidade: string
  modalidade: 'presencial' | 'online' | 'hibrido'
  data_inicio: string
  data_fim: string
  vagas: number | null
  status: StatusTurma
  fuso: string
  curso: Curso
  encontros: Encontro[]
  materiais: Material[]
}

/** Mensagem de turma inacessível: código errado ou acesso revogado. */
export const SEM_ACESSO_A_TURMA = 'Você não tem acesso a esta turma.'

export type TurmaResumida = { codigo: string; nome_curso: string }

/** Turmas em que o aluno logado está inscrito (para o seletor de turma). */
export async function minhasTurmas(): Promise<TurmaResumida[]> {
  const { data, error } = await supabase().from('turma').select('codigo, curso:curso_id (nome)').order('data_inicio')
  if (error) throw paraErroDeDados(error)
  return (data ?? []).map((t) => {
    const curso = t.curso as { nome: string } | { nome: string }[] | null
    return { codigo: t.codigo, nome_curso: (Array.isArray(curso) ? curso[0]?.nome : curso?.nome) ?? '' }
  })
}

/**
 * Turma completa para a área do aluno (PRD F5, F6 e F7). A RLS decide o que
 * vem: só turmas do aluno e só materiais já liberados. Turma que não vem
 * significa acesso revogado ou código errado — o app trata como sem acesso.
 */
export async function buscarTurma(codigo: string): Promise<Turma> {
  const { data, error } = await supabase()
    .from('turma')
    .select(
      `id, codigo, instituicao, cidade, modalidade, data_inicio, data_fim, vagas, status, fuso,
       curso:curso_id (
         id, nome, tipo_formacao, carga_horaria_h, objetivo, ementa_md, publico_alvo, pre_requisitos,
         criterios_avaliacao_md,
         capacidades:capacidade (id, codigo, tipo, descricao)
       ),
       encontros:encontro (
         id, numero, data, hora_inicio, hora_fim, titulo, descricao, local,
         blocos:bloco_encontro (id, ordem, hora_inicio, duracao_min, tipo, titulo, descricao),
         sessao:sessao_ao_vivo (id, status)
       ),
       materiais:material (id, encontro_id, titulo, tipo, tipo_outro, url, arquivo_path, ordem)`,
    )
    .eq('codigo', codigo.toUpperCase())
    .maybeSingle()
  if (error) throw paraErroDeDados(error)
  if (!data) throw new ErroDeDados(SEM_ACESSO_A_TURMA, 'sem_acesso')

  const bruta = data as unknown as Omit<Turma, 'encontros'> & {
    encontros: (Omit<Encontro, 'sessao'> & { sessao: Encontro['sessao'] | Encontro['sessao'][] })[]
  }

  return {
    ...bruta,
    curso: {
      ...bruta.curso,
      capacidades: [...bruta.curso.capacidades].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true })),
    },
    encontros: bruta.encontros
      .map((e) => ({
        ...e,
        blocos: [...e.blocos].sort((a, b) => a.ordem - b.ordem),
        // A relação 1—1 pode vir como objeto ou como lista de um elemento.
        sessao: Array.isArray(e.sessao) ? (e.sessao[0] ?? null) : e.sessao,
      }))
      .sort((a, b) => a.numero - b.numero),
    materiais: [...bruta.materiais].sort((a, b) => a.ordem - b.ordem),
  }
}

/** PRD F7: URL assinada do arquivo, válida por 10 min. Gera outra a cada clique. */
export async function urlDoArquivo(arquivoPath: string): Promise<string> {
  const { data, error } = await supabase().storage.from('materiais').createSignedUrl(arquivoPath, 600)
  if (error || !data) throw new ErroDeDados('Não foi possível abrir o arquivo. Tente de novo.', 'arquivo')
  return data.signedUrl
}
