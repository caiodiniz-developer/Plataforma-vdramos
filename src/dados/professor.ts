import type { TipoAtividade, TipoResposta } from '@/dominio/atividade'
import type { Aviso, Conteudo, MensagemPrivada, TipoConteudo, TipoFeedback } from './apoio'
import { chamarFuncao, ErroDeDados, paraErroDeDados, supabase } from './supabase'

/**
 * Gateway do painel do professor na plataforma de apoio. Tudo aqui depende do
 * papel admin: a RLS e as Edge Functions recusam qualquer outro usuário.
 */

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

export type ResumoDaPlataforma = {
  alunos: { total: number; ativos: number; bloqueados: number; semConta: number; novos: number }
  conteudo: { aulas: number; atividades: number; questoes: number; materiais: number }
  interacoes: { duvidasPendentes: number; feedbacksNaoLidos: number; atividadesEnviadas: number; mensagensNaoLidas: number }
  contatosNaoLidos: number
}

export type EventoRecente = { quando: string; tipo: string; aluno: string; descricao: string }

async function contar(tabela: string, filtrar?: (c: ReturnType<typeof consultaDeContagem>) => unknown): Promise<number> {
  let consulta = consultaDeContagem(tabela)
  if (filtrar) consulta = filtrar(consulta) as typeof consulta
  const { count, error } = await consulta
  if (error) throw paraErroDeDados(error)
  return count ?? 0
}
function consultaDeContagem(tabela: string) {
  return supabase().from(tabela).select('*', { count: 'exact', head: true })
}

export async function buscarResumoDaPlataforma(): Promise<{ resumo: ResumoDaPlataforma; recentes: EventoRecente[] }> {
  const seteDiasAtras = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const [alunos, aulas, materiais, atividades, questoes, duvidas, feedbacks, mensagens, contatos, respostas, recentes] =
    await Promise.all([
      supabase().from('vw_aluno').select('situacao, cadastrado_em'),
      contar('conteudo', (c) => c.in('tipo', ['aula', 'aula_extra'])),
      contar('conteudo', (c) => c.not('tipo', 'in', '(aula,aula_extra)')),
      contar('atividade', (c) => c.in('tipo', ['licao', 'quiz'])),
      contar('atividade', (c) => c.eq('tipo', 'questao')),
      contar('duvida', (c) => c.eq('status', 'aberta')),
      contar('feedback', (c) => c.eq('lido', false)),
      contar('mensagem_privada', (c) => c.eq('autor', 'aluno').is('lida_em', null)),
      contar('contato_mensagem', (c) => c.eq('lida', false)),
      supabase().from('vw_atividade_recente').select('quando', { count: 'exact', head: true }).eq('tipo', 'atividade'),
      supabase().from('vw_atividade_recente').select('quando, tipo, aluno, descricao').order('quando', { ascending: false }).limit(12),
    ])
  if (alunos.error) throw paraErroDeDados(alunos.error)
  if (respostas.error) throw paraErroDeDados(respostas.error)
  if (recentes.error) throw paraErroDeDados(recentes.error)

  const lista = (alunos.data ?? []) as { situacao: string; cadastrado_em: string | null }[]
  return {
    resumo: {
      alunos: {
        total: lista.length,
        ativos: lista.filter((a) => a.situacao === 'ativo').length,
        bloqueados: lista.filter((a) => a.situacao === 'bloqueado').length,
        semConta: lista.filter((a) => a.situacao === 'sem_conta').length,
        novos: lista.filter((a) => a.cadastrado_em !== null && a.cadastrado_em > seteDiasAtras).length,
      },
      conteudo: { aulas, atividades, questoes, materiais },
      interacoes: {
        duvidasPendentes: duvidas,
        feedbacksNaoLidos: feedbacks,
        atividadesEnviadas: respostas.count ?? 0,
        mensagensNaoLidas: mensagens,
      },
      contatosNaoLidos: contatos,
    },
    recentes: (recentes.data ?? []) as EventoRecente[],
  }
}

// ---------------------------------------------------------------------------
// Turmas
// ---------------------------------------------------------------------------

