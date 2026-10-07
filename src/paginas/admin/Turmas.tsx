import { GraduationCapIcon, Loader2Icon, PencilIcon, PlusIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CabecalhoDaPagina, Carregado, Vazio } from '@/componentes/plataforma/Blocos'
import { listarTurmas, salvarTurma, type DadosDaTurma, type TurmaDoProfessor } from '@/dados/professor'
import { formatarData } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'

const ROTULO_STATUS = { planejada: 'Planejada', ativa: 'Ativa', encerrada: 'Encerrada' } as const
const ROTULO_MODALIDADE = { presencial: 'Presencial', online: 'Online', hibrido: 'Híbrido' } as const
const PADRAO_CODIGO = /^[A-Z0-9-]{4,20}$/

const NOVA: DadosDaTurma = {
  codigo: '',
  curso_nome: '',
  instituicao: 'SENAI',
  cidade: '',
  modalidade: 'presencial',
  data_inicio: '',
  data_fim: '',
  vagas: null,
  status: 'ativa',
}

function FormularioDaTurma({ turma, aoFechar }: { turma: TurmaDoProfessor | null; aoFechar: (feito: boolean) => void }) {
  const id = useId()
  const [dados, setDados] = useState<DadosDaTurma>(
    turma
      ? {
          codigo: turma.codigo,
          curso_nome: turma.curso_nome,
          instituicao: turma.instituicao,
          cidade: turma.cidade,
          modalidade: turma.modalidade,
          data_inicio: turma.data_inicio,
          data_fim: turma.data_fim,
          vagas: turma.vagas,
          status: turma.status,
        }
      : NOVA,
  )
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const mudar = (parte: Partial<DadosDaTurma>) => setDados((atual) => ({ ...atual, ...parte }))

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    if (!PADRAO_CODIGO.test(dados.codigo.trim().toUpperCase())) return setErro('O ID da turma usa letras, números e hífen, de 4 a 20 caracteres.')
    if (dados.curso_nome.trim().length < 3) return setErro('Informe o curso ou a disciplina.')
    if (dados.instituicao.trim() === '' || dados.cidade.trim() === '') return setErro('Informe a instituição e a cidade.')
    if (!dados.data_inicio || !dados.data_fim) return setErro('Informe as datas de início e fim.')
    if (dados.data_fim < dados.data_inicio) return setErro('A data de fim não pode ser antes do início.')
    setEnviando(true)
    setErro(null)
    try {
      await salvarTurma(dados, turma ?? undefined)
      toast.success(turma ? 'Turma atualizada' : 'Turma criada')
      aoFechar(true)
    } catch (falha) {
      setErro((falha as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar(false)}>
      <DialogContent className="plataforma max-h-[92vh] min-h-0 overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-[22px] font-bold">{turma ? 'Editar turma' : 'Nova turma'}</DialogTitle>
          <DialogDescription>O ID da turma é o que o aluno digita para entrar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-codigo`}>ID da turma</Label>
              <Input
                id={`${id}-codigo`}
                maxLength={20}
                className="font-mono uppercase"
                placeholder="TURMA-001"
                value={dados.codigo}
                onChange={(e) => mudar({ codigo: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-status`}>Status</Label>
              <Select value={dados.status} onValueChange={(v) => mudar({ status: v as DadosDaTurma['status'] })}>
                <SelectTrigger id={`${id}-status`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-curso`}>Curso ou disciplina</Label>
            <Input id={`${id}-curso`} maxLength={120} value={dados.curso_nome} onChange={(e) => mudar({ curso_nome: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-instituicao`}>Instituição</Label>
              <Input id={`${id}-instituicao`} maxLength={80} value={dados.instituicao} onChange={(e) => mudar({ instituicao: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-cidade`}>Cidade</Label>
              <Input id={`${id}-cidade`} maxLength={80} value={dados.cidade} onChange={(e) => mudar({ cidade: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-inicio`}>Início</Label>
              <Input id={`${id}-inicio`} type="date" value={dados.data_inicio} onChange={(e) => mudar({ data_inicio: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-fim`}>Fim</Label>
              <Input id={`${id}-fim`} type="date" value={dados.data_fim} onChange={(e) => mudar({ data_fim: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-modalidade`}>Modalidade</Label>
              <Select value={dados.modalidade} onValueChange={(v) => mudar({ modalidade: v as DadosDaTurma['modalidade'] })}>
                <SelectTrigger id={`${id}-modalidade`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROTULO_MODALIDADE).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-vagas`}>Vagas (opcional)</Label>
              <Input
                id={`${id}-vagas`}
                type="number"
                min={1}
                value={dados.vagas ?? ''}
                onChange={(e) => mudar({ vagas: e.target.value === '' ? null : Math.max(1, Number(e.target.value)) })}
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

/** Turmas do professor. Conteúdos, atividades e avisos são publicados por turma. */
export default function Turmas() {
  const consulta = useConsulta(listarTurmas, [])
  const [formulario, setFormulario] = useState<{ turma: TurmaDoProfessor | null } | null>(null)

  return (
    <>
      <CabecalhoDaPagina rotulo="Geral" titulo="Turmas" descricao="Cada aluno pertence a uma turma e só vê o que foi publicado para ela.">
        <Button onClick={() => setFormulario({ turma: null })}>
          <PlusIcon aria-hidden="true" />
          Nova turma
        </Button>
      </CabecalhoDaPagina>

      <Carregado consulta={consulta}>
        {(turmas) =>
          turmas.length === 0 ? (
            <Vazio icone={GraduationCapIcon} titulo="Nenhuma turma ainda" texto="Crie a primeira turma para cadastrar alunos e publicar conteúdos.">
              <Button size="sm" onClick={() => setFormulario({ turma: null })}>
                Nova turma
              </Button>
            </Vazio>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {turmas.map((t) => (
                <li key={t.id}>
                  <Card className="h-full">
                    <CardContent className="flex h-full flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={t.status === 'ativa' ? 'green' : t.status === 'planejada' ? 'outline' : 'neutro'}>{ROTULO_STATUS[t.status]}</Badge>
                        <Badge variant="outline">{ROTULO_MODALIDADE[t.modalidade]}</Badge>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="ml-auto"
                          aria-label={`Editar turma ${t.codigo}`}
                          onClick={() => setFormulario({ turma: t })}
                        >
                          <PencilIcon />
                        </Button>
                      </div>
                      <h2 className="text-[22px]">{t.codigo}</h2>
                      <p className="font-semibold">{t.curso_nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.instituicao} · {t.cidade}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {formatarData(t.data_inicio)} a {formatarData(t.data_fim)}
                      </p>
                      <p className="mt-auto border-t border-divisor pt-3 text-sm">
                        <span className="destaque text-lg">{t.inscritos}</span> com conta ·{' '}
                        <span className="destaque text-lg">{t.autorizados}</span> {t.autorizados === 1 ? 'aluno cadastrado' : 'alunos cadastrados'}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )
        }
      </Carregado>

      {formulario && (
        <FormularioDaTurma
          turma={formulario.turma}
          aoFechar={(feito) => {
            setFormulario(null)
            if (feito) consulta.recarregar()
          }}
        />
      )}
    </>
  )
}
