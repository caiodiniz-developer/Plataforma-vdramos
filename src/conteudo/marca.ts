/**
 * Conteúdo de marca pessoal da landing: grandes números, trajetória e "como
 * trabalho". Fica versionado aqui enquanto não existe a tela de edição da
 * landing no painel.
 *
 * Fontes dos fatos: o histórico de atuação em
 * github.com/admvitorramos/jobs-xp-skills-vitor-ramos e o briefing do próprio
 * Vitor (10/2026). Não acrescente número, cargo, data ou nome de cliente que
 * não esteja em uma dessas fontes.
 *
 * Voz (módulo "voz" do mesmo repositório): primeira pessoa do singular,
 * começar pelo ponto, parágrafos de 1 a 3 frases, fato no lugar de adjetivo.
 * Fora: "jornada" como metáfora, "robusto" fora do sentido técnico,
 * "alavancar", "não é apenas X, é Y" e trincas de adjetivos sem dado.
 */

export type CorDaMarca = 'azul' | 'laranja' | 'roxo' | 'verde' | 'tinta'

// ---------------------------------------------------------------------------
// Posicionamento
// ---------------------------------------------------------------------------

export const TITULO_DO_PERFIL = 'Engenharia de Dados · Liderança Técnica · Educação'

/** Proposta de valor: aparece no hero e abre a seção "Como trabalho". */
export const PROPOSTA_DE_VALOR = 'A ponte entre a inteligência de negócios e a engenharia de dados em escala.'

// ---------------------------------------------------------------------------
// Grandes números
// ---------------------------------------------------------------------------

export type GrandeNumero = {
  /** Valor contado na tela. */
  valor: number
  /** Sinal que acompanha o valor, antes ou depois dele. */
  prefixo?: string
  sufixo?: string
  rotulo: string
  detalhe: string
  cor: CorDaMarca
}

export const GRANDES_NUMEROS: GrandeNumero[] = [
  {
    valor: 15,
    prefixo: '+',
    rotulo: 'Anos de carreira',
    detalhe: 'Entre negócios, gestão e tecnologia.',
    cor: 'azul',
  },
  {
    valor: 50,
    prefixo: '+',
    rotulo: 'Pessoas lideradas',
    detalhe: 'Em operações comerciais e squads multidisciplinares.',
    cor: 'laranja',
  },
  {
    valor: 2,
    rotulo: 'Livros técnicos',
    detalhe: 'Publicados pelo Senac: Mineração de Dados e Estrutura, Análise de Dados e Tomada de Decisão.',
    cor: 'roxo',
  },
  {
    valor: 7,
    sufixo: '+',
    rotulo: 'Certificações',
    detalhe: 'Em cloud e dados: GCP Professional Data Engineer, GCP ML Engineer, Databricks e AWS.',
    cor: 'verde',
  },
  {
    valor: 3,
    sufixo: '+',
    rotulo: 'Comunidades e instituições',
    detalhe: 'Como professor e trainer: Escola Korú, The Plumbers, Engenharia de Dados Academy e Brasil Cursinhos.',
    cor: 'tinta',
  },
]

// ---------------------------------------------------------------------------
// Trajetória, por momento de carreira
// ---------------------------------------------------------------------------

export type Atuacao = {
  organizacao: string
  papel: string
  /** Frase de abertura: o que eu faço ou fiz ali. */
  resumo: string
  pontos: string[]
}

export type MomentoDeCarreira = {
  id: string
  periodo: string
  titulo: string
  cor: CorDaMarca
  atuacoes: Atuacao[]
  /** Temas do guia de marca ligados ao momento. */
  temas: string[]
}

