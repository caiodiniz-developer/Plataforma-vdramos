import { useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  abasVisiveis,
  experienciasDaLanding,
  periodoDaExperiencia,
  varianteDaTag,
  type Experiencia,
  type TipoExperiencia,
} from '@/dominio/experiencia'
import { deBloco, deRegua, gsap, ScrollTrigger, useMovimento } from '@/lib/movimento'

const ROTULO_ABA: Record<TipoExperiencia, string> = {
  profissional: 'Profissional',
  docencia: 'Docência',
}

type Props = {
  experiencias: Experiencia[]
  aba: TipoExperiencia
  aoTrocarAba: (aba: TipoExperiencia) => void
}

/** Tabela editorial: período, cargo e organização, descrição e temas. */
function Linhas({ itens }: { itens: Experiencia[] }) {
  return (
    <ol>
      {itens.map((e) => (
        <li key={e.id} data-experiencia>
          <span aria-hidden="true" data-regua className="block h-0.5 origin-left bg-foreground" />
          <div data-conteudo className="grid gap-x-6 gap-y-5 py-(--espaco-item) md:grid-cols-12">
            <p className="font-mono text-sm text-muted-foreground md:col-span-3 md:pt-2">
              {periodoDaExperiencia(e.data_inicio, e.data_fim)}
            </p>
            <div className="flex flex-col gap-3 md:col-span-5">
              <h3 className="text-[clamp(24px,2.8vw,44px)] leading-[1.05]">{e.cargo}</h3>
              <p className="font-bold">
                {e.organizacao}
                {e.local && <span className="font-medium text-muted-foreground"> · {e.local}</span>}
              </p>
            </div>
            {(e.descricao || e.tags.length > 0) && (
              <div className="flex flex-col gap-5 md:col-span-4">
                {e.descricao && <p className="text-[15px] leading-[1.6] text-muted-foreground">{e.descricao}</p>}
                {e.tags.length > 0 && (
                  <ul className="flex flex-wrap gap-2.5" aria-label="Temas">
                    {e.tags.map((tag) => (
                      <li key={tag}>
                        <Badge variant={varianteDaTag(tag)}>{tag}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </li>
      ))}
      <li aria-hidden="true" className="h-0.5 bg-foreground" />
    </ol>
  )
}

/**
 * PRD F1: experiência em abas Profissional | Docência; aba vazia não aparece.
 *
 * Movimento (completo e essencial): a régua de cada linha se desenha e o
 * conteúdo entra quando a linha chega à tela. Ao trocar de aba, as animações
 * são refeitas para a nova lista e as seções seguintes são remedidas.
 */
export function Experiencias({ experiencias, aba, aoTrocarAba }: Props) {
  const raiz = useRef<HTMLDivElement>(null)
  const abas = abasVisiveis(experiencias)
  const ativa = abas.includes(aba) ? aba : abas[0]
  const abaMontada = useRef(ativa)

  useMovimento(
    raiz,
    (c, q) => {
      q('[data-experiencia]').forEach((linha) => {
        const dentro = (seletor: string) => Array.from(linha.querySelectorAll<HTMLElement>(seletor))
        gsap
          .timeline({ scrollTrigger: { trigger: linha, start: 'top 88%' } })
          .from(dentro('[data-regua]'), deRegua(c), 0)
          .from(dentro('[data-conteudo]'), deBloco(c, 32), 0.1)
      })
      // A altura da seção muda com a aba: quem vem depois precisa se remedir.
      if (abaMontada.current !== ativa) ScrollTrigger.refresh()
      abaMontada.current = ativa
    },
    [ativa],
  )

  if (abas.length === 0) {
    return <p className="text-muted-foreground">As experiências ainda não foram publicadas.</p>
  }

  return (
    <div ref={raiz}>
      <Tabs value={ativa} onValueChange={(valor) => aoTrocarAba(valor as TipoExperiencia)}>
        {abas.length > 1 && (
          <TabsList className="mb-(--espaco-miolo)">
            {abas.map((tipo) => (
              <TabsTrigger key={tipo} value={tipo}>
                {ROTULO_ABA[tipo]}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        {abas.map((tipo) => (
          <TabsContent key={tipo} value={tipo}>
            <Linhas itens={experienciasDaLanding(experiencias, tipo)} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
