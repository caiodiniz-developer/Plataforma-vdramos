import { ArrowLeftIcon, WifiOffIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RespostaDaAtividade } from '@/componentes/atividade/RespostaDaAtividade'
import { EstadoDeErro } from '@/componentes/EstadoDeErro'
import { FeedDeMensagens } from '@/componentes/sala/FeedDeMensagens'
import { MuralDePerguntas } from '@/componentes/sala/MuralDePerguntas'
import { assinarSala, buscarSala, type AtividadeResumida, type EstadoDaConexao, type Sala } from '@/dados/sala'
import { ROTULO_TIPO_ATIVIDADE } from '@/dominio/atividade'
import { useConsulta } from '@/hooks/useConsulta'
import { useTelaLarga } from '@/hooks/useTelaLarga'

function ListaDeAtividades({ atividades, aoAbrir }: { atividades: AtividadeResumida[]; aoAbrir: (id: string) => void }) {
  const visiveis = atividades.filter((a) => a.status !== 'rascunho')
  if (visiveis.length === 0) {
    return <p className="text-muted-foreground">O professor ainda não publicou atividades nesta sessão.</p>
  }
  return (
    <ul className="flex flex-col gap-3">
      {visiveis.map((a) => (
        <li key={a.id}>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="eyebrow text-muted-foreground">{ROTULO_TIPO_ATIVIDADE[a.tipo]}</p>
                <p className="font-bold">{a.titulo}</p>
              </div>
              <Badge variant={a.status === 'publicada' ? 'default' : 'neutro'}>
                {a.status === 'publicada' ? 'Aberta' : 'Encerrada'}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => aoAbrir(a.id)}>
                {a.status === 'publicada' ? 'Responder' : 'Ver resultado'}
              </Button>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}

/** PRD F9 a F13 e seção 5 — Sala ao vivo do aluno. */
export default function AoVivo() {
  const { codigo = '' } = useParams()
  const { dados, carregando, erro, recarregar } = useConsulta<Sala>(() => buscarSala(codigo), [codigo])
  const telaLarga = useTelaLarga()
  const [conexao, setConexao] = useState<EstadoDaConexao>('conectado')
  const [escolhida, setAtividadeAberta] = useState<string | null>(null)
  const [dispensadas, setDispensadas] = useState<Set<string>>(new Set())

  const sessaoId = dados?.sessao?.id
  useEffect(() => {
    if (!sessaoId) return
    return assinarSala(sessaoId, recarregar, setConexao)
  }, [sessaoId, recarregar])

  // A atividade publicada agora abre sozinha, uma vez, como diálogo não bloqueante.
  const publicada = dados?.atividades.find((a) => a.status === 'publicada')
  const automatica = publicada && !dispensadas.has(publicada.id) ? publicada.id : null
  const atividadeAberta = escolhida ?? automatica

  function fecharAtividade() {
    if (atividadeAberta) setDispensadas((atuais) => new Set(atuais).add(atividadeAberta))
    setAtividadeAberta(null)
  }

  if (carregando && !dados) {
    return (
      <div className="mx-auto flex max-w-[1080px] flex-col gap-5 px-4 py-14 md:px-10" aria-busy="true">
        <span className="sr-only">Carregando</span>
        <Skeleton className="h-10 w-2/3" />
        <div className="grid gap-5 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }
  if (erro || !dados) {
    return (
      <div className="mx-auto max-w-[1080px] px-4 py-14 md:px-10">
        <EstadoDeErro mensagem={erro ?? 'Sala não encontrada.'} aoTentarDeNovo={recarregar} />
      </div>
    )
  }

  const { sessao, turma } = dados
  const aberta = sessao?.status === 'aberta' && turma.status === 'ativa'
  const tituloAtividade = dados.atividades.find((a) => a.id === atividadeAberta)?.titulo ?? 'Atividade'

  return (
    <div className="plataforma flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b-2 bg-background">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-3 px-4 py-3 md:px-10">
          <Button asChild size="sm" variant="ghost">
            <Link to={`/aluno/turmas/${turma.codigo}`}>
              <ArrowLeftIcon aria-hidden="true" />
              Turma
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="eyebrow truncate text-muted-foreground">{turma.nome_curso}</p>
            <h1 className="truncate text-lg">
              {sessao ? `Encontro ${sessao.encontro.numero} · ${sessao.encontro.titulo}` : 'Sala ao vivo'}
            </h1>
          </div>
          <Badge variant={aberta ? 'default' : 'neutro'}>{aberta ? 'Ao vivo' : 'Somente leitura'}</Badge>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-4 py-6 md:px-10 md:py-10">
        {conexao === 'reconectando' && (
          <Alert className="border-2 border-orange bg-card">
            <WifiOffIcon aria-hidden="true" />
            <AlertTitle>Reconectando…</AlertTitle>
            <AlertDescription>As novidades aparecem assim que a conexão voltar.</AlertDescription>
          </Alert>
        )}

        {!sessao ? (
          <Card>
            <CardContent>
              <p className="text-muted-foreground">Não há aula ao vivo nesta turma agora.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {publicada && !atividadeAberta && (
              <Alert className="border-2 border-primary bg-card">
                <AlertTitle>{ROTULO_TIPO_ATIVIDADE[publicada.tipo]} aberto agora</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-3">
                  <span>{publicada.titulo}</span>
                  <Button size="sm" onClick={() => setAtividadeAberta(publicada.id)}>
                    Responder
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/*
              Celular: abas. Desktop: perguntas e mensagens lado a lado, atividades
              abaixo. Só um dos dois é montado, para não duplicar formulários.
            */}
            {!telaLarga && (
            <Tabs defaultValue="perguntas">
              <TabsList className="mb-4 w-full">
                <TabsTrigger value="perguntas">Perguntas</TabsTrigger>
                <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
                <TabsTrigger value="atividades">Atividades</TabsTrigger>
              </TabsList>
              <TabsContent value="perguntas">
                <MuralDePerguntas sessao={sessao} perguntas={dados.perguntas} aberta={aberta} aoMudar={recarregar} />
              </TabsContent>
              <TabsContent value="mensagens">
                <FeedDeMensagens
                  sessao={sessao}
                  mensagens={dados.mensagens}
                  aberta={aberta}
                  fuso={turma.fuso}
                  aoMudar={recarregar}
                />
              </TabsContent>
              <TabsContent value="atividades">
                <ListaDeAtividades atividades={dados.atividades} aoAbrir={setAtividadeAberta} />
              </TabsContent>
            </Tabs>
            )}

            {telaLarga && (
            <div className="grid grid-cols-[1.3fr_1fr] gap-8">
              <section aria-labelledby="titulo-perguntas" className="flex flex-col gap-4">
                <h2 id="titulo-perguntas" className="text-[22px]">
                  Perguntas
                </h2>
                <MuralDePerguntas sessao={sessao} perguntas={dados.perguntas} aberta={aberta} aoMudar={recarregar} />
              </section>
              <section aria-labelledby="titulo-mensagens" className="flex flex-col gap-4">
                <h2 id="titulo-mensagens" className="text-[22px]">
                  Mensagens
                </h2>
                <FeedDeMensagens
                  sessao={sessao}
                  mensagens={dados.mensagens}
                  aberta={aberta}
                  fuso={turma.fuso}
                  aoMudar={recarregar}
                />
              </section>
              <section aria-labelledby="titulo-atividades" className="col-span-2 flex flex-col gap-4">
                <h2 id="titulo-atividades" className="text-[22px]">
                  Atividades
                </h2>
                <ListaDeAtividades atividades={dados.atividades} aoAbrir={setAtividadeAberta} />
              </section>
            </div>
            )}
          </>
        )}
      </main>

      {/* Não bloqueante: dá para fechar e voltar pelo aviso ou pela lista. */}
      <Dialog open={atividadeAberta !== null} onOpenChange={(aberto) => !aberto && fecharAtividade()} modal={false}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="font-mono text-[22px] font-bold">{tituloAtividade}</DialogTitle>
            <DialogDescription>Suas respostas vão direto para o professor.</DialogDescription>
          </DialogHeader>
          {atividadeAberta && <RespostaDaAtividade atividadeId={atividadeAberta} aoResponder={recarregar} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
