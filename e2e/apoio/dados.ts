import { ANA, PROFESSOR, type Chamada, type Respostas, type Usuario } from './supabase'

/** Dados de exemplo no formato que o PostgREST devolve para as consultas do app. */
export const CODIGO = 'EXCIA-CPS-2610'
const TURMA_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const SESSAO_ID = 'bbbbbbbb-0000-4000-8000-000000000001'
const ENCONTRO_ID = 'cccccccc-0000-4000-8000-000000000001'
export const ATIVIDADE_ID = 'dddddddd-0000-4000-8000-000000000001'

const curso = {
  id: 'eeeeeeee-0000-4000-8000-000000000001',
  nome: 'Excel Básico com IA Generativa',
  tipo_formacao: 'FIC Aperfeiçoamento',
  carga_horaria_h: 20,
  objetivo: 'Organizar, analisar e apresentar dados no Excel, usando IA generativa com critério e ética.',
  ementa_md: '- Estruturação de dados\n- Fórmulas e referências\n- IA generativa como apoio',
  publico_alvo: 'Profissionais que usam planilhas.',
  pre_requisitos: null,
  criterios_avaliacao_md: '**Nível mínimo:** atingir CT1 a CT3.',
  capacidades: [
    { id: 'k1', codigo: 'CT1', tipo: 'tecnica', descricao: 'Estruturar dados em tabelas.' },
    { id: 'k2', codigo: 'CS1.1', tipo: 'socioemocional', descricao: 'Agir com ética no uso de dados.' },
  ],
}

const blocos = [
  { id: 'b1', ordem: 1, hora_inicio: '18:45:00', duracao_min: 15, tipo: 'abertura', titulo: 'Abertura e combinados', descricao: null },
  { id: 'b2', ordem: 2, hora_inicio: '19:00:00', duracao_min: 60, tipo: 'teoria', titulo: 'Conceitos do encontro', descricao: null },
  { id: 'b3', ordem: 3, hora_inicio: '20:00:00', duracao_min: 15, tipo: 'intervalo', titulo: 'Intervalo', descricao: null },
  { id: 'b4', ordem: 4, hora_inicio: '20:15:00', duracao_min: 90, tipo: 'pratica', titulo: 'Prática guiada', descricao: null },
  { id: 'b5', ordem: 5, hora_inicio: '21:45:00', duracao_min: 30, tipo: 'perguntas', titulo: 'Perguntas da turma', descricao: null },
  { id: 'b6', ordem: 6, hora_inicio: '22:15:00', duracao_min: 30, tipo: 'margem', titulo: 'Margem', descricao: null },
]

export type Cenario = {
  usuario: Usuario
  statusDaTurma: 'ativa' | 'encerrada'
  statusDaSessao: 'agendada' | 'aberta' | 'encerrada'
  versaoDoTermo: string
  querComunicacao: boolean
  perguntas: Record<string, unknown>[]
  mensagens: Record<string, unknown>[]
  atividades: Record<string, unknown>[]
  contatos: Record<string, unknown>[]
  /** A atividade já foi respondida pelo aluno. */
  respondida: boolean
}

export function cenarioPadrao(mudancas: Partial<Cenario> = {}): Cenario {
  return {
    usuario: ANA,
    statusDaTurma: 'ativa',
    statusDaSessao: 'aberta',
    versaoDoTermo: '2026-10-v1',
    querComunicacao: false,
    respondida: false,
    perguntas: [
      { id: 'p1', texto: 'Qual a diferença entre PROCV e PROCX?', destino: 'turma', anonima: false, autor_nome: 'Bruno Lima', status: 'aberta', resposta: null, votos: 1, created_at: '2026-10-14T22:00:00Z' },
      { id: 'p2', texto: 'Não entendi referência absoluta.', destino: 'turma', anonima: true, autor_nome: null, status: 'respondida', resposta: 'Use o cifrão para travar.', votos: 4, created_at: '2026-10-14T22:05:00Z' },
    ],
    mensagens: [
      { id: 'm1', perfil_id: 'x', autor_nome: 'Bruno Lima', tipo: 'texto', texto: 'Planilha: https://exemplo.com/base.xlsx', fixada: false, removida: false, created_at: '2026-10-14T22:01:00Z' },
      { id: 'm2', perfil_id: PROFESSOR.id, autor_nome: 'Vitor Ramos', tipo: 'aviso', texto: 'Intervalo de 15 minutos.', fixada: true, removida: false, created_at: '2026-10-14T22:10:00Z' },
    ],
    atividades: [],
    contatos: [
      { id: 'c1', nome: 'Carla Dias', email: 'carla@empresa.com', assunto: 'palestra', assunto_outro: null, mensagem: 'Gostaria de uma palestra sobre letramento em dados.', lida: false, created_at: '2026-10-15T01:30:00Z' },
      { id: 'c2', nome: 'Diego Reis', email: 'diego@empresa.com', assunto: 'outro', assunto_outro: 'Mentoria', mensagem: 'Podemos conversar sobre mentoria?', lida: true, created_at: '2026-10-12T15:00:00Z' },
    ],
    ...mudancas,
  }
}

export const QUIZ = {
  id: ATIVIDADE_ID,
  tipo: 'quiz',
  titulo: 'Quiz — referências de célula',
  status: 'publicada',
  sessao_ao_vivo_id: SESSAO_ID,
  tempo_limite_s: null,
  publicada_em: '2026-10-14T22:20:00Z',
  mostrar_resultado: 'apos_responder',
}

