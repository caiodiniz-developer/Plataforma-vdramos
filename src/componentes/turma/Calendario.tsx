import { CalendarPlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Turma } from '@/dados/turma'
import { ROTULO_TIPO_BLOCO } from '@/dominio/blocos'
import { gerarIcs, proximoEncontro } from '@/dominio/calendario'
import { diaDaSemana, formatarData, formatarHora } from '@/dominio/tempo'
import { ReguaDoEncontro } from './ReguaDoEncontro'

function baixarIcs(turma: Turma) {
  const ics = gerarIcs(
    { nomeCurso: turma.curso.nome, codigoTurma: turma.codigo, fuso: turma.fuso, encontros: turma.encontros },
    new Date(),
  )
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${turma.codigo.toLowerCase()}.ics`
  link.click()
  URL.revokeObjectURL(url)
}

/** PRD F6: encontros com o próximo em destaque, régua e tabela de blocos. */
export function Calendario({ turma }: { turma: Turma }) {
  // Instante fixado na montagem: o destaque não muda no meio de uma renderização.
  const [agora] = useState(() => new Date())

  if (turma.encontros.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-muted-foreground">O professor ainda não publicou o calendário.</p>
        </CardContent>
      </Card>
    )
  }

  const proximo = proximoEncontro(turma.encontros, agora, turma.fuso)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">Horários no fuso da turma ({turma.fuso}).</p>
        <Button variant="outline" size="sm" onClick={() => baixarIcs(turma)}>
          <CalendarPlusIcon aria-hidden="true" />
          Adicionar ao calendário
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={proximo ? [proximo.id] : []} className="flex flex-col gap-4">
        {turma.encontros.map((encontro) => {
          const ehProximo = proximo?.id === encontro.id
          return (
            <AccordionItem key={encontro.id} value={encontro.id} className="border-2 bg-card last:border-b-2">
              <AccordionTrigger className="items-start gap-4 px-[18px] py-4 hover:no-underline">
                <div className="flex flex-col gap-2 text-left">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="eyebrow text-muted-foreground">Encontro {encontro.numero}</span>
                    {ehProximo && <Badge>Próximo encontro</Badge>}
                  </div>
                  <h3 className="text-[19px]">{encontro.titulo}</h3>
                  <p className="text-[13px] font-medium text-muted-foreground">
                    {formatarData(encontro.data)} · {diaDaSemana(encontro.data)} ·{' '}
                    {formatarHora(encontro.hora_inicio)}–{formatarHora(encontro.hora_fim)}
                    {encontro.local && ` · ${encontro.local}`}
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-5 px-[18px] pb-4">
                {encontro.descricao && <p className="text-[13px] leading-[1.55]">{encontro.descricao}</p>}
                {encontro.blocos.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    O professor ainda não publicou os blocos deste encontro.
                  </p>
                ) : (
                  <>
                    <ReguaDoEncontro blocos={encontro.blocos} />
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Horário</TableHead>
                          <TableHead>Min</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Momento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {encontro.blocos.map((bloco) => (
                          <TableRow key={bloco.id}>
                            <TableCell className="font-mono font-bold">{formatarHora(bloco.hora_inicio)}</TableCell>
                            <TableCell className="font-mono">{bloco.duracao_min}</TableCell>
                            <TableCell>{ROTULO_TIPO_BLOCO[bloco.tipo]}</TableCell>
                            <TableCell className="whitespace-normal">
                              <span className="font-bold">{bloco.titulo}</span>
                              {bloco.descricao && (
                                <span className="block text-[13px] text-muted-foreground">{bloco.descricao}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
