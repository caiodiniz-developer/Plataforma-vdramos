import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Markdown } from '@/componentes/Markdown'
import type { Capacidade, Turma } from '@/dados/turma'

function Capacidades({ titulo, itens }: { titulo: string; itens: Capacidade[] }) {
  if (itens.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      <p className="eyebrow text-muted-foreground">{titulo}</p>
      <ul className="flex flex-col gap-2">
        {itens.map((c) => (
          <li key={c.id} className="grid grid-cols-[64px_1fr] gap-3 border-t border-divisor pt-2 text-[13px]">
            <span className="font-mono font-bold">{c.codigo}</span>
            <span>{c.descricao}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3 className="text-[19px]">{titulo}</h3>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

/** PRD F5: objetivo, carga horária, ementa, capacidades e critérios de avaliação. */
export function InformacoesDoCurso({ turma }: { turma: Turma }) {
  const { curso } = turma
  const tecnicas = curso.capacidades.filter((c) => c.tipo === 'tecnica')
  const socioemocionais = curso.capacidades.filter((c) => c.tipo === 'socioemocional')

  return (
    <div className="flex flex-col gap-5">
      <Bloco titulo="Objetivo">
        <div className="flex flex-col gap-4">
          <p>{curso.objetivo}</p>
          <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="eyebrow text-muted-foreground">Carga horária</dt>
              <dd className="font-bold">{curso.carga_horaria_h} horas</dd>
            </div>
            {curso.tipo_formacao && (
              <div>
                <dt className="eyebrow text-muted-foreground">Formação</dt>
                <dd className="font-bold">{curso.tipo_formacao}</dd>
              </div>
            )}
            {curso.publico_alvo && (
              <div>
                <dt className="eyebrow text-muted-foreground">Público</dt>
                <dd>{curso.publico_alvo}</dd>
              </div>
            )}
            {curso.pre_requisitos && (
              <div>
                <dt className="eyebrow text-muted-foreground">Pré-requisitos</dt>
                <dd>{curso.pre_requisitos}</dd>
              </div>
            )}
          </dl>
        </div>
      </Bloco>

      <Bloco titulo="Ementa">
        <Markdown className="text-[13px]">{curso.ementa_md}</Markdown>
      </Bloco>

      {curso.capacidades.length > 0 && (
        <Bloco titulo="Capacidades">
          <div className="flex flex-col gap-6">
            <Capacidades titulo="Técnicas" itens={tecnicas} />
            <Capacidades titulo="Socioemocionais" itens={socioemocionais} />
          </div>
        </Bloco>
      )}

      {curso.criterios_avaliacao_md && (
        <Bloco titulo="Critérios de avaliação">
          <Markdown className="text-[13px]">{curso.criterios_avaliacao_md}</Markdown>
        </Bloco>
      )}
    </div>
  )
}