export type TurmaDoProfessor = {
  id: string
  codigo: string
  curso_id: string
  curso_nome: string
  instituicao: string
  cidade: string
  modalidade: 'presencial' | 'online' | 'hibrido'
  data_inicio: string
  data_fim: string
  vagas: number | null
  status: 'planejada' | 'ativa' | 'encerrada'
  autorizados: number
  inscritos: number
}

export async function listarTurmas(): Promise<TurmaDoProfessor[]> {
  const { data, error } = await supabase()
    .from('vw_turma_resumo')
    .select('id, codigo, curso_id, curso_nome, instituicao, cidade, modalidade, data_inicio, data_fim, vagas, status, autorizados, inscritos')
    .order('data_inicio', { ascending: false })
  if (error) throw paraErroDeDados(error)
  return (data ?? []) as TurmaDoProfessor[]
}

export type DadosDaTurma = {
  codigo: string
  curso_nome: string
  instituicao: string
  cidade: string
  modalidade: TurmaDoProfessor['modalidade']
  data_inicio: string
  data_fim: string
  vagas: number | null
  status: TurmaDoProfessor['status']
}

/** Cria ou atualiza a turma. O curso é reaproveitado pelo nome; se não existir, é criado. */
export async function salvarTurma(dados: DadosDaTurma, turma?: TurmaDoProfessor): Promise<void> {
  const db = supabase()
  const nomeDoCurso = dados.curso_nome.trim()
  let cursoId = turma?.curso_id

  if (!turma || turma.curso_nome !== nomeDoCurso) {
    const { data: existente, error: erroBusca } = await db.from('curso').select('id').eq('nome', nomeDoCurso).limit(1).maybeSingle()
    if (erroBusca) throw paraErroDeDados(erroBusca)
    if (existente) {
      cursoId = existente.id
    } else {
      const { data: novo, error: erroCurso } = await db
        .from('curso')
        .insert({ nome: nomeDoCurso, carga_horaria_h: 1, objetivo: nomeDoCurso, ementa_md: '' })
        .select('id')
        .single()
      if (erroCurso) throw paraErroDeDados(erroCurso)
      cursoId = novo.id
    }
  }

  const campos = {
    curso_id: cursoId,
    codigo: dados.codigo.trim().toUpperCase(),
    instituicao: dados.instituicao.trim(),
    cidade: dados.cidade.trim(),
    modalidade: dados.modalidade,
    data_inicio: dados.data_inicio,
    data_fim: dados.data_fim,
    vagas: dados.vagas,
    status: dados.status,
  }
  const { error } = turma ? await db.from('turma').update(campos).eq('id', turma.id) : await db.from('turma').insert(campos)
  if (error) {
    if (error.code === '23505') throw new ErroDeDados('Já existe uma turma com este ID.', 'ja_existe')
    if (error.code === '23514') throw new ErroDeDados('Confira o ID da turma (letras maiúsculas, números e hífen, de 4 a 20) e as datas.', 'validacao')
    throw paraErroDeDados(error)
  }
}

// ---------------------------------------------------------------------------
// Alunos
// ---------------------------------------------------------------------------

export type AlunoDoProfessor = {
  aluno_autorizado_id: string
  turma_id: string
  turma_codigo: string
  matricula: string
  ativo: boolean
  nome: string | null
  inscricao_id: string | null
  perfil_id: string | null
  cadastrado_em: string | null
  ultimo_acesso_em: string | null
  situacao: 'ativo' | 'bloqueado' | 'sem_conta'
  conteudos_acessados: number
  atividades_realizadas: number
  questoes_respondidas: number
  questoes_corretas: number
  duvidas: number
  feedbacks: number
  /** E-mail que o aluno informou, se informou. */
  email_contato: string | null
  /** Consentimento de comunicações vigente. */
  aceita_comunicacao: boolean
}

export async function listarAlunos(): Promise<AlunoDoProfessor[]> {
  const { data, error } = await supabase().from('vw_aluno').select('*').order('turma_codigo').order('matricula')
  if (error) throw paraErroDeDados(error)
  return (data ?? []) as AlunoDoProfessor[]
}

export async function criarAluno(dados: { turmaId: string; matricula: string; nome: string; senha: string }): Promise<void> {
  await chamarFuncao('admin-alunos', {
    acao: 'criar',
    turma_id: dados.turmaId,
    matricula: dados.matricula,
    nome: dados.nome,
    senha: dados.senha,
  })
}

