import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCheckIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  ListChecksIcon,
  MegaphoneIcon,
  MessageSquareHeartIcon,
  MessageSquareIcon,
  TargetIcon,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Carregado, FaixaDeCores, Numero, Selo, Vazio, type Cor } from '@/componentes/plataforma/Blocos'
import { useTurmaAtual } from '@/componentes/plataforma/LayoutAluno'
import { TextoComLinks } from '@/componentes/plataforma/Links'
import { useSessao } from '@/contextos/Sessao'
import {
  conteudosAcessados,
  listarAvisos,
  listarConteudos,
  meuProgresso,
  minhasAtividades,
  minhasDuvidas,
  ROTULO_TIPO_CONTEUDO,
} from '@/dados/apoio'
import { percentualDe } from '@/dominio/busca'
import { proximoPasso } from '@/dominio/progresso'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'

const FUSO = 'America/Sao_Paulo'

async function carregar(turmaId: string) {
  const [progresso, conteudos, atividades, duvidas, avisos, acessados] = await Promise.all([
    meuProgresso(turmaId),
    listarConteudos(turmaId),
    minhasAtividades(turmaId),
    minhasDuvidas(turmaId),
    listarAvisos(turmaId),
    conteudosAcessados(),
  ])
  return { progresso, conteudos, atividades, duvidas, avisos, acessados }
}

