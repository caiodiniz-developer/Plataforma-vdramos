import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { comInstituicao, instituicoesDe, TODAS, turmasDaInstituicao, type FiltroDeTurma, type TurmaParaFiltro } from '@/dominio/turmas'

/**
 * Filtros por instituição e por turma do painel do professor. Escolher a
 * instituição reduz a lista de turmas à dela.
 */
export function FiltroDeTurmas({
  turmas,
  valor,
  aoMudar,
}: {
  turmas: TurmaParaFiltro[]
  valor: FiltroDeTurma
  aoMudar: (filtro: FiltroDeTurma) => void
}) {
  const instituicoes = instituicoesDe(turmas)
  const visiveis = turmasDaInstituicao(turmas, valor.instituicao)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={valor.instituicao} onValueChange={(instituicao) => aoMudar(comInstituicao(valor, instituicao, turmas))}>
        <SelectTrigger aria-label="Filtrar por instituição" className="w-full sm:w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODAS}>Todas as instituições</SelectItem>
          {instituicoes.map((nome) => (
            <SelectItem key={nome} value={nome}>
              {nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={valor.turma} onValueChange={(turma) => aoMudar({ ...valor, turma })}>
        <SelectTrigger aria-label="Filtrar por turma" className="w-full sm:w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODAS}>Todas as turmas</SelectItem>
          {visiveis.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.codigo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
