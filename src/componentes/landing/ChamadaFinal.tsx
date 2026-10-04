import { ArrowRightIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Revelar } from '@/componentes/Revelar'

/**
 * Faixa final em azul. Texto branco sobre o azul (4,55:1), sempre em tamanho
 * grande; botões em Tinta e em contorno branco.
 */
export function ChamadaFinal() {
  return (
    <section className="border-y-2 bg-primary text-primary-foreground">
      <Revelar className="mx-auto flex max-w-[1080px] flex-col gap-8 px-4 py-16 md:flex-row md:items-end md:justify-between md:px-10 md:py-20">
        <div className="flex max-w-[620px] flex-col gap-4">
          <p className="eyebrow">Próximo passo</p>
          <h2 className="text-[32px] md:text-[44px]">Dados e IA com rigor técnico e clareza didática.</h2>
          <p className="text-lg">Conte o que sua equipe precisa: uma palestra, um treinamento ou um projeto.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" variant="secondary" className="border-tinta bg-tinta text-papel hover:border-papel hover:bg-papel hover:text-tinta">
            <a href="#contato">
              Enviar mensagem
              <ArrowRightIcon aria-hidden="true" />
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
          >
            <Link to="/aluno/entrar">Sou aluno</Link>
          </Button>
        </div>
      </Revelar>
    </section>
  )
}
