import { MailIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EstadoDeErro } from '@/componentes/EstadoDeErro'
import { listarMensagensDeContato, marcarMensagem } from '@/dados/admin'
import { ROTULO_ASSUNTO } from '@/dominio/contato'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'

type Filtro = 'nao_lidas' | 'lidas' | 'todas'

/** PRD F15: caixa de mensagens de contato com filtro lida/não lida. */
export default function MensagensDeContato() {
  const [filtro, setFiltro] = useState<Filtro>('nao_lidas')
  const { dados, carregando, erro, recarregar } = useConsulta(() => listarMensagensDeContato(filtro), [filtro])

  async function alternar(id: string, lida: boolean) {
    try {
      await marcarMensagem(id, lida)
      recarregar()
    } catch (falha) {
      toast.error((falha as Error).message)
    }
  }

  return (
    <div className="flex max-w-[860px] flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="eyebrow text-muted-foreground">Landing</p>
        <h1 className="text-[28px] md:text-[36px]">Mensagens de contato</h1>
      </div>

      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
        <TabsList>
          <TabsTrigger value="nao_lidas">Não lidas</TabsTrigger>
          <TabsTrigger value="lidas">Lidas</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
        </TabsList>
      </Tabs>

      {carregando && !dados && (
        <div className="flex flex-col gap-3" aria-busy="true">
          <span className="sr-only">Carregando</span>
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}
      {erro && <EstadoDeErro mensagem={erro} aoTentarDeNovo={recarregar} />}
      {dados && dados.length === 0 && <p className="text-muted-foreground">Nenhuma mensagem neste filtro.</p>}
      {dados && dados.length > 0 && (
        <ul className="flex flex-col gap-3">
          {dados.map((m) => (
            <li key={m.id}>
              <Card>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge variant={m.lida ? 'neutro' : 'default'}>{m.lida ? 'Lida' : 'Não lida'}</Badge>
                    <Badge variant="outline">
                      {m.assunto === 'outro' ? (m.assunto_outro ?? 'Outro') : ROTULO_ASSUNTO[m.assunto]}
                    </Badge>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {formatarDataHora(m.created_at, 'America/Sao_Paulo')}
                    </span>
                  </div>
                  <p className="font-bold">
                    {m.nome}{' '}
                    <a href={`mailto:${m.email}`} className="font-medium underline">
                      {m.email}
                    </a>
                  </p>
                  <p className="text-[13px] whitespace-pre-wrap">{m.mensagem}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <a href={`mailto:${m.email}`}>
                        <MailIcon aria-hidden="true" />
                        Responder por e-mail
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void alternar(m.id, !m.lida)}>
                      Marcar como {m.lida ? 'não lida' : 'lida'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