export const TRAJETORIA: MomentoDeCarreira[] = [
  {
    id: 'engenharia',
    periodo: '2023 — atual',
    titulo: 'Engenharia de dados e liderança técnica',
    cor: 'azul',
    temas: ['Dados', 'Engenharia', 'IA'],
    atuacoes: [
      {
        organizacao: 'Apllos Solutions',
        papel: 'Senior Data Engineer & Tech Lead',
        resumo: 'Lidero tecnicamente squads de dados de Supply, Finance, E-commerce e Governança.',
        pontos: [
          'Desenho e construo pipelines com Databricks, Spark (PySpark), Delta Lake, AWS e GCP.',
          'Implanto CI/CD, governança e práticas de escalabilidade de dados.',
          'Documentei um framework lakehouse com Databricks Asset Bundles e configuração em YAML.',
          'Criei a metodologia de Governança de Dados da empresa e fomento a Tribo de Dados, a comunidade interna de dados.',
        ],
      },
    ],
  },
  {
    id: 'negocios',
    periodo: '2014 — 2023',
    titulo: 'Gestão de negócios e operações estratégicas',
    cor: 'laranja',
    temas: ['Produto', 'Dados'],
    atuacoes: [
      {
        organizacao: 'Claro Brasil',
        papel: 'Gerente de Desenvolvimento de Negócios',
        resumo: 'Geri os canais de franquias e varejo no interior de São Paulo.',
        pontos: [
          'Coordenei equipes comerciais diretas e indiretas, cerca de 50 profissionais.',
          'Decidi com dados: Power BI, KPIs, forecast e budgeting.',
        ],
      },
    ],
  },
  {
    id: 'educacao',
    periodo: 'Em paralelo, contínuo',
    titulo: 'Educação, livros e comunidade',
    cor: 'verde',
    temas: ['Educação', 'Dados', 'IA'],
    atuacoes: [
      {
        organizacao: 'Escola Korú · The Plumbers · Engenharia de Dados Academy',
        papel: 'Professor e trainer',
        resumo: 'Atuo como professor e trainer nessas escolas e comunidades.',
        pontos: [],
      },
      {
        organizacao: 'Senac EAD',
        papel: 'Autor técnico',
        resumo: 'Escrevi dois livros da Série Universitária da Editora Senac, com videoaulas de graduação.',
        pontos: [
          'Mineração de Dados e Estrutura, Análise de Dados e Tomada de Decisão, com 8 capítulos cada.',
          'Cada capítulo com texto-base, roteiro de vídeo e notebooks Python.',
        ],
      },
      {
        organizacao: 'XP Educação · SENAI-SP · Pulse Mais',
        papel: 'Professor conteudista',
        resumo: 'Produzo cursos completos: plano de ensino, aulas, laboratórios e avaliações.',
        pontos: [
          'XP Educação: módulos de Engenharia de Dados, Cloud e IA sobre Google Cloud nos bootcamps de pós-graduação.',
          'SENAI-SP: cursos de Formação Inicial e Continuada em dados e inteligência artificial.',
          'Pulse Mais 2026: módulo de Análise de Dados com IA.',
        ],
      },
      {
        organizacao: 'Brasil Cursinhos · Canal da Cloud',
        papel: 'Voluntariado',
        resumo: 'Ex-diretor de Dados na Brasil Cursinhos e coordenador da Trilha GCP no Canal da Cloud.',
        pontos: [],
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Como trabalho
// ---------------------------------------------------------------------------

/** Perfil em T: a barra horizontal é a visão ampla; a haste é a especialidade. */
export const PERFIL_EM_T = {
  amplitude: ['Negócios', 'Liderança', 'Educação'],
  profundidade: 'Engenharia de dados',
}

export const COMO_TRABALHO: { titulo: string; texto: string }[] = [
  {
    titulo: 'Começo pelo negócio',
    texto: 'Antes da query ou do pipeline, avalio o ROI, a viabilidade e o impacto no negócio. O código vem depois.',
  },
  {
    titulo: 'Lidero e formo pessoas',
    texto: 'Lidero times, faço mentoria de engenheiros e traduzo requisitos complexos para quem decide na diretoria.',
  },
  {
    titulo: 'Ensino o que pratico',
    texto: 'Levo os projetos para a sala de aula e a sala de aula para os projetos, como professor, trainer e autor.',
  },
]

export type GrupoDeStack = { titulo: string; itens: string[] }

export const STACK: GrupoDeStack[] = [
  { titulo: 'Cloud e plataformas', itens: ['Google Cloud (GCP)', 'AWS', 'Azure', 'Databricks'] },
  { titulo: 'Processamento e storage', itens: ['Spark (PySpark)', 'Delta Lake', 'BigQuery', 'Kafka', 'Athena', 'PostgreSQL'] },
  { titulo: 'Linguagens e análise', itens: ['Python (Pandas, Scikit-learn)', 'SQL', 'Power BI'] },
  { titulo: 'Metodologias', itens: ['Scrum', 'Kanban', 'OKRs', 'Data Mesh'] },
]

/** Repositório público com o histórico de atuação e projetos. */
export const GITHUB_URL = 'https://github.com/admvitorramos'
