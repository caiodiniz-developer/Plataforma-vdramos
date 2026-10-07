import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { EstadoDeErro } from '@/componentes/EstadoDeErro'
import { Abertura } from '@/componentes/landing/Abertura'
import { Assinatura } from '@/componentes/landing/Assinatura'
import { Cabecalho, type Ancora } from '@/componentes/landing/Cabecalho'
import { ChamadaFinal } from '@/componentes/landing/ChamadaFinal'
import { Contato } from '@/componentes/landing/Contato'
import { CursorPersonalizado } from '@/componentes/landing/CursorPersonalizado'
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
import { CONSULTAS, ScrollTrigger } from '@/lib/movimento'
import { ALTURA_DO_CABECALHO, ligarRolagemSuave, rolagemSuaveAtiva, rolarAte } from '@/lib/rolagem'

function Carregando() {
  return (
    <div className="conteiner-landing flex flex-col gap-8 py-8" aria-busy="true">
      <span className="sr-only">Carregando</span>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-[26svh] w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-28 w-full max-w-140" />
      <Skeleton className="h-12 w-40" />
    </div>
  )
}

/** Numeração das seções na ordem em que aparecem ("01", "02"…). */
function numerador() {
  let n = 0
  return () => String(++n).padStart(2, '0')
}

/**
 * Quando o conteúdo da landing termina de montar: leva à seção do endereço
 * (`/#contato` aberto direto, já que as seções só existem depois da carga) e
 * manda o ScrollTrigger remedir a página quando as fontes chegam, porque a
 * troca de fonte muda a altura dos títulos.
 */
function useConteudoPronto(pronto: boolean) {
  useEffect(() => {
    if (!pronto) return
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (id) document.getElementById(id)?.scrollIntoView()

    let ativo = true
    void document.fonts?.ready.then(() => {
      if (ativo) ScrollTrigger.refresh()
    })
    return () => {
      ativo = false
    }
  }, [pronto])
}

/**
 * Rolagem suave (Lenis) enquanto a landing está na tela, só com ponteiro fino
 * (no toque a rolagem nativa já é a melhor). Ao sair da rota, desliga.
 */
function useRolagemSuave() {
  useEffect(() => {
    if (!window.matchMedia(CONSULTAS.ponteiroFino).matches) return
    const desligar = ligarRolagemSuave()
    ScrollTrigger.refresh()
    return desligar
  }, [])
}

/**
 * PRD F1: landing pública. Ordem: hero, faixa de temas, frentes de trabalho,
 * experiência, sala de aula interativa, galeria, chamada final, contato e
 * rodapé com a assinatura. As seções alternam Papel, Tinta e azul.
 */
export default function Landing() {
  const { dados, carregando, erro, recarregar } = useConsulta(buscarLanding, [])
  const [aba, setAba] = useState<TipoExperiencia>('profissional')
  const [assunto, setAssunto] = useState<Assunto | undefined>()
  const pronto = Boolean(dados) && !carregando
  useConteudoPronto(pronto)
  useRolagemSuave()

  const abas = dados ? abasVisiveis(dados.experiencias) : []
  const ancoras: Ancora[] = [
    { rotulo: 'Frentes', href: '#frentes' },
    ...(abas.includes('profissional') ? [{ rotulo: 'Experiência', href: '#experiencia' }] : []),
    ...(abas.includes('docencia') ? [{ rotulo: 'Docência', href: '#experiencia' }] : []),
    { rotulo: 'Sala de aula', href: '#sala-de-aula' },
    { rotulo: 'Contato', href: '#contato' },
  ]

  function aoNavegar(evento: React.MouseEvent<HTMLDivElement>) {
    const link = (evento.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
    if (!link) return
    const ancora = link.getAttribute('href') ?? ''
    // As âncoras Experiência e Docência levam à mesma seção, cada uma na sua aba.
    if (ancora === '#experiencia') setAba(link.textContent?.trim() === 'Docência' ? 'docencia' : 'profissional')

    // Com a rolagem suave ligada, a âncora passa por ela (o salto nativo brigaria
    // com a suavização); o endereço é atualizado do mesmo jeito.
    const alvo = document.getElementById(ancora.slice(1))
    if (!alvo || !rolagemSuaveAtiva() || evento.defaultPrevented) return
    evento.preventDefault()
    window.history.pushState(null, '', ancora)
    rolarAte(alvo, -ALTURA_DO_CABECALHO)
    // O foco acompanha, como na âncora nativa, sem rolar de novo.
    if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1')
    alvo.focus({ preventScroll: true })
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
      <Abertura />
      <CursorPersonalizado />
      <ProgressoDeLeitura />
      <Cabecalho ancoras={ancoras} />
      <main id="conteudo">
        {carregando && <Carregando />}
        {erro && (
          <div className="conteiner-landing py-14">
            <EstadoDeErro mensagem={erro} aoTentarDeNovo={recarregar} />
          </div>
        )}
        {dados && !carregando && (
          <>
            <Hero perfil={dados.perfil} />
            <FaixaDeTemas />
            <Secao id="frentes" numero={proximo()} titulo="Frentes de trabalho" sangrado>
              <FrentesDeTrabalho aoEscolher={setAssunto} />
            </Secao>
            {abas.length > 0 && (
              <Secao id="experiencia" numero={proximo()} titulo="Experiência">
                <Experiencias experiencias={dados.experiencias} aba={aba} aoTrocarAba={setAba} />
              </Secao>
            )}
            <SalaInterativa numero={proximo()} />
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
      <Rodape>{pronto && dados && <Assinatura nome={dados.perfil.nome_exibicao} />}</Rodape>
    </div>
  )
}
