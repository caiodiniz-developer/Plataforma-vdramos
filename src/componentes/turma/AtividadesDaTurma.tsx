import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RespostaDaAtividade } from '@/componentes/atividade/RespostaDaAtividade'
import { EstadoDeErro } from '@/componentes/EstadoDeErro'
import { atividadesDaTurma } from '@/dados/sala'
import { ROTULO_TIPO_ATIVIDADE } from '@/dominio/atividade'
import { useConsulta } from '@/hooks/useConsulta'

/** Aba Atividades: quizzes, enquetes e pesquisas publicados para a turma. */
export function AtividadesDaTurma({ turmaId }: { turmaId: string }) {
  const { dados, carregando, erro, recarregar } = useConsulta(() => atividadesDaTurma(turmaId), [turmaId])
  const [aberta, setAberta] = useState<string | null>(null)

  if (carregando && !dados) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <span className="sr-only">Carregando</span>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }
  if (erro || !dados) return <EstadoDeErro mensagem={erro ?? 'Não foi possível carregar.'} aoTentarDeNovo={recarregar} />

  if (dados.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-muted-foreground">O professor ainda não publicou atividades.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {dados.map((a) => (
        <li key={a.id}>
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="eyebrow text-muted-foreground">
                    {ROTULO_TIPO_ATIVIDADE[a.tipo]}
                    {a.sessao_ao_vivo_id ? ' · aula ao vivo' : ''}
                  </p>
                  <h3 className="text-[19px]">{a.titulo}</h3>
                </div>
                <Badge variant={a.status === 'publicada' ? 'default' : 'neutro'}>
                  {a.status === 'publicada' ? 'Aberta' : 'Encerrada'}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  aria-expanded={aberta === a.id}
                  onClick={() => setAberta(aberta === a.id ? null : a.id)}
                >
                  {aberta === a.id ? 'Fechar' : a.status === 'publicada' ? 'Responder' : 'Ver resultado'}
                </Button>
              </div>
              {aberta === a.id && <RespostaDaAtividade atividadeId={a.id} />}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