export async function redefinirSenha(alunoAutorizadoId: string, senha: string): Promise<void> {
  await chamarFuncao('admin-alunos', { acao: 'redefinir_senha', aluno_autorizado_id: alunoAutorizadoId, senha })
}

export async function removerAluno(alunoAutorizadoId: string): Promise<void> {
  await chamarFuncao('admin-alunos', { acao: 'remover', aluno_autorizado_id: alunoAutorizadoId })
}

/**
 * Coloca o aluno em mais uma turma. Com conta, é a mesma conta nas duas: ele
 * entra com a mesma senha e troca de turma no menu.
 */
export async function matricularEmTurma(alunoAutorizadoId: string, turmaId: string): Promise<void> {
  const { error } = await supabase().rpc('matricular_em_turma', { p_aluno_autorizado_id: alunoAutorizadoId, p_turma_id: turmaId })
  if (error) throw paraErroDeDados(error)
}

/** Bloquear corta o acesso na hora (a RLS deixa de devolver dados ao aluno). */
export async function definirBloqueio(alunoAutorizadoId: string, bloqueado: boolean): Promise<void> {
  const { error } = await supabase().from('aluno_autorizado').update({ ativo: !bloqueado }).eq('id', alunoAutorizadoId)
  if (error) throw paraErroDeDados(error)
}

export async function editarAluno(aluno: AlunoDoProfessor, dados: { nome: string; matricula: string }): Promise<void> {
  const db = supabase()
  const { error } = await db
    .from('aluno_autorizado')
    .update({ matricula: dados.matricula.trim().toUpperCase(), nome_referencia: dados.nome.trim() })
    .eq('id', aluno.aluno_autorizado_id)
  if (error) {
    if (error.code === '23505') throw new ErroDeDados('Já existe um aluno com este ID nesta turma.', 'ja_existe')
    throw paraErroDeDados(error)
  }
  if (aluno.perfil_id) {
    const { error: erroPerfil } = await db.from('perfil').update({ nome: dados.nome.trim() }).eq('id', aluno.perfil_id)
    if (erroPerfil) throw paraErroDeDados(erroPerfil)
  }
}

export type PerfilDoAluno = {
  duvidas: DuvidaDoProfessor[]
  feedbacks: FeedbackDoProfessor[]
  respostas: { atividade: string; atividade_tipo: string; item: number; enunciado: string; opcoes: string | null; texto: string | null; correta: boolean | null; created_at: string }[]
  acessos: { titulo: string; ultimo_em: string }[]
}

/** Tudo o que o professor acompanha de um aluno. */
export async function buscarPerfilDoAluno(inscricaoId: string): Promise<PerfilDoAluno> {
  const db = supabase()
  const [duvidas, feedbacks, respostas, acessos] = await Promise.all([
    db.from('duvida').select(CAMPOS_DUVIDA).eq('inscricao_id', inscricaoId).order('created_at', { ascending: false }),
    db.from('feedback').select(CAMPOS_FEEDBACK).eq('inscricao_id', inscricaoId).order('created_at', { ascending: false }),
    db
      .from('atividade_resposta')
      .select('texto, correta, created_at, opcao_ids, item:atividade_item_id (ordem, enunciado, atividade:atividade_id (titulo, tipo), opcoes:atividade_opcao (id, texto))')
      .eq('inscricao_id', inscricaoId)
      .order('created_at', { ascending: false }),
    db.from('conteudo_acesso').select('ultimo_em, conteudo:conteudo_id (titulo)').eq('inscricao_id', inscricaoId).order('ultimo_em', { ascending: false }),
  ])
  for (const r of [duvidas, feedbacks, respostas, acessos]) if (r.error) throw paraErroDeDados(r.error)

  type RespostaBruta = {
    texto: string | null
    correta: boolean | null
    created_at: string
    opcao_ids: string[] | null
    item: { ordem: number; enunciado: string; atividade: { titulo: string; tipo: string }; opcoes: { id: string; texto: string }[] }
  }
  return {
    duvidas: paraDuvidas(duvidas.data ?? []),
    feedbacks: paraFeedbacks(feedbacks.data ?? []),
    respostas: ((respostas.data ?? []) as unknown as RespostaBruta[]).map((r) => ({
      atividade: r.item.atividade.titulo,
      atividade_tipo: r.item.atividade.tipo,
      item: r.item.ordem,
      enunciado: r.item.enunciado,
      opcoes: r.opcao_ids ? r.item.opcoes.filter((o) => r.opcao_ids!.includes(o.id)).map((o) => o.texto).join(' | ') : null,
      texto: r.texto,
      correta: r.correta,
      created_at: r.created_at,
    })),
    acessos: ((acessos.data ?? []) as unknown as { ultimo_em: string; conteudo: { titulo: string } | null }[]).map((a) => ({
      titulo: a.conteudo?.titulo ?? '',
      ultimo_em: a.ultimo_em,
    })),
  }
}

