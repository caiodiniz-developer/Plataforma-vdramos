import { ArrowUpRightIcon } from 'lucide-react'
import { useRef } from 'react'
import type { PerfilPublico } from '@/dados/landing'
import type { Assunto } from '@/dominio/contato'
import { deBloco, deRegua, gsap, RECORTE_ABERTO, useMovimento } from '@/lib/movimento'
import { FormularioDeContato } from './FormularioDeContato'

type Canal = { rotulo: string; valor: string; href: string; externo: boolean }

function canaisDoPerfil(perfil: PerfilPublico): Canal[] {
  const canais: Canal[] = []
  if (perfil.email_contato) {
    canais.push({
      rotulo: 'E-mail',
      valor: perfil.email_contato,
      href: `mailto:${perfil.email_contato}`,
      externo: false,
    })
  }
  if (perfil.linkedin_url) {
    canais.push({
      rotulo: 'LinkedIn',
      valor: perfil.linkedin_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
      href: perfil.linkedin_url,
      externo: true,
    })
  }
  if (perfil.telefone) {
    canais.push({
      rotulo: 'Telefone',
      valor: perfil.telefone,
      href: `tel:${perfil.telefone.replace(/[^\d+]/g, '')}`,
      externo: false,
    })
  }
  for (const link of perfil.outros_links) {
    canais.push({ rotulo: link.rotulo, valor: link.url.replace(/^https?:\/\//, ''), href: link.url, externo: true })
  }
  return canais
}

/**
 * Contato: texto de orientação e canais à esquerda, formulário à direita
 * (PRD, seção 5 — Landing). Sem canais cadastrados, o formulário ocupa a
 * largura toda ao lado do texto.
 *
 * Movimento: a régua de cada canal se desenha e a moldura do formulário abre
 * por recorte quando entra na tela.
 */
export function Contato({ perfil, assunto }: { perfil: PerfilPublico; assunto?: Assunto }) {
  const raiz = useRef<HTMLDivElement>(null)
  const canais = canaisDoPerfil(perfil)

  useMovimento(raiz, (c, q) => {
    gsap
      .timeline({ scrollTrigger: { trigger: raiz.current, start: 'top 85%' } })
      .from(q('[data-regua]'), { ...deRegua(c), stagger: 0.08 }, 0)
      .from(q('[data-apoio]'), { ...deBloco(c, 20), stagger: 0.06 }, 0)
      .fromTo(
        q('[data-moldura]'),
        { clipPath: c.completo ? 'inset(0% 0% 100% 0%)' : 'inset(0% 0% 12% 0%)', opacity: c.completo ? 1 : 0 },
        // Depois de aberto, o recorte sai: o anel de foco dos campos não pode ser cortado.
        { clipPath: RECORTE_ABERTO, opacity: 1, duration: c.completo ? 0.8 : 0.5, ease: 'power3.out', clearProps: 'clipPath,opacity' },
        0,
      )
  })

  return (
    <div ref={raiz} className="grid gap-(--espaco-bloco) lg:grid-cols-12 lg:gap-x-6">
      <div className="flex flex-col gap-(--espaco-item) lg:col-span-4">
        <p data-apoio className="max-w-[24ch] text-2xl leading-[1.3] md:text-[32px]">
          Conte o que você precisa. A resposta chega no e-mail que você informar.
        </p>
        {canais.length > 0 && (
          <ul>
            {canais.map((canal) => (
              <li key={canal.href}>
                <span aria-hidden="true" data-regua className="block h-0.5 origin-left bg-foreground" />
                <div data-apoio className="flex flex-col gap-1 py-6">
                  <p className="eyebrow text-muted-foreground">{canal.rotulo}</p>
                  <a
                    href={canal.href}
                    data-cursor="Abrir"
                    className="group flex min-h-11 items-center justify-between gap-4 font-mono text-xl font-bold md:text-2xl"
                    {...(canal.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    <span className="min-w-0 truncate underline decoration-2 underline-offset-4">{canal.valor}</span>
                    {canal.externo && <span className="sr-only">(abre em nova aba)</span>}
                    <ArrowUpRightIcon
                      aria-hidden="true"
                      className="size-6 shrink-0 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                    />
                  </a>
                </div>
              </li>
            ))}
            <li aria-hidden="true" className="h-0.5 bg-foreground" />
          </ul>
        )}
      </div>
      <div data-moldura className="border-2 bg-card p-5 md:p-12 lg:col-span-7 lg:col-start-6">
        {/* A chave remonta o formulário quando uma frente de trabalho escolhe o assunto. */}
        <FormularioDeContato key={assunto ?? ''} assuntoInicial={assunto} />
      </div>
    </div>
  )
}