function Bloco({
  titulo,
  para,
  verTudo,
  icone,
  cor,
  children,
}: {
  titulo: string
  para: string
  verTudo: string
  icone: LucideIcon
  cor: Cor
  children: React.ReactNode
}) {
  return (
    <Card className="h-full min-w-0">
      <CardHeader className="flex flex-row items-center gap-3">
        <Selo icone={icone} cor={cor} className="size-9 [&>svg]:size-4" />
        <CardTitle className="min-w-0 flex-1">
          <h2 className="text-[19px]">{titulo}</h2>
        </CardTitle>
        <Button asChild variant="link" size="sm" className="px-0">
          <Link to={para}>
            {verTudo}
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

const ATALHOS: { rotulo: string; texto: string; para: string; icone: LucideIcon; cor: Cor }[] = [
  { rotulo: 'Enviar dúvida', texto: 'Direto ao professor', para: '/aluno/duvidas', icone: CircleHelpIcon, cor: 'azul' },
  { rotulo: 'Praticar questões', texto: 'Com correção na hora', para: '/aluno/questoes', icone: ListChecksIcon, cor: 'laranja' },
  { rotulo: 'Falar com o professor', texto: 'Conversa privada', para: '/aluno/mensagens', icone: MessageSquareIcon, cor: 'roxo' },
  { rotulo: 'Dar feedback', texto: 'Conte como foi a aula', para: '/aluno/feedback', icone: MessageSquareHeartIcon, cor: 'verde' },
]

/** Painel do aluno: progresso, próximo passo, atalhos, conteúdos, atividades, dúvidas e avisos. */
export default function Inicio() {
  const turma = useTurmaAtual()
  const { perfil } = useSessao()
  const consulta = useConsulta(() => carregar(turma.id), [turma.id])
  const primeiroNome = perfil?.nome.split(' ')[0] ?? ''

  return (
    <Carregado consulta={consulta} linhas={4}>
      {({ progresso, conteudos, atividades, duvidas, avisos, acessados }) => {
        const licoes = atividades.filter((a) => a.tipo !== 'questao')
        const pendentes = licoes.filter((a) => !a.respondida && a.status === 'publicada')
        const desempenho = percentualDe(progresso.questoes_corretas, progresso.questoes_respondidas)
        const geral = percentualDe(
          progresso.atividades_realizadas + progresso.conteudos_acessados,
          progresso.atividades_disponiveis + progresso.conteudos_disponiveis,
        )
        const passo = proximoPasso(atividades, conteudos, acessados)

        return (
          <>
            <section aria-labelledby="titulo-inicio" className="flex flex-col bg-tinta text-papel">
              <div className="grid gap-8 px-5 py-8 md:grid-cols-[1.5fr_1fr] md:px-10 md:py-10">
                <div className="flex min-w-0 flex-col gap-4">
                  <p className="eyebrow text-papel/80">
                    Turma {turma.codigo} · {turma.nome_curso}
                  </p>
                  <h1 id="titulo-inicio" className="text-[34px] leading-[1.05] text-papel md:text-[48px]">
                    Olá, {primeiroNome}
                  </h1>
                  <p className="max-w-[520px] text-[15px] text-papel/85">
                    Aqui ficam os conteúdos extras, as atividades e o canal direto com o professor.
                  </p>
                  <div className="mt-2 flex flex-col gap-3 border-2 border-papel/30 p-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="eyebrow text-[10px] text-papel/70">{passo.rotulo}</p>
                      <p className="truncate font-semibold text-papel">{passo.titulo}</p>
                    </div>
                    <Button asChild size="sm" className="shrink-0 hover:border-papel hover:bg-papel hover:text-tinta">
                      <Link to={passo.para}>
                        {passo.acao}
                        <ArrowRightIcon aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col justify-end gap-3">
                  <p className="eyebrow text-papel/80">Progresso geral</p>
                  <p className="destaque text-[64px] leading-none text-papel md:text-[84px]">
                    {geral}
                    <span className="text-[32px] md:text-[40px]">%</span>
                  </p>
                  <div
                    role="progressbar"
                    aria-label="Progresso geral"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={geral}
                    className="h-3 w-full border-2 border-papel/60"
                  >
                    <div className="h-full bg-primary transition-[width] duration-700" style={{ width: `${geral}%` }} />
                  </div>
                  <p className="text-xs text-papel/80">Atividades feitas e conteúdos abertos, sobre o total da turma.</p>
                </div>
              </div>
              <FaixaDeCores />
            </section>

            <section aria-labelledby="titulo-progresso" className="flex flex-col gap-4">
              <h2 id="titulo-progresso" className="text-[19px]">
                Seu progresso
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Numero
                  icone={ClipboardListIcon}
                  cor="azul"
                  rotulo="Atividades realizadas"
                  valor={`${progresso.atividades_realizadas}/${progresso.atividades_disponiveis}`}
                />
                <Numero icone={ListChecksIcon} cor="laranja" rotulo="Questões respondidas" valor={progresso.questoes_respondidas} />
                <Numero
                  icone={BookOpenIcon}
                  cor="roxo"
                  rotulo="Conteúdos acessados"
                  valor={`${progresso.conteudos_acessados}/${progresso.conteudos_disponiveis}`}
                />
                <Numero
                  icone={TargetIcon}
                  cor="verde"
                  rotulo="Desempenho"
                  valor={progresso.questoes_respondidas > 0 ? `${desempenho}%` : '—'}
                  detalhe={
                    progresso.questoes_respondidas > 0
                      ? `${progresso.questoes_corretas} ${progresso.questoes_corretas === 1 ? 'acerto' : 'acertos'} em ${progresso.questoes_respondidas} ${progresso.questoes_respondidas === 1 ? 'questão' : 'questões'}`
                      : 'Responda questões para ver seu desempenho'
                  }
                />
              </div>
            </section>

            <nav aria-label="Atalhos" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ATALHOS.map((a) => (
                <Link
                  key={a.para}
                  to={a.para}
                  className="group flex items-center gap-3 border-2 p-3 transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-muted"
                >
                  <Selo icone={a.icone} cor={a.cor} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold">{a.rotulo}</span>
                    <span className="truncate text-xs text-muted-foreground">{a.texto}</span>
                  </span>
                  <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </nav>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Bloco titulo="Conteúdos recentes" para="/aluno/conteudos" verTudo="Ver todos" icone={BookOpenIcon} cor="roxo">
                {conteudos.length === 0 ? (
                  <Vazio icone={BookOpenIcon} titulo="Nada publicado ainda" texto="Os conteúdos do professor aparecem aqui." />
                ) : (
                  <ul className="flex flex-col">
                    {conteudos.slice(0, 4).map((c) => (
                      <li key={c.id} className="border-t border-divisor first:border-t-0">
                        <Link to={`/aluno/conteudos/${c.id}`} className="group flex items-center gap-3 px-1 py-3 hover:bg-muted">
                          <span className="min-w-0 flex-1">
                            <span className="eyebrow block text-[10px] text-muted-foreground">{ROTULO_TIPO_CONTEUDO[c.tipo]}</span>
                            <span className="block truncate font-semibold">{c.titulo}</span>
                          </span>
                          {acessados.has(c.id) && <CheckCheckIcon aria-label="Já visto" className="size-4 shrink-0 text-muted-foreground" />}
                          <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Bloco>

              <Bloco titulo="Atividades" para="/aluno/atividades" verTudo="Ver todas" icone={ClipboardListIcon} cor="azul">
                {licoes.length === 0 ? (
                  <Vazio icone={ClipboardListIcon} titulo="Sem atividades por enquanto" />
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm">
                      <span className="destaque text-lg">{pendentes.length}</span> pendente{pendentes.length === 1 ? '' : 's'} ·{' '}
                      <span className="destaque text-lg">{licoes.length - pendentes.length}</span> concluída
                      {licoes.length - pendentes.length === 1 ? '' : 's'}
                    </p>
                    <ul className="flex flex-col">
                      {licoes.slice(0, 4).map((a) => (
                        <li key={a.id} className="flex items-center gap-3 border-t border-divisor py-3 first:border-t-0">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{a.titulo}</span>
                            {a.prazo_em && (
                              <span className="font-mono text-xs text-muted-foreground">Prazo: {formatarDataHora(a.prazo_em, FUSO)}</span>
                            )}
                          </span>
                          <Badge variant={a.respondida ? 'green' : 'outline'}>{a.respondida ? 'Concluída' : 'Pendente'}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Bloco>

              <Bloco titulo="Minhas dúvidas" para="/aluno/duvidas" verTudo="Abrir" icone={CircleHelpIcon} cor="laranja">
                {duvidas.length === 0 ? (
                  <Vazio icone={CircleHelpIcon} titulo="Nenhuma dúvida enviada" texto="Ficou com dúvida? Pergunte direto ao professor.">
                    <Button asChild size="sm">
                      <Link to="/aluno/duvidas">Enviar dúvida</Link>
                    </Button>
                  </Vazio>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm">
                      <span className="destaque text-lg">{progresso.duvidas_abertas}</span> aberta
                      {progresso.duvidas_abertas === 1 ? '' : 's'} ·{' '}
                      <span className="destaque text-lg">{progresso.duvidas_respondidas}</span> respondida
                      {progresso.duvidas_respondidas === 1 ? '' : 's'}
                    </p>
                    <ul className="flex flex-col">
                      {duvidas.slice(0, 3).map((d) => (
                        <li key={d.id} className="flex items-center gap-3 border-t border-divisor py-3 first:border-t-0">
                          <span className="min-w-0 flex-1 truncate font-semibold">{d.titulo}</span>
                          <Badge variant={d.status === 'respondida' ? 'green' : 'outline'}>
                            {d.status === 'respondida' ? 'Respondida' : d.status === 'arquivada' ? 'Arquivada' : 'Aberta'}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Bloco>

              <Bloco titulo="Avisos" para="/aluno/avisos" verTudo="Ver todos" icone={MegaphoneIcon} cor="verde">
                {avisos.length === 0 ? (
                  <Vazio icone={MegaphoneIcon} titulo="Nenhum aviso" texto="Os comunicados do professor aparecem aqui." />
                ) : (
                  <ul className="flex flex-col gap-4">
                    {avisos.slice(0, 3).map((a) => (
                      <li key={a.id} className="border-l-4 border-green pl-3">
                        <p className="font-semibold">{a.titulo}</p>
                        <TextoComLinks texto={a.texto} className="text-sm text-muted-foreground" />
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">{formatarDataHora(a.created_at, FUSO)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Bloco>
            </div>
          </>
        )
      }}
    </Carregado>
  )
}
