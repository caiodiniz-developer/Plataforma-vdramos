import { CheckIcon, Loader2Icon, XIcon } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EstadoDeErro } from '@/componentes/EstadoDeErro'
import {
  buscarAtividade,
  responderAtividade,
  type AtividadeParaAluno,
  type ItemParaAluno,
  type RespostaDoItem,
} from '@/dados/sala'
import { ROTULO_TIPO_ATIVIDADE, segundosRestantes } from '@/dominio/atividade'
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
function ResultadoDoItem({ atividade, item }: { atividade: AtividadeParaAluno; item: ItemParaAluno }) {
  const correta = item.minha_resposta?.correta
  return (
    <div className="flex flex-col gap-3">
      {atividade.tipo === 'quiz' && correta !== null && correta !== undefined && (
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
 * PRD F13: responde uma atividade publicada. Valida os obrigatórios no
 * cliente, envia tudo numa transação e mostra a correção e o resultado
 * conforme `mostrar_resultado`.
 */
export function RespostaDaAtividade({ atividadeId, aoResponder }: { atividadeId: string; aoResponder?: () => void }) {
  const { dados: atividade, carregando, erro, recarregar } = useConsulta(() => buscarAtividade(atividadeId), [atividadeId])
  const [rascunho, setRascunho] = useState<Record<string, Rascunho>>({})
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
    setEnviando(true)
    setFalha(null)
    try {
      await responderAtividade(atividade.id, respostas)
      recarregar()
      aoResponder?.()
    } catch (e) {
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

      <ol className="flex flex-col gap-6">
        {atividade.itens.map((item) => (
          <li key={item.id} className="flex flex-col gap-3 border-t border-divisor pt-4 first:border-t-0 first:pt-0">
            <p className="font-bold">
              {item.ordem}. {item.enunciado}
              {!item.obrigatorio && <span className="font-medium text-muted-foreground"> (opcional)</span>}
            </p>
            {atividade.respondida || atividade.status === 'encerrada' ? (
              <ResultadoDoItem atividade={atividade} item={item} />
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
      {atividade.respondida && !atividade.mostra_resultado && (
        <p className="text-[13px] text-muted-foreground">Respostas enviadas. O resultado da turma aparece depois.</p>
      )}
    </form>
  )
}