// ---------------------------------------------------------------------------
// Conteúdos
// ---------------------------------------------------------------------------

const CAMPOS_CONTEUDO =
  'id, turma_id, tipo, titulo, descricao, corpo_md, capa_path, arquivo_path, video_url, link_url, publicado, publicado_em, created_at'

export async function listarTodosOsConteudos(): Promise<Conteudo[]> {
  const { data, error } = await supabase().from('conteudo').select(CAMPOS_CONTEUDO).order('created_at', { ascending: false })
  if (error) throw paraErroDeDados(error)
  return (data ?? []) as Conteudo[]
}

export type DadosDoConteudo = {
  turma_id: string | null
  tipo: TipoConteudo
  titulo: string
  descricao: string
  corpo_md: string
  video_url: string
  link_url: string
  publicado: boolean
  publicado_em: string | null
  capa: File | null
  arquivo: File | null
}

async function enviarArquivo(pasta: string, arquivo: File): Promise<string> {
  const extensao = arquivo.name.includes('.') ? arquivo.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin'
  const caminho = `${pasta}/${crypto.randomUUID()}.${extensao}`
  const { error } = await supabase().storage.from('materiais').upload(caminho, arquivo)
  if (error) throw new ErroDeDados('Não foi possível enviar o arquivo. Tente de novo.', 'arquivo')
  return caminho
}

export async function salvarConteudo(dados: DadosDoConteudo, existente?: Conteudo): Promise<void> {
  const campos: Record<string, unknown> = {
    turma_id: dados.turma_id,
    tipo: dados.tipo,
    titulo: dados.titulo.trim(),
    descricao: dados.descricao.trim() || null,
    corpo_md: dados.corpo_md.trim() || null,
    video_url: dados.video_url.trim() || null,
    link_url: dados.link_url.trim() || null,
    publicado: dados.publicado,
    publicado_em: dados.publicado_em,
  }
  if (dados.capa) campos.capa_path = await enviarArquivo('conteudos/capas', dados.capa)
  if (dados.arquivo) campos.arquivo_path = await enviarArquivo('conteudos/arquivos', dados.arquivo)

  const db = supabase()
  const { error } = existente ? await db.from('conteudo').update(campos).eq('id', existente.id) : await db.from('conteudo').insert(campos)
  if (error) {
    if (error.code === '23514') throw new ErroDeDados('Confira os links: precisam começar com http:// ou https://.', 'validacao')
    throw paraErroDeDados(error)
  }
}

export async function excluirConteudo(id: string): Promise<void> {
  const { error } = await supabase().from('conteudo').delete().eq('id', id)
  if (error) throw paraErroDeDados(error)
}

// ---------------------------------------------------------------------------
// Atividades e questões
// ---------------------------------------------------------------------------

export type OpcaoEditavel = { texto: string; correta: boolean }
export type ItemEditavel = { enunciado: string; tipo_resposta: TipoResposta; obrigatorio: boolean; explicacao: string; opcoes: OpcaoEditavel[] }

export type AtividadeDoProfessor = {
  id: string
  turma_id: string
  tipo: TipoAtividade
  titulo: string
  descricao: string | null
  instrucoes_md: string | null
  prazo_em: string | null
  dificuldade: 'facil' | 'medio' | 'dificil' | null
  categoria: string | null
  conteudo_id: string | null
  arquivo_path: string | null
  /** O aluno pode anexar arquivos à resposta. */
  aceita_arquivo: boolean
  status: 'rascunho' | 'publicada' | 'encerrada'
  publicada_em: string | null
  created_at: string
  itens: ItemEditavel[]
  /** Quantos alunos já responderam. Com respostas, os itens ficam travados. */
  respondentes: number
}

