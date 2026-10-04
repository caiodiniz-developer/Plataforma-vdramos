import { Badge } from '@/components/ui/badge'
import { Revelar } from '@/componentes/Revelar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  abasVisiveis,
  experienciasDaLanding,
  periodoDaExperiencia,
  varianteDaTag,
  type Experiencia,
  type TipoExperiencia,
} from '@/dominio/experiencia'

const ROTULO_ABA: Record<TipoExperiencia, string> = {
  profissional: 'Profissional',
  docencia: 'Docência',
}

type Props = {
  experiencias: Experiencia[]
  aba: TipoExperiencia
  aoTrocarAba: (aba: TipoExperiencia) => void
}

function LinhaDoTempo({ itens }: { itens: Experiencia[] }) {
  return (
    <ol className="relative ml-1.5 flex flex-col gap-6 border-l-2 pl-6 md:pl-8">
      {itens.map((e, i) => (
        <Revelar key={e.id} como="li" atraso={Math.min(i, 3) * 100} className="relative">
          <span
            aria-hidden="true"
            className="absolute top-5 -left-[33px] size-3.5 border-2 bg-background md:-left-[41px]"
          />
          <Card>
            <CardHeader>
              <p className="eyebrow text-muted-foreground">{periodoDaExperiencia(e.data_inicio, e.data_fim)}</p>
              <CardTitle>
                <h3 className="text-[19px]">{e.cargo}</h3>
              </CardTitle>
              <CardDescription className="font-bold text-foreground">
                {e.organizacao}
                {e.local && <span className="font-medium text-muted-foreground"> · {e.local}</span>}
              </CardDescription>
            </CardHeader>
            {(e.descricao || e.tags.length > 0) && (
              <CardContent className="flex flex-col gap-3">
                {e.descricao && <p className="text-[13px] leading-[1.55] text-muted-foreground">{e.descricao}</p>}
                {e.tags.length > 0 && (
                  <ul className="flex flex-wrap gap-2.5" aria-label="Temas">
                    {e.tags.map((tag) => (
                      <li key={tag}>
                        <Badge variant={varianteDaTag(tag)}>{tag}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            )}
          </Card>
        </Revelar>
      ))}
    </ol>
  )
}

/** PRD F1: experiência em abas Profissional | Docência; aba vazia não aparece. */
export function Experiencias({ experiencias, aba, aoTrocarAba }: Props) {
  const abas = abasVisiveis(experiencias)

  if (abas.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-muted-foreground">As experiências ainda não foram publicadas.</p>
        </CardContent>
      </Card>
    )
  }

  const ativa = abas.includes(aba) ? aba : abas[0]

  return (
    <Tabs value={ativa} onValueChange={(valor) => aoTrocarAba(valor as TipoExperiencia)}>
      {abas.length > 1 && (
        <TabsList className="mb-6">
          {abas.map((tipo) => (
            <TabsTrigger key={tipo} value={tipo}>
              {ROTULO_ABA[tipo]}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
      {abas.map((tipo) => (
        <TabsContent key={tipo} value={tipo}>
          <LinhaDoTempo itens={experienciasDaLanding(experiencias, tipo)} />
        </TabsContent>
      ))}
    </Tabs>
  )
}
