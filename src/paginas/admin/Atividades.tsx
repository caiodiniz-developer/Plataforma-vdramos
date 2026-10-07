import {
  ClipboardListIcon,
  ClockIcon,
  ListChecksIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  SearchXIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Busca, CabecalhoDaPagina, Carregado, Vazio } from '@/componentes/plataforma/Blocos'
import { Confirmar, type Confirmacao } from '@/componentes/plataforma/Confirmar'
import type { Conteudo } from '@/dados/apoio'
import {
  encerrarAtividade,
  excluirAtividade,
  listarAtividades,
  listarTodosOsConteudos,
  listarTurmas,
  publicarAtividade,
  respostasDaAtividade,
  salvarAtividade,
  type AtividadeDoProfessor,
  type DadosDaAtividade,
  type ItemEditavel,
} from '@/dados/professor'
import { problemasDaAtividade, ROTULO_STATUS_ATIVIDADE, type TipoResposta } from '@/dominio/atividade'
import { contem } from '@/dominio/busca'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'
import { paraCampoDeData, paraInstante } from './datas'

const FUSO = 'America/Sao_Paulo'
const NENHUM = 'nenhum'
const ROTULO_DIFICULDADE = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' } as const
const ROTULO_RESPOSTA: Partial<Record<TipoResposta, string>> = {
  texto_livre: 'Resposta em texto',
  escolha_unica: 'Uma alternativa',
  escolha_multipla: 'Várias alternativas',
}

type Modo = 'atividades' | 'questoes'
type Filtro = 'todas' | 'rascunho' | 'publicada' | 'encerrada'
type TurmaSimples = { id: string; codigo: string }

const ehEscolha = (tipo: TipoResposta) => tipo === 'escolha_unica' || tipo === 'escolha_multipla'

function itemNovo(tipo: TipoResposta): ItemEditavel {
  return {
    enunciado: '',
    tipo_resposta: tipo,
    obrigatorio: true,
    explicacao: '',
    opcoes: ehEscolha(tipo)
      ? [
          { texto: '', correta: false },
          { texto: '', correta: false },
          { texto: '', correta: false },
          { texto: '', correta: false },
        ]
      : [],
  }
}

async function carregar(modo: Modo) {
  const [atividades, turmas, conteudos] = await Promise.all([listarAtividades(modo), listarTurmas(), listarTodosOsConteudos()])
  return { atividades, turmas, conteudos }
}

