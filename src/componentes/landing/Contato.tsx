import { LinkIcon, MailIcon, PhoneIcon, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { PerfilPublico } from '@/dados/landing'
import { FormularioDeContato } from './FormularioDeContato'

type Canal = { icone: LucideIcon; rotulo: string; valor: string; href: string; externo: boolean }

function canaisDoPerfil(perfil: PerfilPublico): Canal[] {
  const canais: Canal[] = []
  if (perfil.email_contato) {
    canais.push({
      icone: MailIcon,
      rotulo: 'E-mail',
      valor: perfil.email_contato,
      href: `mailto:${perfil.email_contato}`,
      externo: false,
    })
  }
  if (perfil.linkedin_url) {
    canais.push({
      icone: LinkIcon,
      rotulo: 'LinkedIn',
      valor: perfil.linkedin_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
      href: perfil.linkedin_url,
      externo: true,
    })
  }
  if (perfil.telefone) {
    canais.push({
      icone: PhoneIcon,
      rotulo: 'Telefone',
      valor: perfil.telefone,
      href: `tel:${perfil.telefone.replace(/[^\d+]/g, '')}`,
      externo: false,
    })
  }
  for (const link of perfil.outros_links) {
    canais.push({ icone: LinkIcon, rotulo: link.rotulo, valor: link.url.replace(/^https?:\/\//, ''), href: link.url, externo: true })
  }
  return canais
}

/** Contato: cartões de canal e formulário (PRD, seção 5 — Landing). */
export function Contato({ perfil }: { perfil: PerfilPublico }) {
  const canais = canaisDoPerfil(perfil)

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.6fr]">
      {canais.length > 0 && (
        <ul className="flex flex-col gap-4">
          {canais.map((canal) => (
            <li key={canal.href}>
              <Card>
                <CardContent className="flex items-center gap-4">
                  <canal.icone aria-hidden="true" className="size-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="eyebrow text-muted-foreground">{canal.rotulo}</p>
                    <a
                      href={canal.href}
                      className="block truncate font-bold underline"
                      {...(canal.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {canal.valor}
                    </a>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Card className={canais.length === 0 ? 'md:col-span-2' : undefined}>
        <CardContent>
          <FormularioDeContato />
        </CardContent>
      </Card>
    </div>
  )
}
