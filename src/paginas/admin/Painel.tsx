import { Link } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EstadoDeErro } from '@/componentes/EstadoDeErro'
import { useSessao } from '@/contextos/Sessao'
import { buscarResumoDoPainel } from '@/dados/admin'
import { useConsulta } from '@/hooks/useConsulta'

function Numero({ rotulo, valor, para }: { rotulo: string; valor: number; para?: string }) {
  const conteudo = (
    <Card className="h-full">
      <CardContent className="flex flex-col gap-2">
        <p className="eyebrow text-muted-foreground">{rotulo}</p>
        <p className="font-mono text-[36px] leading-none font-bold">{valor}</p>
      </CardContent>
    </Card>
  )
  return para ? (
    <Link to={para} className="block hover:[&>div]:bg-accent">
      {conteudo}
    </Link>
  ) : (
    conteudo
  )
}

/** Painel inicial do professor. */
export default function Painel() {
  const { perfil } = useSessao()
  const { dados, carregando, erro, recarregar } = useConsulta(buscarResumoDoPainel, [])

  return (
    <div className="flex max-w-[1080px] flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="eyebrow text-muted-foreground">Painel</p>
        <h1 className="text-[28px] md:text-[36px]">Olá{perfil ? `, ${perfil.nome.split(' ')[0]}` : ''}</h1>
      </div>

      {carregando && !dados && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          <span className="sr-only">Carregando</span>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}
      {erro && <EstadoDeErro mensagem={erro} aoTentarDeNovo={recarregar} />}
      {dados && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Numero rotulo="Turmas ativas" valor={dados.turmasAtivas} />
          <Numero rotulo="Turmas planejadas" valor={dados.turmasPlanejadas} />
          <Numero rotulo="Alunos inscritos" valor={dados.inscritos} />
          <Numero rotulo="Contatos não lidos" valor={dados.mensagensNaoLidas} para="/admin/mensagens" />
        </div>
      )}
      {dados && dados.sessoesAbertas > 0 && (
        <p className="font-bold">
          {dados.sessoesAbertas === 1 ? 'Há 1 sessão ao vivo aberta.' : `Há ${dados.sessoesAbertas} sessões ao vivo abertas.`}
        </p>
      )}
    </div>
  )
}
