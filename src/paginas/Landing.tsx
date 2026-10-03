import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { EstadoDeErro } from '@/componentes/EstadoDeErro'
import { Cabecalho, type Ancora } from '@/componentes/landing/Cabecalho'
import { Contato } from '@/componentes/landing/Contato'
import { Experiencias } from '@/componentes/landing/Experiencias'
import { Hero } from '@/componentes/landing/Hero'
import { Rodape } from '@/componentes/Rodape'
import { Secao } from '@/componentes/Secao'
import { buscarLanding } from '@/dados/landing'
import { abasVisiveis, type TipoExperiencia } from '@/dominio/experiencia'
import { useConsulta } from '@/hooks/useConsulta'

function Carregando() {
  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-4 py-14 md:px-10" aria-busy="true">
      <span className="sr-only">Carregando</span>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-14 w-2/3" />
      <Skeleton className="h-24 w-full max-w-[520px]" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

/** PRD F1: landing pública com hero, experiência, contato e rodapé. */
export default function Landing() {
  const { dados, carregando, erro, recarregar } = useConsulta(buscarLanding, [])
  const [aba, setAba] = useState<TipoExperiencia>('profissional')

  const abas = dados ? abasVisiveis(dados.experiencias) : []
  const ancoras: Ancora[] = [
    ...(abas.includes('profissional') ? [{ rotulo: 'Experiência', href: '#experiencia' }] : []),
    ...(abas.includes('docencia') ? [{ rotulo: 'Docência', href: '#experiencia' }] : []),
    { rotulo: 'Contato', href: '#contato' },
  ]

  // As âncoras Experiência e Docência levam à mesma seção, cada uma na sua aba.
  function aoNavegar(evento: React.MouseEvent<HTMLDivElement>) {
    const link = (evento.target as HTMLElement).closest('a[href="#experiencia"]')
    if (!link) return
    setAba(link.textContent?.trim() === 'Docência' ? 'docencia' : 'profissional')
  }

  return (
    <div className="flex min-h-screen flex-col" onClick={aoNavegar}>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-30 focus:bg-secondary focus:px-4 focus:py-2 focus:text-secondary-foreground"
      >
        Pular para o conteúdo
      </a>
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
            {abas.length > 0 && (
              <Secao id="experiencia" numero="01" titulo="Experiência">
                <Experiencias experiencias={dados.experiencias} aba={aba} aoTrocarAba={setAba} />
              </Secao>
            )}
            <Secao id="contato" numero={abas.length > 0 ? '02' : '01'} titulo="Contato">
              <Contato perfil={dados.perfil} />
            </Secao>
          </>
        )}
      </main>
      <Rodape />
    </div>
  )
}