type AtividadeBruta = Omit<AtividadeDoProfessor, 'itens' | 'respondentes'> & {
  itens: {
    ordem: number
    enunciado: string
    tipo_resposta: TipoResposta
    obrigatorio: boolean
    explicacao: string | null
    opcoes: { ordem: number; texto: string; correta: boolean }[]
    respostas: { inscricao_id: string }[]
  }[]
}

/** Atividades (lições e quizzes) ou questões avulsas, com itens e opções. */
export async function listarAtividades(modo: 'atividades' | 'questoes'): Promise<AtividadeDoProfessor[]> {
  const { data, error } = await supabase()
    .from('atividade')
    .select(
      `id, turma_id, tipo, titulo, descricao, instrucoes_md, prazo_em, dificuldade, categoria, conteudo_id, arquivo_path, aceita_arquivo, status, publicada_em, created_at,
       itens:atividade_item (ordem, enunciado, tipo_resposta, obrigatorio, explicacao,
         opcoes:atividade_opcao (ordem, texto, correta),
         respostas:atividade_resposta (inscricao_id))`,
    )
    .in('tipo', modo === 'questoes' ? ['questao'] : ['licao', 'quiz'])
    .is('sessao_ao_vivo_id', null)
    .order('created_at', { ascending: false })
  if (error) throw paraErroDeDados(error)

  return ((data ?? []) as unknown as AtividadeBruta[]).map((a) => ({
    ...a,
    respondentes: new Set(a.itens.flatMap((i) => i.respostas.map((r) => r.inscricao_id))).size,
    itens: [...a.itens]
      .sort((x, y) => x.ordem - y.ordem)
      .map((i) => ({
        enunciado: i.enunciado,
        tipo_resposta: i.tipo_resposta,
        obrigatorio: i.obrigatorio,
        explicacao: i.explicacao ?? '',
        opcoes: [...i.opcoes].sort((x, y) => x.ordem - y.ordem).map((o) => ({ texto: o.texto, correta: o.correta })),
      })),
  }))
}

export type DadosDaAtividade = {
  turma_id: string
  tipo: TipoAtividade
  titulo: string
  descricao: string
  instrucoes_md: string
  prazo_em: string | null
  dificuldade: AtividadeDoProfessor['dificuldade']
  categoria: string
  conteudo_id: string | null
  arquivo: File | null
  aceita_arquivo: boolean
  itens: ItemEditavel[]
}

/**
 * Salva a atividade em rascunho (ou mantém o status atual) e regrava os
 * itens. Com respostas já enviadas, só os dados gerais são atualizados: o
 * banco trava itens e opções.
 */
export async function salvarAtividade(dados: DadosDaAtividade, existente?: AtividadeDoProfessor): Promise<string> {
  const db = supabase()
  const campos: Record<string, unknown> = {
    turma_id: dados.turma_id,
    tipo: dados.tipo,
    titulo: dados.titulo.trim(),
    descricao: dados.descricao.trim() || null,
    instrucoes_md: dados.instrucoes_md.trim() || null,
    prazo_em: dados.prazo_em,
    dificuldade: dados.dificuldade,
    categoria: dados.categoria.trim() || null,
    conteudo_id: dados.conteudo_id,
    aceita_arquivo: dados.aceita_arquivo,
    mostrar_resultado: 'apos_responder',
  }
  if (dados.arquivo) campos.arquivo_path = await enviarArquivo('atividades', dados.arquivo)

  let id = existente?.id
  if (existente) {
    const { error } = await db.from('atividade').update(campos).eq('id', existente.id)
    if (error) throw paraErroDeDados(error)
  } else {
    const { data, error } = await db.from('atividade').insert(campos).select('id').single()
    if (error) throw paraErroDeDados(error)
    id = data.id
  }
  if (existente && existente.respondentes > 0) return id!

  const { error: erroLimpeza } = await db.from('atividade_item').delete().eq('atividade_id', id)
  if (erroLimpeza) throw paraErroDeDados(erroLimpeza)

  for (const [indice, item] of dados.itens.entries()) {
    const { data: criado, error: erroItem } = await db
      .from('atividade_item')
      .insert({
        atividade_id: id,
        ordem: indice + 1,
        enunciado: item.enunciado.trim(),
        tipo_resposta: item.tipo_resposta,
        obrigatorio: item.obrigatorio,
        explicacao: item.explicacao.trim() || null,
      })
      .select('id')
      .single()
    if (erroItem) throw paraErroDeDados(erroItem)

    const opcoes = item.opcoes.filter((o) => o.texto.trim() !== '')
    if (opcoes.length > 0 && (item.tipo_resposta === 'escolha_unica' || item.tipo_resposta === 'escolha_multipla')) {
      const { error: erroOpcoes } = await db
        .from('atividade_opcao')
        .insert(opcoes.map((o, i) => ({ atividade_item_id: criado.id, ordem: i + 1, texto: o.texto.trim(), correta: o.correta })))
      if (erroOpcoes) throw paraErroDeDados(erroOpcoes)
    }
  }
  return id!
}