function turmaCompleta(c: Cenario) {
  return {
    id: TURMA_ID,
    codigo: CODIGO,
    instituicao: 'SENAI',
    cidade: 'Campinas',
    modalidade: 'presencial',
    data_inicio: '2026-10-14',
    data_fim: '2026-10-28',
    vagas: 20,
    status: c.statusDaTurma,
    fuso: 'America/Sao_Paulo',
    curso,
    encontros: [
      {
        id: ENCONTRO_ID,
        numero: 1,
        data: '2099-10-14',
        hora_inicio: '18:45:00',
        hora_fim: '22:45:00',
        titulo: 'SA1 · Estruturação de Dados e IA Ética',
        descricao: 'Primeiro encontro do curso.',
        local: 'Laboratório de informática',
        blocos,
        sessao: { id: SESSAO_ID, status: c.statusDaSessao, permite_anonimo: true, chat_ativo: true, aberta_em: '2026-10-14T21:45:00Z' },
      },
    ],
    materiais: [
      { id: 'mt1', encontro_id: null, titulo: 'Apostila do curso', tipo: 'slides', tipo_outro: null, url: 'https://exemplo.com/apostila.pdf', arquivo_path: null, ordem: 0 },
      { id: 'mt2', encontro_id: ENCONTRO_ID, titulo: 'Planilha do encontro 1', tipo: 'exercicio', tipo_outro: null, url: 'https://exemplo.com/e1.xlsx', arquivo_path: null, ordem: 0 },
    ],
  }
}

function consentimentos(c: Cenario) {
  const base = { versao_termo: c.versaoDoTermo, origem: 'cadastro', created_at: '2026-10-14T22:00:00Z' }
  return [
    { ...base, finalidade: 'uso_dados_pedagogicos', concedido: true },
    { ...base, finalidade: 'comunicacao_professor', concedido: c.querComunicacao },
  ]
}

function atividadeParaAluno(c: Cenario) {
  const respondida = c.respondida
  return {
    ...QUIZ,
    anonima: false,
    respondida,
    mostra_resultado: respondida,
    itens: [
      {
        id: 'i1',
        ordem: 1,
        enunciado: 'Qual símbolo fixa uma referência de célula?',
        tipo_resposta: 'escolha_unica',
        obrigatorio: true,
        opcoes: [
          { id: 'o1', ordem: 1, texto: '$', ...(respondida ? { correta: true, total: 3 } : {}) },
          { id: 'o2', ordem: 2, texto: '#', ...(respondida ? { correta: false, total: 1 } : {}) },
        ],
        minha_resposta: respondida ? { opcao_ids: ['o1'], valor: null, texto: null, correta: true } : null,
        explicacao: respondida ? 'O cifrão trava a linha, a coluna ou as duas.' : null,
        resultado: respondida ? { respostas: 4, media: null } : null,
      },
    ],
  }
}

/** Respostas da API para um cenário. O cenário pode ser alterado durante o teste. */
export function respostasDe(c: Cenario): Respostas {
  const perfil = () => [{ id: c.usuario.id, papel: c.usuario.papel, nome: c.usuario.nome, email: c.usuario.email, created_at: '2026-10-14T22:00:00Z' }]
  const filtrado = (chamada: Chamada, coluna: string) => chamada.busca.get(coluna)?.replace(/^eq\./, '')

  return {
    tabelas: {
      perfil,
      consentimento: () => consentimentos(c),
      turma: (chamada) => {
        if (chamada.metodo === 'HEAD') return filtrado(chamada, 'status') === 'ativa' ? [{}] : []
        return [turmaCompleta(c)]
      },
      inscricao: (chamada) =>
        chamada.metodo === 'HEAD'
          ? [{}, {}, {}]
          : [
              {
                id: 'insc1',
                ultimo_acesso_em: '2026-10-15T01:30:00Z',
                created_at: '2026-10-14T22:00:00Z',
                turma: { codigo: CODIGO, instituicao: 'SENAI', cidade: 'Campinas', status: c.statusDaTurma, curso: { nome: curso.nome } },
              },
            ],
      pergunta: () => c.perguntas,
      pergunta_autoria: () => [],
      pergunta_voto: () => [{ pergunta_id: 'p2' }],
      mensagem: () => c.mensagens,
      atividade: () => c.atividades,
      atividade_resposta: () => [],
      sessao_ao_vivo: () => (c.statusDaSessao === 'aberta' ? [{}] : []),
      contato_mensagem: (chamada) => {
        const lida = filtrado(chamada, 'lida')
        return c.contatos.filter((m) => lida === undefined || String(m.lida) === lida)
      },
    },
    rpc: {
      enviar_pergunta: (chamada) => {
        const corpo = chamada.corpo as { p_texto: string; p_destino: string; p_anonima: boolean }
        c.perguntas = [
          ...c.perguntas,
          { id: `nova-${c.perguntas.length}`, texto: corpo.p_texto, destino: corpo.p_destino, anonima: corpo.p_anonima, autor_nome: corpo.p_anonima ? null : c.usuario.nome, status: 'aberta', resposta: null, votos: 0, created_at: new Date().toISOString() },
        ]
        return 'nova'
      },
      alternar_voto: () => true,
      enviar_mensagem: (chamada) => {
        const corpo = chamada.corpo as { p_texto: string }
        c.mensagens = [...c.mensagens, { id: `nova-${c.mensagens.length}`, perfil_id: c.usuario.id, autor_nome: c.usuario.nome, tipo: 'texto', texto: corpo.p_texto, fixada: false, removida: false, created_at: new Date().toISOString() }]
        return 'nova'
      },
      atividade_para_aluno: () => atividadeParaAluno(c),
      responder_atividade: () => {
        c.respondida = true
        return null
      },
    },
    funcoes: {},
  }
}
