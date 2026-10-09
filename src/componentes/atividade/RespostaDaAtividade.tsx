import { CheckIcon, Loader2Icon, PaperclipIcon, UploadIcon, XIcon } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EstadoDeErro } from '@/componentes/EstadoDeErro'
import { Markdown } from '@/componentes/Markdown'
import {
  avisarProfessorDaResposta,
  ENTREGA_MAXIMA_MB,
  ENTREGAS_POR_ATIVIDADE,
  entregasDaAtividade,
  enviarEntrega,
  urlAssinada,
  type Entrega,
} from '@/dados/apoio'
import {
  buscarAtividade,
  responderAtividade,
  type ItemParaAluno,
  type RespostaDoItem,
} from '@/dados/sala'
import { ROTULO_TIPO_ATIVIDADE, segundosRestantes } from '@/dominio/atividade'
import { problemaDosArquivos, tamanhoLegivel } from '@/dominio/entrega'
import { percentual } from '@/dominio/relatorio'
import { useConsulta } from '@/hooks/useConsulta'

type Rascunho = { opcao_ids: string[]; valor: number | null; texto: string }

const VAZIO: Rascunho = { opcao_ids: [], valor: null, texto: '' }

function paraResposta(item: ItemParaAluno, r: Rascunho): RespostaDoItem | null {
  switch (item.tipo_resposta) {
    case 'escolha_unica':
    case 'escolha_multipla':
      return r.opcao_ids.length > 0 ? { item_id: item.id, opcao_ids: r.opcao_ids } : null
    case 'escala_1_5':
    case 'nps_0_10':
      return r.valor === null ? null : { item_id: item.id, valor: r.valor }
    default:
      return r.texto.trim() === '' ? null : { item_id: item.id, texto: r.texto.trim() }
  }
}

/** Contagem regressiva do quiz ao vivo, recalculada a partir do relógio. */
function useContagem(publicadaEm: string | null, limite: number | null): number | null {
  const [restante, setRestante] = useState(() => segundosRestantes(publicadaEm, limite, new Date()))
  useEffect(() => {
    if (!publicadaEm || !limite) return
    const relogio = setInterval(() => setRestante(segundosRestantes(publicadaEm, limite, new Date())), 250)
    return () => clearInterval(relogio)
  }, [publicadaEm, limite])
  return restante
}

