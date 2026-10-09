import { ArchiveIcon, ArchiveRestoreIcon, CircleHelpIcon, Loader2Icon, PaperclipIcon, SearchXIcon } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Busca, CabecalhoDaPagina, Carregado, FiltroDeLista, Vazio } from '@/componentes/plataforma/Blocos'
import { comLink, InserirLink, TextoComLinks } from '@/componentes/plataforma/Links'
import { assinarMudancas, urlAssinada } from '@/dados/apoio'
import { definirStatusDaDuvida, listarDuvidas, responderDuvida, type DuvidaDoProfessor } from '@/dados/professor'
import { contem } from '@/dominio/busca'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'

const FUSO = 'America/Sao_Paulo'
const ROTULO_STATUS = { aberta: 'Pendente', respondida: 'Respondida', arquivada: 'Arquivada' } as const

type Filtro = DuvidaDoProfessor['status'] | 'todas'

function Resposta({ duvida, aoSalvar }: { duvida: DuvidaDoProfessor; aoSalvar: () => void }) {
  const id = useId()
  const [texto, setTexto] = useState(duvida.resposta ?? '')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    if (texto.trim().length < 2) return setErro('Escreva a resposta.')
    setEnviando(true)
    setErro(null)
    try {
      await responderDuvida(duvida.id, texto)
      toast.success('Resposta enviada', { description: `${duvida.aluno} recebe uma notificação.` })
      aoSalvar()
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-2 border-t-2 pt-4">
      <Label htmlFor={`${id}-resposta`}>{duvida.resposta ? 'Editar resposta' : 'Sua resposta'}</Label>
      <Textarea id={`${id}-resposta`} rows={4} maxLength={4000} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <InserirLink aoInserir={(trecho) => setTexto((atual) => comLink(atual, trecho))} />
        <span className="text-xs text-muted-foreground">Endereços que começam com https:// também viram link.</span>
      </div>
      {erro && (
        <p role="alert" className="text-[13px] font-semibold text-destructive">
          {erro}
        </p>
      )}
      <Button type="submit" size="sm" disabled={enviando} className="self-end">
        {enviando && <Loader2Icon className="animate-spin" aria-hidden="true" />}
        {duvida.resposta ? 'Salvar resposta' : 'Responder'}
      </Button>
    </form>
  )
}

async function abrirAnexo(caminho: string) {
  try {
    window.open(await urlAssinada(caminho), '_blank', 'noopener,noreferrer')
  } catch (falha) {
    toast.error((falha as Error).message)
  }
}

/** Dúvidas que os alunos enviaram ao professor. */
export default function Duvidas() {
  const consulta = useConsulta(listarDuvidas, [])
  const { recarregar } = consulta
  // Dúvida nova de um aluno entra na lista na hora.
  useEffect(() => assinarMudancas('duvida', recarregar), [recarregar])
  const [filtro, setFiltro] = useState<Filtro>('aberta')
  const [busca, setBusca] = useState('')
  const [respondendo, setRespondendo] = useState<string | null>(null)

  async function mudarStatus(duvida: DuvidaDoProfessor, status: 'aberta' | 'arquivada') {
    try {
      await definirStatusDaDuvida(duvida.id, status)
      toast.success(status === 'arquivada' ? 'Dúvida arquivada' : 'Dúvida reaberta')
      consulta.recarregar()
    } catch (falha) {
      toast.error((falha as Error).message)
    }
  }

  return (
    <>
      <CabecalhoDaPagina rotulo="Comunicação" titulo="Dúvidas" descricao="Perguntas dos alunos. A resposta chega só para quem perguntou.">
        <Busca valor={busca} aoMudar={setBusca} rotulo="Pesquisar dúvidas" />
      </CabecalhoDaPagina>

      <Carregado consulta={consulta}>
        {(duvidas) => {
          const pendentes = duvidas.filter((d) => d.status === 'aberta').length
          const visiveis = duvidas.filter(
            (d) => (filtro === 'todas' || d.status === filtro) && contem(busca, d.titulo, d.pergunta, d.aluno, d.categoria),
          )

          return (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <FiltroDeLista
                  rotulo="Filtrar por status"
                  valor={filtro}
                  aoMudar={setFiltro}
                  opcoes={[
                    ['aberta', 'Pendentes'],
                    ['respondida', 'Respondidas'],
                    ['arquivada', 'Arquivadas'],
                    ['todas', 'Todas'],
                  ]}
                />
                <p className="text-sm text-muted-foreground">
                  <span className="destaque text-base text-foreground">{pendentes}</span> {pendentes === 1 ? 'pendente' : 'pendentes'}
                </p>
              </div>

              {duvidas.length === 0 ? (
                <Vazio icone={CircleHelpIcon} titulo="Nenhuma dúvida recebida" texto="Quando um aluno enviar uma dúvida, ela aparece aqui." />
              ) : visiveis.length === 0 ? (
                <Vazio icone={SearchXIcon} titulo="Nada neste filtro" texto="Troque o filtro ou o termo da pesquisa." />
              ) : (
                <ul className="flex flex-col gap-4">
                  {visiveis.map((d) => (
                    <li key={d.id}>
                      <Card>
                        <CardContent className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={d.status === 'respondida' ? 'green' : d.status === 'arquivada' ? 'neutro' : 'orange'}>
                              {ROTULO_STATUS[d.status]}
                            </Badge>
                            {d.categoria && <Badge variant="outline">{d.categoria}</Badge>}
                            <span className="text-sm font-semibold">{d.aluno}</span>
                            <span className="font-mono text-xs text-muted-foreground">{d.turma_codigo}</span>
                            <span className="ml-auto font-mono text-xs text-muted-foreground">{formatarDataHora(d.created_at, FUSO)}</span>
                          </div>
                          <h2 className="text-[19px]">{d.titulo}</h2>
                          {d.conteudo && <p className="text-xs text-muted-foreground">Sobre: {d.conteudo}</p>}
                          <TextoComLinks texto={d.pergunta} className="text-[15px]" />
                          {d.anexo_path && (
                            <Button variant="link" size="sm" className="self-start px-0" onClick={() => void abrirAnexo(d.anexo_path!)}>
                              <PaperclipIcon aria-hidden="true" />
                              Ver anexo
                            </Button>
                          )}

                          {d.resposta && respondendo !== d.id && (
                            <div className="flex flex-col gap-1 border-l-2 border-primary bg-muted py-3 pr-3 pl-4">
                              <p className="eyebrow text-muted-foreground">
                                Sua resposta{d.respondida_em && ` · ${formatarDataHora(d.respondida_em, FUSO)}`}
                              </p>
                              <TextoComLinks texto={d.resposta} className="text-[15px]" />
                            </div>
                          )}

                          {respondendo === d.id ? (
                            <Resposta
                              duvida={d}
                              aoSalvar={() => {
                                setRespondendo(null)
                                consulta.recarregar()
                              }}
                            />
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant={d.resposta ? 'outline' : 'default'} onClick={() => setRespondendo(d.id)}>
                                {d.resposta ? 'Editar resposta' : 'Responder'}
                              </Button>
                              {d.status === 'arquivada' ? (
                                <Button size="sm" variant="ghost" onClick={() => void mudarStatus(d, 'aberta')}>
                                  <ArchiveRestoreIcon aria-hidden="true" />
                                  Reabrir
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" onClick={() => void mudarStatus(d, 'arquivada')}>
                                  <ArchiveIcon aria-hidden="true" />
                                  Arquivar
                                </Button>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        }}
      </Carregado>
    </>
  )
}
