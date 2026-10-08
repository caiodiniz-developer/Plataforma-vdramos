export type PassoSugerido = { rotulo: string; titulo: string; acao: string; para: string }

type Atividade = { id: string; tipo: string; titulo: string; status: string; respondida: boolean; prazo_em: string | null }
type Conteudo = { id: string; titulo: string }

/**
 * O que sugerir ao aluno na entrada do painel, nesta ordem: a atividade
 * pendente de prazo mais próximo (sem prazo fica por último), depois uma
 * questão ainda não respondida, depois o primeiro conteúdo que ele não abriu.
 * Sem nada pendente, convida a mandar uma dúvida.
 */
export function proximoPasso(atividades: Atividade[], conteudos: Conteudo[], acessados: Set<string>): PassoSugerido {
  const abertas = atividades.filter((a) => a.status === 'publicada' && !a.respondida)

  const licao = abertas
    .filter((a) => a.tipo !== 'questao')
    .sort((a, b) => (a.prazo_em ?? '9999').localeCompare(b.prazo_em ?? '9999'))[0]
  if (licao) return { rotulo: 'Próximo passo · atividade pendente', titulo: licao.titulo, acao: 'Responder', para: '/aluno/atividades' }

  const questao = abertas.find((a) => a.tipo === 'questao')
  if (questao) return { rotulo: 'Próximo passo · questão para praticar', titulo: questao.titulo, acao: 'Praticar', para: '/aluno/questoes' }

  const conteudo = conteudos.find((c) => !acessados.has(c.id))
  if (conteudo) return { rotulo: 'Próximo passo · conteúdo novo', titulo: conteudo.titulo, acao: 'Abrir', para: `/aluno/conteudos/${conteudo.id}` }

  return { rotulo: 'Tudo em dia', titulo: 'Você já viu e respondeu tudo o que foi publicado.', acao: 'Enviar dúvida', para: '/aluno/duvidas' }
}