function CampoDoItem({
  item,
  valor,
  aoMudar,
  travado,
}: {
  item: ItemParaAluno
  valor: Rascunho
  aoMudar: (r: Rascunho) => void
  travado: boolean
}) {
  const id = useId()

  if (item.tipo_resposta === 'escolha_unica') {
    return (
      <RadioGroup
        disabled={travado}
        value={valor.opcao_ids[0] ?? ''}
        onValueChange={(opcao) => aoMudar({ ...valor, opcao_ids: [opcao] })}
        aria-label={item.enunciado}
      >
        {item.opcoes.map((o) => (
          <div key={o.id} className="flex items-center gap-3">
            <RadioGroupItem id={`${id}-${o.id}`} value={o.id} />
            <Label htmlFor={`${id}-${o.id}`} className="font-medium">
              {o.texto}
            </Label>
          </div>
        ))}
      </RadioGroup>
    )
  }

  if (item.tipo_resposta === 'escolha_multipla') {
    return (
      <div className="flex flex-col gap-3" role="group" aria-label={item.enunciado}>
        {item.opcoes.map((o) => (
          <div key={o.id} className="flex items-center gap-3">
            <Checkbox
              id={`${id}-${o.id}`}
              disabled={travado}
              checked={valor.opcao_ids.includes(o.id)}
              onCheckedChange={(marcado) =>
                aoMudar({
                  ...valor,
                  opcao_ids: marcado ? [...valor.opcao_ids, o.id] : valor.opcao_ids.filter((x) => x !== o.id),
                })
              }
            />
            <Label htmlFor={`${id}-${o.id}`} className="font-medium">
              {o.texto}
            </Label>
          </div>
        ))}
      </div>
    )
  }

  if (item.tipo_resposta === 'escala_1_5' || item.tipo_resposta === 'nps_0_10') {
    const notas = item.tipo_resposta === 'escala_1_5' ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    return (
      <div className="flex flex-col gap-2">
        <ToggleGroup
          type="single"
          disabled={travado}
          value={valor.valor === null ? '' : String(valor.valor)}
          onValueChange={(nota) => aoMudar({ ...valor, valor: nota === '' ? null : Number(nota) })}
          className="flex flex-wrap justify-start gap-1.5"
          aria-label={item.enunciado}
        >
          {notas.map((n) => (
            <ToggleGroupItem
              key={n}
              value={String(n)}
              className="size-11 border-2 font-mono font-bold data-[state=on]:bg-secondary data-[state=on]:text-secondary-foreground"
            >
              {n}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="flex justify-between text-xs text-muted-foreground">
          <span>{item.tipo_resposta === 'escala_1_5' ? '1 = pouco' : '0 = nada provável'}</span>
          <span>{item.tipo_resposta === 'escala_1_5' ? '5 = muito' : '10 = muito provável'}</span>
        </p>
      </div>
    )
  }

  return (
    <Textarea
      aria-label={item.enunciado}
      disabled={travado}
      rows={3}
      maxLength={1000}
      value={valor.texto}
      onChange={(e) => aoMudar({ ...valor, texto: e.target.value })}
    />
  )
}

/** Correção (quiz) e resultado agregado, quando a regra permite. */
function ResultadoDoItem({ item }: { item: ItemParaAluno }) {
  const correta = item.minha_resposta?.correta
  return (
    <div className="flex flex-col gap-3">
      {correta !== null && correta !== undefined && (
        <Badge variant={correta ? 'green' : 'orange'}>
          {correta ? <CheckIcon aria-hidden="true" /> : <XIcon aria-hidden="true" />}
          {correta ? 'Correta' : 'Incorreta'}
        </Badge>
      )}
      {item.opcoes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {item.opcoes.map((o) => {
            const marcada = item.minha_resposta?.opcao_ids?.includes(o.id)
            const total = item.resultado?.respostas ?? 0
            return (
              <li key={o.id} className="flex flex-col gap-1 text-[13px]">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={marcada ? 'font-bold' : undefined}>{o.texto}</span>
                  {marcada && <span className="eyebrow text-muted-foreground">Sua resposta</span>}
                  {o.correta && <span className="eyebrow">Gabarito</span>}
                  {o.total !== undefined && (
                    <span className="ml-auto font-mono">{percentual(o.total, total) ?? 0}%</span>
                  )}
                </span>
                {o.total !== undefined && (
                  <Progress value={percentual(o.total, total) ?? 0} className="h-1.5" aria-hidden="true" />
                )}
              </li>
            )
          })}
        </ul>
      )}
      {item.resultado && item.resultado.media !== null && (
        <p className="text-[13px]">
          Média da turma: <span className="font-mono font-bold">{item.resultado.media}</span> ({item.resultado.respostas}{' '}
          {item.resultado.respostas === 1 ? 'resposta' : 'respostas'})
        </p>
      )}
      {item.explicacao && <p className="border-l-2 border-primary pl-3 text-[13px]">{item.explicacao}</p>}
    </div>
  )
}

/**
 * Arquivos da resposta, quando a atividade aceita: o que já foi enviado e,
 * enquanto a atividade está aberta, a escolha de novos (zip ou avulsos).
 * Os arquivos escolhidos sobem junto com o envio das respostas.
 */
function ArquivosDaResposta({
  enviados,
  escolhidos,
  aoEscolher,
  travado,
}: {
  enviados: Entrega[]
  escolhidos: File[]
  aoEscolher: (arquivos: File[]) => void
  travado: boolean
}) {
  const id = useId()
  const restam = ENTREGAS_POR_ATIVIDADE - enviados.length

  async function abrir(caminho: string) {
    try {
      window.open(await urlAssinada(caminho), '_blank', 'noopener,noreferrer')
    } catch (falha) {
      toast.error((falha as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-3 border-2 p-4">
      <p className="flex items-center gap-2 font-bold">
        <UploadIcon aria-hidden="true" className="size-4" />
        Arquivos da resposta
      </p>

      {enviados.length > 0 && (
        <ul aria-label="Arquivos enviados" className="flex flex-col gap-1">
          {enviados.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="link" size="sm" className="px-0" onClick={() => void abrir(e.arquivo_path)}>
                <PaperclipIcon aria-hidden="true" />
                {e.nome_arquivo}
              </Button>
              <span className="font-mono text-[11px] text-muted-foreground">{tamanhoLegivel(e.tamanho_bytes)}</span>
            </li>
          ))}
        </ul>
      )}

      {travado ? (
        enviados.length === 0 && <p className="text-[13px] text-muted-foreground">Nenhum arquivo foi enviado.</p>
      ) : restam <= 0 ? (
        <p className="text-[13px] text-muted-foreground">Você já enviou o limite de {ENTREGAS_POR_ATIVIDADE} arquivos.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-arquivos`}>Anexar arquivos (opcional)</Label>
          <Input
            id={`${id}-arquivos`}
            type="file"
            multiple
            aria-describedby={`${id}-ajuda`}
            onChange={(e) => aoEscolher(Array.from(e.target.files ?? []))}
          />
          <p id={`${id}-ajuda`} className="text-xs text-muted-foreground">
            Até {restam} {restam === 1 ? 'arquivo' : 'arquivos'}, {ENTREGA_MAXIMA_MB} MB cada. Para vários arquivos, prefira um .zip.
          </p>
          {escolhidos.length > 0 && (
            <ul aria-label="Arquivos escolhidos" className="flex flex-col gap-1 text-[13px]">
              {escolhidos.map((a) => (
                <li key={`${a.name}-${a.size}`} className="flex flex-wrap items-center gap-2">
                  <PaperclipIcon aria-hidden="true" className="size-3.5" />
                  {a.name}
                  <span className="font-mono text-[11px] text-muted-foreground">{tamanhoLegivel(a.size)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * PRD F13: responde uma atividade publicada. Valida os obrigatórios no
 * cliente, envia tudo numa transação e mostra a correção e o resultado
 * conforme `mostrar_resultado`.
 */
export function RespostaDaAtividade({ atividadeId, aoResponder }: { atividadeId: string; aoResponder?: () => void }) {
  const { dados: atividade, carregando, erro, recarregar } = useConsulta(() => buscarAtividade(atividadeId), [atividadeId])
  const arquivos = useConsulta(() => entregasDaAtividade(atividadeId), [atividadeId])
  const [rascunho, setRascunho] = useState<Record<string, Rascunho>>({})
  const [escolhidos, setEscolhidos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)
  const restante = useContagem(atividade?.publicada_em ?? null, atividade?.tempo_limite_s ?? null)

  if (carregando && !atividade) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <span className="sr-only">Carregando</span>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (erro || !atividade) return <EstadoDeErro mensagem={erro ?? 'Atividade não encontrada.'} aoTentarDeNovo={recarregar} />

  const tempoEsgotado = restante === 0
  const travado = atividade.respondida || atividade.status !== 'publicada' || tempoEsgotado

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando || !atividade) return
    const respostas: RespostaDoItem[] = []
    for (const item of atividade.itens) {
      const resposta = paraResposta(item, rascunho[item.id] ?? VAZIO)
      if (!resposta && item.obrigatorio) {
        setFalha(`Responda o item ${item.ordem}.`)
        return
      }
      if (resposta) respostas.push(resposta)
    }
    const jaEnviados = arquivos.dados?.entregas.length ?? 0
    const problema = problemaDosArquivos(escolhidos, jaEnviados, { maximoMb: ENTREGA_MAXIMA_MB, porAtividade: ENTREGAS_POR_ATIVIDADE })
    if (problema) {
      setFalha(problema)
      return
    }
    setEnviando(true)
    setFalha(null)
    try {
      // Os arquivos sobem primeiro: se um falhar, a resposta ainda não foi
      // enviada e o aluno pode tentar de novo sem perder nada.
      for (const arquivo of escolhidos) await enviarEntrega(atividade.id, arquivo)
      setEscolhidos([])
      await responderAtividade(atividade.id, respostas)
      // Extra silencioso: manda as respostas para o e-mail do professor.
      void avisarProfessorDaResposta(atividade.id)
      recarregar()
      arquivos.recarregar()
      aoResponder?.()
    } catch (e) {
      // O que já subiu fica registrado: a lista mostra para não reenviar.
      arquivos.recarregar()
      setFalha((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge variant="outline">{ROTULO_TIPO_ATIVIDADE[atividade.tipo]}</Badge>
        {atividade.status === 'encerrada' && <Badge variant="neutro">Encerrada</Badge>}
        {atividade.respondida && <Badge variant="green">Respondida</Badge>}
        {atividade.anonima && <Badge variant="violet">Anônima</Badge>}
        {restante !== null && atividade.status === 'publicada' && !atividade.respondida && (
          <span className="ml-auto font-mono text-lg font-bold" aria-live="polite">
            {tempoEsgotado ? 'Tempo encerrado' : `${restante} s`}
          </span>
        )}
      </div>
      {restante !== null && atividade.tempo_limite_s && !atividade.respondida && atividade.status === 'publicada' && (
        <Progress value={(restante / atividade.tempo_limite_s) * 100} className="h-1.5" aria-hidden="true" />
      )}

      {atividade.instrucoes_md && (
        <div className="border-l-2 border-primary bg-muted py-3 pr-3 pl-4">
          <Markdown className="text-[15px]">{atividade.instrucoes_md}</Markdown>
        </div>
      )}

      {atividade.arquivo_path && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="self-start px-0"
          onClick={() => {
            urlAssinada(atividade.arquivo_path!)
              .then((url) => window.open(url, '_blank', 'noopener,noreferrer'))
              .catch((falha: Error) => toast.error(falha.message))
          }}
        >
          <PaperclipIcon aria-hidden="true" />
          Abrir arquivo da atividade
        </Button>
      )}

      <ol className="flex flex-col gap-6">
        {atividade.itens.map((item) => (
          <li key={item.id} className="flex flex-col gap-3 border-t border-divisor pt-4 first:border-t-0 first:pt-0">
            <p className="font-bold">
              {item.ordem}. {item.enunciado}
              {!item.obrigatorio && <span className="font-medium text-muted-foreground"> (opcional)</span>}
            </p>
            {atividade.respondida || atividade.status === 'encerrada' ? (
              <ResultadoDoItem item={item} />
            ) : (
              <CampoDoItem
                item={item}
                travado={travado}
                valor={rascunho[item.id] ?? VAZIO}
                aoMudar={(r) => setRascunho((atual) => ({ ...atual, [item.id]: r }))}
              />
            )}
          </li>
        ))}
      </ol>

      {falha && (
        <p role="alert" className="text-[13px] font-bold text-destructive">
          {falha}
        </p>
      )}
      {!travado && (
        <Button type="submit" disabled={enviando} className="self-start">
          {enviando && <Loader2Icon className="animate-spin" aria-hidden="true" />}
          Enviar respostas
        </Button>
      )}
      {arquivos.dados?.aceita && (
        <ArquivosDaResposta enviados={arquivos.dados.entregas} escolhidos={escolhidos} aoEscolher={setEscolhidos} travado={travado} />
      )}
      {atividade.respondida && !atividade.mostra_resultado && (
        <p className="text-[13px] text-muted-foreground">Respostas enviadas. O resultado da turma aparece depois.</p>
      )}
    </form>
  )
}