/** Um item da atividade: enunciado, tipo de resposta, alternativas e explicação. */
function EditorDoItem({
  item,
  numero,
  corrigido,
  fixo,
  travado,
  aoMudar,
  aoRemover,
}: {
  item: ItemEditavel
  numero: number
  /** Quiz e questão têm gabarito. */
  corrigido: boolean
  /** Questão avulsa: um item só, sempre de alternativas. */
  fixo: boolean
  travado: boolean
  aoMudar: (item: ItemEditavel) => void
  aoRemover?: () => void
}) {
  const id = useId()
  const escolha = ehEscolha(item.tipo_resposta)

  function marcarCorreta(indice: number, marcada: boolean) {
    aoMudar({
      ...item,
      opcoes: item.opcoes.map((o, i) =>
        i === indice ? { ...o, correta: marcada } : item.tipo_resposta === 'escolha_unica' && marcada ? { ...o, correta: false } : o,
      ),
    })
  }

  return (
    <fieldset disabled={travado} className="flex flex-col gap-3 border-2 p-4 disabled:opacity-70">
      <legend className="eyebrow px-2 text-muted-foreground">{fixo ? 'Questão' : `Item ${numero}`}</legend>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-enunciado`}>Enunciado</Label>
        <Textarea
          id={`${id}-enunciado`}
          rows={2}
          maxLength={1000}
          value={item.enunciado}
          onChange={(e) => aoMudar({ ...item, enunciado: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-tipo`}>Tipo de resposta</Label>
          <Select
            value={item.tipo_resposta}
            onValueChange={(v) => {
              const tipo = v as TipoResposta
              aoMudar({ ...item, tipo_resposta: tipo, opcoes: ehEscolha(tipo) ? (item.opcoes.length > 0 ? item.opcoes.map((o) => ({ ...o, correta: false })) : itemNovo(tipo).opcoes) : [] })
            }}
          >
            <SelectTrigger id={`${id}-tipo`} className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROTULO_RESPOSTA)
                .filter(([valor]) => !fixo || valor !== 'texto_livre')
                .map(([valor, rotulo]) => (
                  <SelectItem key={valor} value={valor}>
                    {rotulo}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        {aoRemover && (
          <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={aoRemover}>
            <Trash2Icon aria-hidden="true" />
            Remover item
          </Button>
        )}
      </div>

      {escolha && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Alternativas{corrigido ? ' (marque a correta)' : ''}</p>
          {item.opcoes.map((opcao, indice) => (
            <div key={indice} className="flex items-center gap-2">
              {corrigido && (
                <Checkbox
                  aria-label={`Alternativa ${indice + 1} é a correta`}
                  checked={opcao.correta}
                  onCheckedChange={(v) => marcarCorreta(indice, v === true)}
                />
              )}
              <Input
                aria-label={`Alternativa ${indice + 1}`}
                maxLength={300}
                placeholder={`Alternativa ${indice + 1}`}
                value={opcao.texto}
                onChange={(e) => aoMudar({ ...item, opcoes: item.opcoes.map((o, i) => (i === indice ? { ...o, texto: e.target.value } : o)) })}
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Remover alternativa ${indice + 1}`}
                disabled={item.opcoes.length <= 2}
                onClick={() => aoMudar({ ...item, opcoes: item.opcoes.filter((_, i) => i !== indice) })}
              >
                <XIcon />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-start"
            disabled={item.opcoes.length >= 8}
            onClick={() => aoMudar({ ...item, opcoes: [...item.opcoes, { texto: '', correta: false }] })}
          >
            <PlusIcon aria-hidden="true" />
            Alternativa
          </Button>
        </div>
      )}

      {corrigido && escolha && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-explicacao`}>Explicação (o aluno vê depois de responder)</Label>
          <Textarea
            id={`${id}-explicacao`}
            rows={2}
            maxLength={1000}
            value={item.explicacao}
            onChange={(e) => aoMudar({ ...item, explicacao: e.target.value })}
          />
        </div>
      )}
    </fieldset>
  )
}

function EditorDaAtividade({
  modo,
  atividade,
  turmas,
  conteudos,
  aoFechar,
}: {
  modo: Modo
  atividade: AtividadeDoProfessor | null
  turmas: TurmaSimples[]
  conteudos: Conteudo[]
  aoFechar: (feito: boolean) => void
}) {
  const id = useId()
  const ehQuestao = modo === 'questoes'
  const [dados, setDados] = useState<DadosDaAtividade>({
    turma_id: atividade?.turma_id ?? turmas[0]?.id ?? '',
    tipo: atividade?.tipo ?? (ehQuestao ? 'questao' : 'licao'),
    titulo: atividade?.titulo ?? '',
    descricao: atividade?.descricao ?? '',
    instrucoes_md: atividade?.instrucoes_md ?? '',
    prazo_em: atividade?.prazo_em ?? null,
    dificuldade: atividade?.dificuldade ?? null,
    categoria: atividade?.categoria ?? '',
    conteudo_id: atividade?.conteudo_id ?? null,
    arquivo: null,
    itens: atividade && atividade.itens.length > 0 ? atividade.itens : [itemNovo(ehQuestao ? 'escolha_unica' : 'texto_livre')],
  })
  const [problemas, setProblemas] = useState<string[]>([])
  const [enviando, setEnviando] = useState<'salvar' | 'publicar' | null>(null)
  const mudar = (parte: Partial<DadosDaAtividade>) => setDados((atual) => ({ ...atual, ...parte }))

  const travado = (atividade?.respondentes ?? 0) > 0
  const corrigido = dados.tipo === 'quiz' || dados.tipo === 'questao'
  const rascunho = !atividade || atividade.status === 'rascunho'

  async function salvar(publicar: boolean) {
    if (enviando) return
    const encontrados = problemasDaAtividade({ tipo: dados.tipo, titulo: dados.titulo, alvo: null, itens: dados.itens })
    if (!dados.turma_id) encontrados.unshift('Escolha a turma.')
    if (encontrados.length > 0) return setProblemas(encontrados)
    setProblemas([])
    setEnviando(publicar ? 'publicar' : 'salvar')
    try {
      const atividadeId = await salvarAtividade(dados, atividade ?? undefined)
      if (publicar) await publicarAtividade(atividadeId)
      toast.success(publicar ? (ehQuestao ? 'Questão publicada' : 'Atividade publicada') : 'Alterações salvas', {
        description: publicar ? 'Os alunos da turma recebem uma notificação.' : undefined,
      })
      aoFechar(true)
    } catch (falha) {
      setProblemas([(falha as Error).message])
    } finally {
      setEnviando(null)
    }
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    void salvar(false)
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar(false)}>
      <DialogContent className="plataforma max-h-[92vh] min-h-0 overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-[22px] font-bold">
            {atividade ? (ehQuestao ? 'Editar questão' : 'Editar atividade') : ehQuestao ? 'Nova questão' : 'Nova atividade'}
          </DialogTitle>
          <DialogDescription>
            {travado
              ? 'Já existem respostas: dá para ajustar os dados gerais, mas os itens ficam travados.'
              : ehQuestao
                ? 'O aluno responde e vê na hora se acertou, com a sua explicação.'
                : 'Uma lição com perguntas abertas ou um quiz com correção automática.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-turma`}>Turma</Label>
              <Select value={dados.turma_id} onValueChange={(v) => mudar({ turma_id: v })} disabled={!rascunho}>
                <SelectTrigger id={`${id}-turma`}>
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {turmas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!ehQuestao && (
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-tipo`}>Formato</Label>
                <Select value={dados.tipo} onValueChange={(v) => mudar({ tipo: v as DadosDaAtividade['tipo'] })} disabled={travado}>
                  <SelectTrigger id={`${id}-tipo`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="licao">Lição (sem correção automática)</SelectItem>
                    <SelectItem value="quiz">Quiz (com gabarito)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-titulo`}>Título</Label>
            <Input id={`${id}-titulo`} maxLength={160} value={dados.titulo} onChange={(e) => mudar({ titulo: e.target.value })} />
          </div>

          {!ehQuestao && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-descricao`}>Descrição</Label>
                <Textarea id={`${id}-descricao`} rows={2} maxLength={400} value={dados.descricao} onChange={(e) => mudar({ descricao: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-instrucoes`}>Instruções (aceita Markdown)</Label>
                <Textarea
                  id={`${id}-instrucoes`}
                  rows={4}
                  className="font-mono text-[13px]"
                  value={dados.instrucoes_md}
                  onChange={(e) => mudar({ instrucoes_md: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${id}-prazo`}>Prazo (opcional)</Label>
                  <Input
                    id={`${id}-prazo`}
                    type="datetime-local"
                    value={paraCampoDeData(dados.prazo_em)}
                    onChange={(e) => mudar({ prazo_em: paraInstante(e.target.value) })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${id}-arquivo`}>Arquivo (opcional)</Label>
                  <Input id={`${id}-arquivo`} type="file" onChange={(e) => mudar({ arquivo: e.target.files?.[0] ?? null })} />
                  {atividade?.arquivo_path && !dados.arquivo && <p className="text-xs text-muted-foreground">Já tem arquivo. Envie outro para trocar.</p>}
                </div>
              </div>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-dificuldade`}>Dificuldade</Label>
              <Select
                value={dados.dificuldade ?? NENHUM}
                onValueChange={(v) => mudar({ dificuldade: v === NENHUM ? null : (v as DadosDaAtividade['dificuldade']) })}
              >
                <SelectTrigger id={`${id}-dificuldade`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>Não informar</SelectItem>
                  {Object.entries(ROTULO_DIFICULDADE).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-categoria`}>Categoria</Label>
              <Input
                id={`${id}-categoria`}
                maxLength={40}
                placeholder="Ex.: JavaScript"
                value={dados.categoria}
                onChange={(e) => mudar({ categoria: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-conteudo`}>Conteúdo relacionado</Label>
              <Select value={dados.conteudo_id ?? NENHUM} onValueChange={(v) => mudar({ conteudo_id: v === NENHUM ? null : v })}>
                <SelectTrigger id={`${id}-conteudo`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>Nenhum</SelectItem>
                  {conteudos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {dados.itens.map((item, indice) => (
            <EditorDoItem
              key={indice}
              item={item}
              numero={indice + 1}
              corrigido={corrigido}
              fixo={ehQuestao}
              travado={travado}
              aoMudar={(novo) => mudar({ itens: dados.itens.map((atual, i) => (i === indice ? novo : atual)) })}
              aoRemover={!ehQuestao && dados.itens.length > 1 ? () => mudar({ itens: dados.itens.filter((_, i) => i !== indice) }) : undefined}
            />
          ))}
          {!ehQuestao && !travado && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => mudar({ itens: [...dados.itens, itemNovo(dados.tipo === 'quiz' ? 'escolha_unica' : 'texto_livre')] })}
            >
              <PlusIcon aria-hidden="true" />
              Adicionar item
            </Button>
          )}

          {problemas.length > 0 && (
            <ul role="alert" className="flex flex-col gap-1 text-[13px] font-semibold text-destructive">
              {problemas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => aoFechar(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant={rascunho ? 'secondary' : 'default'} disabled={enviando !== null}>
              {enviando === 'salvar' && <Loader2Icon className="animate-spin" aria-hidden="true" />}
              {rascunho ? 'Salvar rascunho' : 'Salvar'}
            </Button>
            {rascunho && (
              <Button type="button" disabled={enviando !== null} onClick={() => void salvar(true)}>
                {enviando === 'publicar' && <Loader2Icon className="animate-spin" aria-hidden="true" />}
                Salvar e publicar
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Respostas recebidas, agrupadas por aluno. */
function RespostasRecebidas({ atividade, aoFechar }: { atividade: AtividadeDoProfessor; aoFechar: () => void }) {
  const consulta = useConsulta(() => respostasDaAtividade(atividade.id), [atividade.id])

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="plataforma max-h-[92vh] min-h-0 overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-[22px] font-bold">Respostas</DialogTitle>
          <DialogDescription>{atividade.titulo}</DialogDescription>
        </DialogHeader>
        <Carregado consulta={consulta}>
          {(respostas) => {
            if (respostas.length === 0) return <Vazio icone={UsersIcon} titulo="Ninguém respondeu ainda" />
            const porAluno = new Map<string, typeof respostas>()
            for (const r of respostas) porAluno.set(r.aluno, [...(porAluno.get(r.aluno) ?? []), r])
            return (
              <ul className="flex flex-col gap-4">
                {[...porAluno.entries()].map(([aluno, linhas]) => {
                  const corrigidas = linhas.filter((l) => l.correta !== null)
                  return (
                    <li key={aluno} className="flex flex-col gap-2 border-2 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{aluno}</span>
                        {corrigidas.length > 0 && (
                          <Badge variant="outline">
                            {corrigidas.filter((l) => l.correta).length}/{corrigidas.length} acertos
                          </Badge>
                        )}
                        <span className="ml-auto font-mono text-[11px] text-muted-foreground">{formatarDataHora(linhas[0].created_at, FUSO)}</span>
                      </div>
                      <ol className="flex flex-col gap-2">
                        {linhas.map((l) => (
                          <li key={l.item} className="flex flex-col gap-1 border-t border-divisor pt-2 text-sm">
                            <span className="text-muted-foreground">
                              {l.item}. {l.enunciado}
                            </span>
                            <span className="flex flex-wrap items-center gap-2 whitespace-pre-wrap">
                              {l.opcoes ?? l.texto ?? (l.valor !== null ? String(l.valor) : '—')}
                              {l.correta !== null && <Badge variant={l.correta ? 'green' : 'orange'}>{l.correta ? 'Certa' : 'Errada'}</Badge>}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </li>
                  )
                })}
              </ul>
            )
          }}
        </Carregado>
      </DialogContent>
    </Dialog>
  )
}

function ListaDoProfessor({ modo }: { modo: Modo }) {
  const ehQuestao = modo === 'questoes'
  const consulta = useConsulta(() => carregar(modo), [modo])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [editor, setEditor] = useState<{ atividade: AtividadeDoProfessor | null } | null>(null)
  const [respostas, setRespostas] = useState<AtividadeDoProfessor | null>(null)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)
  const nome = ehQuestao ? 'questão' : 'atividade'

  async function publicar(a: AtividadeDoProfessor) {
    try {
      await publicarAtividade(a.id)
      toast.success(ehQuestao ? 'Questão publicada' : 'Atividade publicada')
      consulta.recarregar()
    } catch (falha) {
      toast.error((falha as Error).message)
    }
  }

  return (
    <>
      <CabecalhoDaPagina
        rotulo="Ensino"
        titulo={ehQuestao ? 'Questões' : 'Atividades'}
        descricao={
          ehQuestao
            ? 'Questões de múltipla escolha com gabarito e explicação.'
            : 'Lições e quizzes para a turma, com prazo opcional. Você vê as respostas de cada aluno.'
        }
      >
        <Busca valor={busca} aoMudar={setBusca} rotulo={ehQuestao ? 'Pesquisar questões' : 'Pesquisar atividades'} />
        <Button onClick={() => setEditor({ atividade: null })}>
          <PlusIcon aria-hidden="true" />
          {ehQuestao ? 'Nova questão' : 'Nova atividade'}
        </Button>
      </CabecalhoDaPagina>

      <Carregado consulta={consulta}>
        {({ atividades, turmas, conteudos }) => {
          const codigoDaTurma = new Map(turmas.map((t) => [t.id, t.codigo]))
          const visiveis = atividades.filter(
            (a) => (filtro === 'todas' || a.status === filtro) && contem(busca, a.titulo, a.descricao, a.categoria, a.itens[0]?.enunciado),
          )

          return (
            <>
              <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
                <TabsList className="h-auto flex-wrap">
                  <TabsTrigger value="todas">Todas</TabsTrigger>
                  <TabsTrigger value="rascunho">Rascunhos</TabsTrigger>
                  <TabsTrigger value="publicada">Publicadas</TabsTrigger>
                  <TabsTrigger value="encerrada">Encerradas</TabsTrigger>
                </TabsList>
              </Tabs>

              {atividades.length === 0 ? (
                <Vazio
                  icone={ehQuestao ? ListChecksIcon : ClipboardListIcon}
                  titulo={ehQuestao ? 'Nenhuma questão ainda' : 'Nenhuma atividade ainda'}
                  texto={turmas.length === 0 ? 'Crie uma turma antes de publicar.' : `Crie a primeira ${nome} para a turma.`}
                >
                  <Button size="sm" disabled={turmas.length === 0} onClick={() => setEditor({ atividade: null })}>
                    {ehQuestao ? 'Nova questão' : 'Nova atividade'}
                  </Button>
                </Vazio>
              ) : visiveis.length === 0 ? (
                <Vazio icone={SearchXIcon} titulo="Nada neste filtro" texto="Troque o filtro ou o termo da pesquisa." />
              ) : (
                <ul className="flex flex-col gap-4">
                  {visiveis.map((a) => (
                    <li key={a.id}>
                      <Card>
                        <CardContent className="flex flex-wrap items-start gap-4">
                          <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={a.status === 'publicada' ? 'green' : a.status === 'encerrada' ? 'neutro' : 'outline'}>
                                {ROTULO_STATUS_ATIVIDADE[a.status]}
                              </Badge>
                              {!ehQuestao && <Badge variant="outline">{a.tipo === 'quiz' ? 'Quiz' : 'Lição'}</Badge>}
                              {a.categoria && <Badge variant="outline">{a.categoria}</Badge>}
                              {a.dificuldade && <Badge variant="neutro">{ROTULO_DIFICULDADE[a.dificuldade]}</Badge>}
                              <span className="font-mono text-xs text-muted-foreground">{codigoDaTurma.get(a.turma_id) ?? ''}</span>
                            </div>
                            <h2 className="text-[19px]">{a.titulo}</h2>
                            {(ehQuestao ? a.itens[0]?.enunciado : a.descricao) && (
                              <p className="text-sm text-muted-foreground">{ehQuestao ? a.itens[0]?.enunciado : a.descricao}</p>
                            )}
                            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                              {!ehQuestao && (
                                <span>
                                  {a.itens.length} {a.itens.length === 1 ? 'item' : 'itens'}
                                </span>
                              )}
                              {a.prazo_em && (
                                <span className="inline-flex items-center gap-1.5">
                                  <ClockIcon aria-hidden="true" className="size-3.5" />
                                  Prazo: {formatarDataHora(a.prazo_em, FUSO)}
                                </span>
                              )}
                              <span>
                                {a.respondentes} {a.respondentes === 1 ? 'aluno respondeu' : 'alunos responderam'}
                              </span>
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {a.status === 'rascunho' && (
                              <Button size="sm" onClick={() => void publicar(a)}>
                                Publicar
                              </Button>
                            )}
                            {a.status === 'publicada' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setConfirmacao({
                                    titulo: `Encerrar "${a.titulo}"?`,
                                    texto: 'Os alunos deixam de poder responder. As respostas já enviadas continuam guardadas.',
                                    acao: 'Encerrar',
                                    executar: () => encerrarAtividade(a.id),
                                    sucesso: ehQuestao ? 'Questão encerrada' : 'Atividade encerrada',
                                  })
                                }
                              >
                                Encerrar
                              </Button>
                            )}
                            {a.status !== 'rascunho' && (
                              <Button size="sm" variant="outline" onClick={() => setRespostas(a)}>
                                Ver respostas
                              </Button>
                            )}
                            <Button size="icon-sm" variant="ghost" aria-label={`Editar ${a.titulo}`} onClick={() => setEditor({ atividade: a })}>
                              <PencilIcon />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Excluir ${a.titulo}`}
                              onClick={() =>
                                setConfirmacao({
                                  titulo: `Excluir "${a.titulo}"?`,
                                  texto:
                                    a.respondentes > 0
                                      ? 'As respostas dos alunos também são apagadas. Esta ação não pode ser desfeita.'
                                      : 'Esta ação não pode ser desfeita.',
                                  acao: 'Excluir',
                                  destrutiva: true,
                                  executar: () => excluirAtividade(a.id),
                                  sucesso: ehQuestao ? 'Questão excluída' : 'Atividade excluída',
                                })
                              }
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}

              {editor && (
                <EditorDaAtividade
                  modo={modo}
                  atividade={editor.atividade}
                  turmas={turmas}
                  conteudos={conteudos}
                  aoFechar={(feito) => {
                    setEditor(null)
                    if (feito) consulta.recarregar()
                  }}
                />
              )}
            </>
          )
        }}
      </Carregado>

      {respostas && <RespostasRecebidas atividade={respostas} aoFechar={() => setRespostas(null)} />}
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

export function Atividades() {
  return <ListaDoProfessor modo="atividades" />
}

export function Questoes() {
  return <ListaDoProfessor modo="questoes" />
}
