import { BookOpenIcon, EyeIcon, EyeOffIcon, Loader2Icon, PaperclipIcon, PencilIcon, PlusIcon, SearchXIcon, Trash2Icon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Busca, CabecalhoDaPagina, Carregado, Vazio } from '@/componentes/plataforma/Blocos'
import { Confirmar, type Confirmacao } from '@/componentes/plataforma/Confirmar'
import { ROTULO_TIPO_CONTEUDO, urlAssinada, type Conteudo, type TipoConteudo } from '@/dados/apoio'
import { excluirConteudo, listarTodosOsConteudos, listarTurmas, salvarConteudo, type DadosDoConteudo } from '@/dados/professor'
import { contem } from '@/dominio/busca'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'
import { paraCampoDeData, paraInstante } from './datas'

const FUSO = 'America/Sao_Paulo'
const TODAS = 'todas'
const ARQUIVO_MAXIMO_MB = 25

type Filtro = 'todos' | 'aulas' | 'extras' | 'materiais'
type TurmaSimples = { id: string; codigo: string }

async function carregar() {
  const [conteudos, turmas] = await Promise.all([listarTodosOsConteudos(), listarTurmas()])
  return { conteudos, turmas }
}

function noFiltro(c: Conteudo, filtro: Filtro) {
  if (filtro === 'todos') return true
  if (filtro === 'aulas') return c.tipo === 'aula'
  if (filtro === 'extras') return c.tipo === 'aula_extra'
  return c.tipo !== 'aula' && c.tipo !== 'aula_extra'
}

