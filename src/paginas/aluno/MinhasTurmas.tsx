import { GraduationCapIcon, Loader2Icon, LogInIcon, LogOutIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CabecalhoDaPagina } from '@/componentes/plataforma/Blocos'
import { Confirmar, type Confirmacao } from '@/componentes/plataforma/Confirmar'
import { useTurmasDoAluno } from '@/componentes/plataforma/LayoutAluno'
import { entrarNaTurma, sairDaTurma } from '@/dados/apoio'

const ROTULO_STATUS: Record<string, string> = { planejada: 'Planejada', ativa: 'Ativa', encerrada: 'Encerrada' }

/**
 * Turmas de que o aluno participa: trocar a turma em uso, entrar em outra com
 * o ID que o professor passou e sair de uma (menos da última).
 */
export default function MinhasTurmas() {
  const id = useId()
  const { turmas, atual, trocar, recarregar } = useTurmasDoAluno()
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)

  async function aoEntrar(evento: FormEvent) {
    evento.preventDefault()
    if (entrando) return
    const informado = codigo.trim().toUpperCase()
    if (informado === '') return setErro('Informe o ID da turma.')
    setEntrando(true)
    setErro(null)
    try {
      await entrarNaTurma(informado)
      toast.success(`Você entrou na turma ${informado}`, { description: 'Ela já aparece na sua lista.' })
      setCodigo('')
      trocar(informado)
      recarregar()
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setEntrando(false)
    }
  }

  return (
    <>
      <CabecalhoDaPagina
        rotulo="Turma"
        titulo="Minhas turmas"
        descricao="As turmas de que você participa. Conteúdos, atividades e avisos mudam conforme a turma em uso."
        icone={GraduationCapIcon}
        cor="azul"
      />

      <ul className="grid gap-4 md:grid-cols-2">
        {turmas.map((t) => {
          const emUso = t.id === atual.id
          return (
            <li key={t.id}>
              <Card className={emUso ? 'h-full border-l-8 border-l-primary' : 'h-full'}>
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {emUso && <Badge>Em uso</Badge>}
                    <Badge variant={t.status === 'ativa' ? 'green' : 'neutro'}>{ROTULO_STATUS[t.status] ?? t.status}</Badge>
                  </div>
                  <h2 className="text-[22px]">{t.codigo}</h2>
                  <p className="text-sm text-muted-foreground">{t.nome_curso}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    {!emUso && (
                      <Button size="sm" onClick={() => trocar(t.codigo)}>
                        Usar esta turma
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={turmas.length <= 1}
                      onClick={() =>
                        setConfirmacao({
                          titulo: `Sair da turma ${t.codigo}?`,
                          texto: 'Você deixa de ver os conteúdos e as atividades desta turma, e o que você enviou nela (respostas, dúvidas e mensagens) é apagado. Para voltar, será preciso o ID da turma.',
                          acao: 'Sair da turma',
                          destrutiva: true,
                          executar: () => sairDaTurma(t.id),
                          sucesso: `Você saiu da turma ${t.codigo}`,
                        })
                      }
                    >
                      <LogOutIcon aria-hidden="true" />
                      Sair da turma
                    </Button>
                  </div>
                  {turmas.length <= 1 && <p className="text-xs text-muted-foreground">É a sua única turma: não dá para sair dela.</p>}
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>

      <Card>
        <CardContent>
          <form onSubmit={aoEntrar} noValidate className="flex flex-col gap-3">
            <h2 className="text-[19px]">Entrar em outra turma</h2>
            <p className="text-sm text-muted-foreground">
              Use o ID da turma que o professor passou. Você entra com o mesmo ID de aluno e a mesma senha.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-2 sm:max-w-[320px]">
                <Label htmlFor={`${id}-codigo`}>ID da turma</Label>
                <Input
                  id={`${id}-codigo`}
                  maxLength={20}
                  className="font-mono uppercase"
                  placeholder="Ex.: TURMA-002"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={entrando}>
                {entrando ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <LogInIcon aria-hidden="true" />}
                Entrar na turma
              </Button>
            </div>
            {erro && (
              <p role="alert" className="text-[13px] font-semibold text-destructive">
                {erro}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <Confirmar
        pedido={confirmacao}
        aoFechar={(feito) => {
          setConfirmacao(null)
          if (feito) recarregar()
        }}
      />
    </>
  )
}