export async function publicarAtividade(id: string): Promise<void> {
  const { error } = await supabase().rpc('publicar_atividade', { p_atividade_id: id })
  if (error) throw paraErroDeDados(error)
}

export async function encerrarAtividade(id: string): Promise<void> {
  const { error } = await supabase().rpc('encerrar_atividade', { p_atividade_id: id })
  if (error) throw paraErroDeDados(error)
}

export type ResultadoDaVisibilidade = { alteradas: number; puladas: { titulo: string; motivo: string }[] }

/**
 * Libera (visível para os alunos) ou oculta várias questões ou atividades de
 * uma vez. As que não podem ser liberadas voltam em `puladas`, com o motivo.
 */
export async function definirVisibilidade(ids: string[], visivel: boolean): Promise<ResultadoDaVisibilidade> {
  const { data, error } = await supabase().rpc('definir_visibilidade', { p_ids: ids, p_visivel: visivel })
  if (error) throw paraErroDeDados(error)
  return data as ResultadoDaVisibilidade
}

export async function excluirAtividade(id: string): Promise<void> {
  const { error } = await supabase().from('atividade').delete().eq('id', id)
  if (error) throw paraErroDeDados(error)
}

export type RespostaRecebida = {
  aluno: string
  item: number
  enunciado: string
  opcoes: string | null
  valor: number | null
  texto: string | null
  correta: boolean | null
  created_at: string
}

export async function respostasDaAtividade(atividadeId: string): Promise<RespostaRecebida[]> {
  const { data, error } = await supabase()
    .from('vw_exportacao_respostas')
    .select('aluno, item, enunciado, opcoes, valor, texto, correta, created_at')
    .eq('atividade_id', atividadeId)
    .order('aluno')
    .order('item')
  if (error) throw paraErroDeDados(error)
  return (data ?? []) as RespostaRecebida[]
}

export type EntregaRecebida = { id: string; aluno: string; nome_arquivo: string; tamanho_bytes: number; arquivo_path: string; created_at: string }

/** Arquivos que os alunos anexaram à atividade. */
export async function entregasDaAtividade(atividadeId: string): Promise<EntregaRecebida[]> {
  const { data, error } = await supabase()
    .from('atividade_entrega')
    .select('id, nome_arquivo, tamanho_bytes, arquivo_path, created_at, inscricao:inscricao_id (perfil:perfil_id (nome))')
    .eq('atividade_id', atividadeId)
    .order('created_at')
  if (error) throw paraErroDeDados(error)
  type Bruta = Omit<EntregaRecebida, 'aluno'> & { inscricao: { perfil: { nome: string } | null } | null }
  return ((data ?? []) as unknown as Bruta[]).map(({ inscricao, ...e }) => ({ ...e, aluno: inscricao?.perfil?.nome ?? 'Aluno' }))
}

// ---------------------------------------------------------------------------
// Dúvidas, mensagens, feedbacks e avisos
// ---------------------------------------------------------------------------