function FormularioDoConteudo({
  conteudo,
  turmas,
  aoFechar,
}: {
  conteudo: Conteudo | null
  turmas: TurmaSimples[]
  aoFechar: (feito: boolean) => void
}) {
  const id = useId()
  const [dados, setDados] = useState<DadosDoConteudo>({
    turma_id: conteudo?.turma_id ?? null,
    tipo: conteudo?.tipo ?? 'aula_extra',
    titulo: conteudo?.titulo ?? '',
    descricao: conteudo?.descricao ?? '',
    corpo_md: conteudo?.corpo_md ?? '',
    video_url: conteudo?.video_url ?? '',
    link_url: conteudo?.link_url ?? '',
    publicado: conteudo?.publicado ?? true,
    publicado_em: conteudo?.publicado_em ?? null,
    capa: null,
    arquivo: null,
  })
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const mudar = (parte: Partial<DadosDoConteudo>) => setDados((atual) => ({ ...atual, ...parte }))

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    if (dados.titulo.trim().length < 3) return setErro('Dê um título ao conteúdo.')
    for (const url of [dados.video_url, dados.link_url]) {
      if (url.trim() !== '' && !/^https?:\/\//i.test(url.trim())) return setErro('Os links precisam começar com http:// ou https://.')
    }
    for (const arquivo of [dados.capa, dados.arquivo]) {
      if (arquivo && arquivo.size > ARQUIVO_MAXIMO_MB * 1024 * 1024) return setErro(`Cada arquivo pode ter até ${ARQUIVO_MAXIMO_MB} MB.`)
    }
    setEnviando(true)
    setErro(null)
    try {
      await salvarConteudo(dados, conteudo ?? undefined)
      toast.success(conteudo ? 'Conteúdo atualizado' : dados.publicado ? 'Conteúdo publicado' : 'Rascunho salvo', {
        description: !conteudo && dados.publicado ? 'Os alunos da turma recebem uma notificação.' : undefined,
      })
      aoFechar(true)
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar(false)}>
      <DialogContent className="plataforma max-h-[92vh] min-h-0 overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-[22px] font-bold">{conteudo ? 'Editar conteúdo' : 'Novo conteúdo'}</DialogTitle>
          <DialogDescription>Texto, vídeo, link e arquivo podem ser combinados no mesmo conteúdo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-tipo`}>Tipo</Label>
              <Select value={dados.tipo} onValueChange={(v) => mudar({ tipo: v as TipoConteudo })}>
                <SelectTrigger id={`${id}-tipo`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROTULO_TIPO_CONTEUDO).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-turma`}>Turma</Label>
              <Select value={dados.turma_id ?? TODAS} onValueChange={(v) => mudar({ turma_id: v === TODAS ? null : v })}>
                <SelectTrigger id={`${id}-turma`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas as turmas</SelectItem>
                  {turmas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-titulo`}>Título</Label>
            <Input id={`${id}-titulo`} maxLength={160} value={dados.titulo} onChange={(e) => mudar({ titulo: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-descricao`}>Descrição</Label>
            <Textarea id={`${id}-descricao`} rows={2} maxLength={400} value={dados.descricao} onChange={(e) => mudar({ descricao: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-corpo`}>Conteúdo em texto (aceita Markdown)</Label>
            <Textarea
              id={`${id}-corpo`}
              rows={8}
              className="font-mono text-[13px]"
              value={dados.corpo_md}
              onChange={(e) => mudar({ corpo_md: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-video`}>Link do vídeo (opcional)</Label>
              <Input id={`${id}-video`} type="url" placeholder="https://" value={dados.video_url} onChange={(e) => mudar({ video_url: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-link`}>Link externo (opcional)</Label>
              <Input id={`${id}-link`} type="url" placeholder="https://" value={dados.link_url} onChange={(e) => mudar({ link_url: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-capa`}>Capa (opcional)</Label>
              <Input id={`${id}-capa`} type="file" accept="image/*" onChange={(e) => mudar({ capa: e.target.files?.[0] ?? null })} />
              {conteudo?.capa_path && !dados.capa && <p className="text-xs text-muted-foreground">Já tem capa. Envie outra para trocar.</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-arquivo`}>Arquivo (opcional, até {ARQUIVO_MAXIMO_MB} MB)</Label>
              <Input id={`${id}-arquivo`} type="file" onChange={(e) => mudar({ arquivo: e.target.files?.[0] ?? null })} />
              {conteudo?.arquivo_path && !dados.arquivo && <p className="text-xs text-muted-foreground">Já tem arquivo. Envie outro para trocar.</p>}
            </div>
          </div>
          <div className="grid gap-4 border-t-2 pt-4 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <Switch id={`${id}-publicado`} checked={dados.publicado} onCheckedChange={(v) => mudar({ publicado: v })} />
              <Label htmlFor={`${id}-publicado`}>{dados.publicado ? 'Publicado para os alunos' : 'Rascunho (só você vê)'}</Label>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-data`}>Data de publicação (opcional)</Label>
              <Input
                id={`${id}-data`}
                type="datetime-local"
                value={paraCampoDeData(dados.publicado_em)}
                onChange={(e) => mudar({ publicado_em: paraInstante(e.target.value) })}
              />
            </div>
          </div>
          {erro && (
            <p role="alert" className="text-[13px] font-semibold text-destructive">
              {erro}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => aoFechar(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando && <Loader2Icon className="animate-spin" aria-hidden="true" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

async function abrirArquivo(caminho: string) {
  try {
    window.open(await urlAssinada(caminho), '_blank', 'noopener,noreferrer')
  } catch (falha) {
    toast.error((falha as Error).message)
  }
}

/** Conteúdos e aulas extras: o professor publica, o aluno da turma vê. */
export default function Conteudos() {
  const consulta = useConsulta(carregar, [])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [formulario, setFormulario] = useState<{ conteudo: Conteudo | null } | null>(null)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)
  const [agora] = useState(() => Date.now())

  async function alternarPublicacao(c: Conteudo) {
    try {
      await salvarConteudo(
        {
          turma_id: c.turma_id,
          tipo: c.tipo,
          titulo: c.titulo,
          descricao: c.descricao ?? '',
          corpo_md: c.corpo_md ?? '',
          video_url: c.video_url ?? '',
          link_url: c.link_url ?? '',
          publicado: !c.publicado,
          publicado_em: c.publicado_em,
          capa: null,
          arquivo: null,
        },
        c,
      )
      toast.success(c.publicado ? 'Conteúdo voltou para rascunho' : 'Conteúdo publicado')
      consulta.recarregar()
    } catch (falha) {
      toast.error((falha as Error).message)
    }
  }

  return (
    <>
      <CabecalhoDaPagina rotulo="Ensino" titulo="Conteúdos" descricao="Aulas, aulas extras e materiais de apoio para os alunos.">
        <Busca valor={busca} aoMudar={setBusca} rotulo="Pesquisar conteúdos" />
        <Button onClick={() => setFormulario({ conteudo: null })}>
          <PlusIcon aria-hidden="true" />
          Novo conteúdo
        </Button>
      </CabecalhoDaPagina>

      <Carregado consulta={consulta}>
        {({ conteudos, turmas }) => {
          const codigoDaTurma = new Map(turmas.map((t) => [t.id, t.codigo]))
          const visiveis = conteudos.filter((c) => noFiltro(c, filtro) && contem(busca, c.titulo, c.descricao))

          return (
            <>
              <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
                <TabsList className="h-auto flex-wrap">
                  <TabsTrigger value="todos">Todos</TabsTrigger>
                  <TabsTrigger value="aulas">Aulas</TabsTrigger>
                  <TabsTrigger value="extras">Aulas extras</TabsTrigger>
                  <TabsTrigger value="materiais">Materiais</TabsTrigger>
                </TabsList>
              </Tabs>

              {conteudos.length === 0 ? (
                <Vazio icone={BookOpenIcon} titulo="Nenhum conteúdo ainda" texto="Publique uma aula extra, um texto, um vídeo ou um arquivo para a turma.">
                  <Button size="sm" onClick={() => setFormulario({ conteudo: null })}>
                    Novo conteúdo
                  </Button>
                </Vazio>
              ) : visiveis.length === 0 ? (
                <Vazio icone={SearchXIcon} titulo="Nada neste filtro" texto="Troque o filtro ou o termo da pesquisa." />
              ) : (
                <ul className="flex flex-col gap-4">
                  {visiveis.map((c) => {
                    const agendado = c.publicado && c.publicado_em !== null && new Date(c.publicado_em).getTime() > agora
                    return (
                      <li key={c.id}>
                        <Card>
                          <CardContent className="flex flex-wrap items-start gap-4">
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{ROTULO_TIPO_CONTEUDO[c.tipo]}</Badge>
                                <Badge variant={!c.publicado ? 'neutro' : agendado ? 'violet' : 'green'}>
                                  {!c.publicado ? 'Rascunho' : agendado ? 'Agendado' : 'Publicado'}
                                </Badge>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {c.turma_id ? (codigoDaTurma.get(c.turma_id) ?? 'Turma') : 'Todas as turmas'}
                                </span>
                              </div>
                              <h2 className="text-[19px]">{c.titulo}</h2>
                              {c.descricao && <p className="text-sm text-muted-foreground">{c.descricao}</p>}
                              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                                {c.publicado_em && <span>{agendado ? 'Publica em' : 'Publicado em'} {formatarDataHora(c.publicado_em, FUSO)}</span>}
                                {c.arquivo_path && (
                                  <button type="button" className="inline-flex items-center gap-1.5 underline underline-offset-[3px]" onClick={() => void abrirArquivo(c.arquivo_path!)}>
                                    <PaperclipIcon aria-hidden="true" className="size-3.5" />
                                    Arquivo
                                  </button>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="outline" onClick={() => void alternarPublicacao(c)}>
                                {c.publicado ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
                                {c.publicado ? 'Despublicar' : 'Publicar'}
                              </Button>
                              <Button size="icon-sm" variant="ghost" aria-label={`Editar ${c.titulo}`} onClick={() => setFormulario({ conteudo: c })}>
                                <PencilIcon />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Excluir ${c.titulo}`}
                                onClick={() =>
                                  setConfirmacao({
                                    titulo: `Excluir "${c.titulo}"?`,
                                    texto: 'O conteúdo some para os alunos e o registro de acessos é apagado. Esta ação não pode ser desfeita.',
                                    acao: 'Excluir',
                                    destrutiva: true,
                                    executar: () => excluirConteudo(c.id),
                                    sucesso: 'Conteúdo excluído',
                                  })
                                }
                              >
                                <Trash2Icon />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </li>
                    )
                  })}
                </ul>
              )}

              {formulario && (
                <FormularioDoConteudo
                  conteudo={formulario.conteudo}
                  turmas={turmas}
                  aoFechar={(feito) => {
                    setFormulario(null)
                    if (feito) consulta.recarregar()
                  }}
                />
              )}
            </>
          )
        }}
      </Carregado>

      <Confirmar
        pedido={confirmacao}
        aoFechar={(feito) => {
          setConfirmacao(null)
          if (feito) consulta.recarregar()
        }}
      />
    </>
  )
}
