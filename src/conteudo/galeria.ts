/**
 * Fotos da landing. Hoje são ILUSTRAÇÕES DE EXEMPLO (em `public/fotos/`),
 * marcadas como "Foto de exemplo". Para trocar por fotos reais:
 *
 * 1. Coloque o arquivo em `public/fotos/` (JPG ou WebP, de preferência com
 *    1200 × 900 px nas fotos da galeria e 900 × 1100 px no retrato).
 * 2. Troque o `arquivo` e o `alt` abaixo. O `alt` descreve a cena para quem
 *    usa leitor de tela.
 * 3. Mude `exemplo` para `false`, o que tira a etiqueta da tela.
 *
 * O retrato do hero também pode vir do admin (`perfil_publico.foto_path`, no
 * bucket `publico`); quando existe, ele tem prioridade sobre o arquivo daqui.
 */
export type Foto = {
  arquivo: string
  alt: string
  legenda: string
  /** true enquanto for ilustração provisória. */
  exemplo: boolean
}

export const RETRATO: Foto = {
  arquivo: '/fotos/retrato-exemplo.svg',
  alt: 'Retrato de exemplo, a ser substituído pela foto do professor',
  legenda: 'Retrato',
  exemplo: true,
}

export const GALERIA: Foto[] = [
  {
    arquivo: '/fotos/sala-de-aula.svg',
    alt: 'Ilustração de uma sala de aula com planilha projetada no quadro',
    legenda: 'Sala de aula',
    exemplo: true,
  },
  {
    arquivo: '/fotos/palestra.svg',
    alt: 'Ilustração de uma palestra com gráfico de barras no telão',
    legenda: 'Palestras',
    exemplo: true,
  },
  {
    arquivo: '/fotos/oficina.svg',
    alt: 'Ilustração de uma oficina prática com notebooks, planilha e assistente de IA',
    legenda: 'Oficinas práticas',
    exemplo: true,
  },
  {
    arquivo: '/fotos/projeto-de-dados.svg',
    alt: 'Ilustração de um painel de indicadores de um projeto de dados',
    legenda: 'Projetos de dados',
    exemplo: true,
  },
  {
    arquivo: '/fotos/mentoria.svg',
    alt: 'Ilustração de uma mentoria em dupla diante de um fluxo desenhado no quadro',
    legenda: 'Mentoria',
    exemplo: true,
  },
]