export type DuvidaDoProfessor = {
  id: string
  inscricao_id: string
  aluno: string
  turma_codigo: string
  titulo: string
  pergunta: string
  categoria: string | null
  conteudo: string | null
  anexo_path: string | null
  status: 'aberta' | 'respondida' | 'arquivada'
  resposta: string | null
  respondida_em: string | null
  created_at: string
}

const CAMPOS_DUVIDA =
  'id, inscricao_id, titulo, pergunta, categoria, anexo_path, status, resposta, respondida_em, created_at, turma:turma_id (codigo), conteudo:conteudo_id (titulo), inscricao:inscricao_id (perfil:perfil_id (nome))'

type ComAluno = { turma: { codigo: string } | null; inscricao: { perfil: { nome: string } | null } | null }

function paraDuvidas(linhas: unknown[]): DuvidaDoProfessor[] {
  return (linhas as (Omit<DuvidaDoProfessor, 'aluno' | 'turma_codigo' | 'conteudo'> & ComAluno & { conteudo: { titulo: string } | null })[]).map(
    ({ turma, inscricao, conteudo, ...d }) => ({
      ...d,
      aluno: inscricao?.perfil?.nome ?? 'Aluno',
      turma_codigo: turma?.codigo ?? '',
      conteudo: conteudo?.titulo ?? null,
    }),
  )
}

export async function listarDuvidas(): Promise<DuvidaDoProfessor[]> {
  const { data, error } = await supabase().from('duvida').select(CAMPOS_DUVIDA).order('created_at', { ascending: false })
  if (error) throw paraErroDeDados(error)
  return paraDuvidas(data ?? [])
}

export async function responderDuvida(id: string, resposta: string): Promise<void> {
  const { error } = await supabase().from('duvida').update({ status: 'respondida', resposta: resposta.trim() }).eq('id', id)
  if (error) throw paraErroDeDados(error)
}

export async function definirStatusDaDuvida(id: string, status: 'aberta' | 'arquivada'): Promise<void> {
  const { error } = await supabase().from('duvida').update({ status }).eq('id', id)
  if (error) throw paraErroDeDados(error)
}

export type ConversaDoProfessor = {
  inscricao_id: string
  aluno: string
  turma_codigo: string
  ultima: string
  ultima_em: string
  naoLidas: number
}

/** Uma linha por aluno que tem conversa, da mais recente para a mais antiga. */
export async function listarConversas(): Promise<ConversaDoProfessor[]> {
  const { data, error } = await supabase()
    .from('mensagem_privada')
    .select('inscricao_id, autor, texto, lida_em, created_at, inscricao:inscricao_id (turma:turma_id (codigo), perfil:perfil_id (nome))')
    .order('created_at', { ascending: false })
  if (error) throw paraErroDeDados(error)

  type Linha = { inscricao_id: string; autor: string; texto: string; lida_em: string | null; created_at: string; inscricao: { turma: { codigo: string } | null; perfil: { nome: string } | null } | null }
  const conversas = new Map<string, ConversaDoProfessor>()
  for (const m of (data ?? []) as unknown as Linha[]) {
    const atual = conversas.get(m.inscricao_id) ?? {
      inscricao_id: m.inscricao_id,
      aluno: m.inscricao?.perfil?.nome ?? 'Aluno',
      turma_codigo: m.inscricao?.turma?.codigo ?? '',
      ultima: m.texto,
      ultima_em: m.created_at,
      naoLidas: 0,
    }
    if (m.autor === 'aluno' && m.lida_em === null) atual.naoLidas += 1
    conversas.set(m.inscricao_id, atual)
  }
  return [...conversas.values()]
}

export async function mensagensDaConversa(inscricaoId: string): Promise<MensagemPrivada[]> {
  const { data, error } = await supabase()
    .from('mensagem_privada')
    .select('id, autor, texto, lida_em, created_at')
    .eq('inscricao_id', inscricaoId)
    .order('created_at')
  if (error) throw paraErroDeDados(error)
  return (data ?? []) as MensagemPrivada[]
}

export async function responderAoAluno(inscricaoId: string, texto: string): Promise<void> {
  const { error } = await supabase().from('mensagem_privada').insert({ inscricao_id: inscricaoId, autor: 'professor', texto: texto.trim() })
  if (error) throw paraErroDeDados(error)
}

