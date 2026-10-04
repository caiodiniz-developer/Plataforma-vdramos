import { RadioIcon } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EstadoDeErro } from '@/componentes/EstadoDeErro'
import { AtividadesDaTurma } from '@/componentes/turma/AtividadesDaTurma'
import { Calendario } from '@/componentes/turma/Calendario'
import { InformacoesDoCurso } from '@/componentes/turma/InformacoesDoCurso'
import { Materiais } from '@/componentes/turma/Materiais'
import { useSessao } from '@/contextos/Sessao'
import { sair } from '@/dados/sessao'
import { buscarTurma, minhasTurmas, SEM_ACESSO_A_TURMA, type Turma as DadosDaTurma } from '@/dados/turma'
import { formatarData } from '@/dominio/tempo'
import { ROTULO_STATUS_TURMA, turmaSomenteLeitura } from '@/dominio/turma'
import { useConsulta } from '@/hooks/useConsulta'

const ROTULO_MODALIDADE = { presencial: 'Presencial', online: 'Online', hibrido: 'Híbrido' } as const

async function carregar(codigo: string) {
  const [turma, turmas] = await Promise.all([buscarTurma(codigo), minhasTurmas()])
  return { turma, turmas }
}

function Cabecalho({ turma, turmas }: { turma: DadosDaTurma; turmas: { codigo: string; nome_curso: string }[] }) {
  const navegar = useNavigate()
  const { perfil, recarregar } = useSessao()

  async function encerrarSessao() {
    await sair()
    recarregar()
    navegar('/aluno/entrar', { replace: true })
  }

  return (
    <header className="border-b-2">
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-10">
        <Link to="/" className="font-mono text-lg font-bold tracking-[-0.02em]">
          Vitor Ramos
        </Link>
        <nav aria-label="Área do aluno" className="flex flex-wrap items-center gap-3">
          {turmas.length > 1 && (
            <Select value={turma.codigo} onValueChange={(codigo) => navegar(`/aluno/turmas/${codigo}`)}>
              <SelectTrigger size="sm" className="w-auto min-w-[200px]" aria-label="Trocar de turma">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {turmas.map((t) => (
                  <SelectItem key={t.codigo} value={t.codigo}>
                    {t.nome_curso} · {t.codigo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button asChild size="sm" variant="ghost">
            <Link to="/aluno/meus-dados">Meus dados</Link>
          </Button>
          <Button size="sm" variant="link" onClick={() => void encerrarSessao()}>
            Sair{perfil ? ` (${perfil.nome.split(' ')[0]})` : ''}
          </Button>
        </nav>
      </div>
    </header>
  )
}

/** PRD, seção 5 — Turma do aluno: cabeçalho, faixa de aula ao vivo e abas. */
export default function Turma() {
  const { codigo = '' } = useParams()
  const navegar = useNavigate()
  const { recarregar: recarregarSessao } = useSessao()
  const { dados, carregando, erro, recarregar } = useConsulta(() => carregar(codigo), [codigo])

  // Seção 7: ID desativado com sessão aberta → a leitura volta vazia e o app sai.
  useEffect(() => {
    if (erro !== SEM_ACESSO_A_TURMA) return
    void sair().then(() => {
      recarregarSessao()
      navegar('/aluno/entrar', { replace: true })
    })
  }, [erro, navegar, recarregarSessao])

  if (carregando && !dados) {
    return (
      <div className="mx-auto flex max-w-[1080px] flex-col gap-5 px-4 py-14 md:px-10" aria-busy="true">
        <span className="sr-only">Carregando</span>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-10 w-full max-w-[420px]" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }

  if (erro || !dados) {
    return (
      <div className="mx-auto max-w-[1080px] px-4 py-14 md:px-10">
        <EstadoDeErro mensagem={erro ?? 'Turma não encontrada.'} aoTentarDeNovo={recarregar} />
      </div>
    )
  }

  const { turma, turmas } = dados
  const somenteLeitura = turmaSomenteLeitura(turma.status)
  const aoVivo = somenteLeitura ? undefined : turma.encontros.find((e) => e.sessao?.status === 'aberta')

  return (
    <div className="flex min-h-screen flex-col">
      <Cabecalho turma={turma} turmas={turmas} />
      <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-4 py-10 md:px-10 md:py-14">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="eyebrow text-muted-foreground">Turma {turma.codigo}</p>
            {somenteLeitura && <Badge variant="neutro">{ROTULO_STATUS_TURMA[turma.status]} · somente leitura</Badge>}
          </div>
          <h1 className="text-[28px] md:text-[36px]">{turma.curso.nome}</h1>
          <p className="text-[13px] font-medium text-muted-foreground">
            {turma.instituicao} · {turma.cidade} · {ROTULO_MODALIDADE[turma.modalidade]} ·{' '}
            {formatarData(turma.data_inicio)} a {formatarData(turma.data_fim)}
            {turma.vagas && ` · ${turma.vagas} vagas`}
          </p>
        </div>

        {aoVivo && (
          <Alert className="border-2 border-primary bg-card">
            <RadioIcon aria-hidden="true" />
            <AlertTitle className="font-bold">Aula ao vivo agora</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>
                Encontro {aoVivo.numero} · {aoVivo.titulo}
              </span>
              <Button asChild>
                <Link to={`/aluno/turmas/${turma.codigo}/ao-vivo`}>Entrar na aula ao vivo</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="calendario">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="calendario">Calendário</TabsTrigger>
            <TabsTrigger value="materiais">Materiais</TabsTrigger>
            <TabsTrigger value="curso">Curso</TabsTrigger>
            <TabsTrigger value="atividades">Atividades</TabsTrigger>
          </TabsList>
          <TabsContent value="calendario">
            <Calendario turma={turma} />
          </TabsContent>
          <TabsContent value="materiais">
            <Materiais turma={turma} />
          </TabsContent>
          <TabsContent value="curso">
            <InformacoesDoCurso turma={turma} />
          </TabsContent>
          <TabsContent value="atividades">
            <AtividadesDaTurma turmaId={turma.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
