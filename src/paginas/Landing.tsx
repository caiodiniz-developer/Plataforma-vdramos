import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { EstadoDeErro } from '@/componentes/EstadoDeErro'
import { Cabecalho, type Ancora } from '@/componentes/landing/Cabecalho'
import { ChamadaFinal } from '@/componentes/landing/ChamadaFinal'
import { Contato } from '@/componentes/landing/Contato'
import { Experiencias } from '@/componentes/landing/Experiencias'
import { FaixaDeTemas } from '@/componentes/landing/FaixaDeTemas'
import { FrentesDeTrabalho } from '@/componentes/landing/FrentesDeTrabalho'
import { Galeria } from '@/componentes/landing/Galeria'
import { Hero } from '@/componentes/landing/Hero'
import { ProgressoDeLeitura } from '@/componentes/landing/ProgressoDeLeitura'
import { SalaInterativa } from '@/componentes/landing/SalaInterativa'
import { Rodape } from '@/componentes/Rodape'
import { Secao } from '@/componentes/Secao'
import { GALERIA } from '@/conteudo/galeria'
import { buscarLanding } from '@/dados/landing'
import type { Assunto } from '@/dominio/contato'
import { abasVisiveis, type TipoExperiencia } from '@/dominio/experiencia'
import { useConsulta } from '@/hooks/useConsulta'

function Carregando() {
  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-4 py-14 md:px-10" aria-busy="true">
      <span className="sr-only">Carregando</span>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-16 w-2/3" />
      <Skeleton className="h-24 w-full max-w-[520px]" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

/** Numeração das seções na ordem em que aparecem ("01", "02"…). */
function numerador() {
  let n = 0
  return () => String(++n).padStart(2, '0')
}

/**
 * PRD F1: landing pública. Ordem: hero, faixa de temas, frentes de trabalho,
 * experiência, sala de aula interativa, galeria, chamada final e contato.
 */
export default function Landing() {
  const { dados, carregando, erro, recarregar } = useConsulta(buscarLanding, [])
  const [aba, setAba] = useState<TipoExperiencia>('profissional')
  const [assunto, setAssunto] = useState<Assunto | undefined>()

  const abas = dados ? abasVisiveis(dados.experiencias) : []
  const ancoras: Ancora[] = [
    { rotulo: 'Frentes', href: '#frentes' },
    ...(abas.includes('profissional') ? [{ rotulo: 'Experiência', href: '#experiencia' }] : []),
    ...(abas.includes('docencia') ? [{ rotulo: 'Docência', href: '#experiencia' }] : []),
    { rotulo: 'Sala de aula', href: '#sala-de-aula' },
    { rotulo: 'Contato', href: '#contato' },
  ]

  // As âncoras Experiência e Docência levam à mesma seção, cada uma na sua aba.
  function aoNavegar(evento: React.MouseEvent<HTMLDivElement>) {
    const link = (evento.target as HTMLElement).closest('a[href="#experiencia"]')
    if (!link) return
    setAba(link.textContent?.trim() === 'Docência' ? 'docencia' : 'profissional')
  }

  const proximo = numerador()

  return (
    <div className="flex min-h-screen flex-col" onClick={aoNavegar}>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-40 focus:bg-secondary focus:px-4 focus:py-2 focus:text-secondary-foreground"
      >
        Pular para o conteúdo
      </a>
      <ProgressoDeLeitura />
      <Cabecalho ancoras={ancoras} />
      <main id="conteudo">
        {carregando && <Carregando />}
        {erro && (
          <div className="mx-auto max-w-[1080px] px-4 py-14 md:px-10">
            <EstadoDeErro mensagem={erro} aoTentarDeNovo={recarregar} />
          </div>
        )}
        {dados && !carregando && (
          <>
            <Hero perfil={dados.perfil} />
            <FaixaDeTemas />
            <Secao id="frentes" numero={proximo()} titulo="Frentes de trabalho">
              <FrentesDeTrabalho aoEscolher={setAssunto} />
            </Secao>
            {abas.length > 0 && (
              <Secao id="experiencia" numero={proximo()} titulo="Experiência">
                <Experiencias experiencias={dados.experiencias} aba={aba} aoTrocarAba={setAba} />
              </Secao>
            )}
            <Secao id="sala-de-aula" numero={proximo()} titulo="Sala de aula interativa">
              <SalaInterativa />
            </Secao>
            {GALERIA.length > 0 && (
              <Secao id="galeria" numero={proximo()} titulo="Em sala e em projetos">
                <Galeria fotos={GALERIA} />
              </Secao>
            )}
            <ChamadaFinal />
            <Secao id="contato" numero={proximo()} titulo="Contato">
              <Contato perfil={dados.perfil} assunto={assunto} />
            </Secao>
          </>
        )}
      </main>
      <Rodape />
    </div>
  )
}