export async function marcarConversaLida(inscricaoId: string): Promise<void> {
  const { error } = await supabase()
    .from('mensagem_privada')
    .update({ lida_em: new Date().toISOString() })
    .eq('inscricao_id', inscricaoId)
    .eq('autor', 'aluno')
    .is('lida_em', null)
  if (error) throw paraErroDeDados(error)
}

export type FeedbackDoProfessor = {
  id: string
  aluno: string
  turma_codigo: string
  tipo: TipoFeedback
  texto: string
  lido: boolean
  created_at: string
}

const CAMPOS_FEEDBACK = 'id, tipo, texto, lido, created_at, turma:turma_id (codigo), inscricao:inscricao_id (perfil:perfil_id (nome))'

function paraFeedbacks(linhas: unknown[]): FeedbackDoProfessor[] {
  return (linhas as (Omit<FeedbackDoProfessor, 'aluno' | 'turma_codigo'> & ComAluno)[]).map(({ turma, inscricao, ...f }) => ({
    ...f,
    aluno: inscricao?.perfil?.nome ?? 'Aluno',
    turma_codigo: turma?.codigo ?? '',
  }))
}

export async function listarFeedbacks(): Promise<FeedbackDoProfessor[]> {
  const { data, error } = await supabase().from('feedback').select(CAMPOS_FEEDBACK).order('created_at', { ascending: false })
  if (error) throw paraErroDeDados(error)
  return paraFeedbacks(data ?? [])
}

export async function marcarFeedback(id: string, lido: boolean): Promise<void> {
  const { error } = await supabase().from('feedback').update({ lido }).eq('id', id)
  if (error) throw paraErroDeDados(error)
}

/** Um aviso como o professor publicou: uma vez, para todos ou para N turmas. */
export type AvisoDoProfessor = { lote_id: string; titulo: string; texto: string; created_at: string; turma_ids: string[]; para_todos: boolean }

export async function listarTodosOsAvisos(): Promise<AvisoDoProfessor[]> {
  const { data, error } = await supabase().from('aviso').select('lote_id, turma_id, titulo, texto, created_at').order('created_at', { ascending: false })
  if (error) throw paraErroDeDados(error)

  const lotes = new Map<string, AvisoDoProfessor>()
  for (const linha of (data ?? []) as (Aviso & { lote_id: string })[]) {
    const lote = lotes.get(linha.lote_id) ?? { lote_id: linha.lote_id, titulo: linha.titulo, texto: linha.texto, created_at: linha.created_at, turma_ids: [], para_todos: false }
    if (linha.turma_id === null) lote.para_todos = true
    else lote.turma_ids.push(linha.turma_id)
    lotes.set(linha.lote_id, lote)
  }
  return [...lotes.values()]
}

/**
 * Publica o aviso para todos os alunos (`turmaIds` vazio) ou para as turmas
 * escolhidas. Devolve o lote, que identifica o aviso no envio por e-mail.
 */
export async function publicarAviso(aviso: { turmaIds: string[]; titulo: string; texto: string }): Promise<string> {
  const lote_id = crypto.randomUUID()
  const base = { titulo: aviso.titulo.trim(), texto: aviso.texto.trim(), lote_id }
  const linhas: { titulo: string; texto: string; lote_id: string; turma_id: string | null }[] =
    aviso.turmaIds.length === 0 ? [{ ...base, turma_id: null }] : aviso.turmaIds.map((turma_id) => ({ ...base, turma_id }))
  const { error } = await supabase().from('aviso').insert(linhas)
  if (error) throw paraErroDeDados(error)
  return lote_id
}

export type EnvioDoAviso = { configurado: boolean; destinatarios: number; enviados: number }

/** Manda o aviso por e-mail a quem autorizou comunicações e informou e-mail. */
export async function enviarAvisoPorEmail(loteId: string): Promise<EnvioDoAviso> {
  return chamarFuncao<EnvioDoAviso>('enviar-aviso', { lote_id: loteId })
}

export async function excluirAviso(loteId: string): Promise<void> {
  const { error } = await supabase().from('aviso').delete().eq('lote_id', loteId)
  if (error) throw paraErroDeDados(error)
}
