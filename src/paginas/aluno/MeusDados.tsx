import { DownloadIcon, Loader2Icon } from 'lucide-react'
import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EstadoDeErro } from '@/componentes/EstadoDeErro'
import { useSessao } from '@/contextos/Sessao'
import { buscarMeusDados, excluirConta, exportarMeusDados, registrarConsentimento } from '@/dados/meus-dados'
import { sair } from '@/dados/sessao'
import { concedeu, consentimentoVigente, ROTULO_FINALIDADE } from '@/dominio/consentimento'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'

const FUSO_PADRAO = 'America/Sao_Paulo'

const ROTULO_ORIGEM = { cadastro: 'Cadastro', area_aluno: 'Área do aluno', admin: 'Professor' } as const

function Cartao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-[19px]">{titulo}</h2>
        </CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

/** PRD F8: perfil, turmas, consentimentos e ações de privacidade do aluno. */
export default function MeusDados() {
  const id = useId()
  const navegar = useNavigate()
  const { recarregar: recarregarSessao } = useSessao()
  const { dados, carregando, erro, recarregar } = useConsulta(buscarMeusDados, [])
  const [salvando, setSalvando] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  async function alterarComunicacao(ligado: boolean) {
    if (salvando) return
    setSalvando(true)
    try {
      await registrarConsentimento('comunicacao_professor', ligado)
      toast.success(ligado ? 'Comunicações ativadas' : 'Comunicações desativadas')
      recarregar()
    } catch (falha) {
      toast.error((falha as Error).message, {
        action: { label: 'Tentar de novo', onClick: () => void alterarComunicacao(ligado) },
      })
    } finally {
      setSalvando(false)
    }
  }

  async function baixar() {
    if (baixando) return
    setBaixando(true)
    try {
      const conteudo = JSON.stringify(await exportarMeusDados(), null, 2)
      const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'meus-dados.json'
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Arquivo gerado')
    } catch (falha) {
      toast.error((falha as Error).message, { action: { label: 'Tentar de novo', onClick: () => void baixar() } })
    } finally {
      setBaixando(false)
    }
  }

  async function excluir() {
    if (excluindo) return
    setExcluindo(true)
    try {
      await excluirConta()
      toast.success('Conta excluída')
      // Sai da tela protegida antes de encerrar a sessão; na ordem inversa, a
      // rota protegida mandaria a pessoa para a tela de login.
      navegar('/', { replace: true })
      await sair()
      await recarregarSessao()
    } catch (falha) {
      toast.error((falha as Error).message)
      setExcluindo(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-2">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between px-4 py-3 md:px-10">
          <Link to="/" className="font-mono text-lg font-bold tracking-[-0.02em]">
            Vitor Ramos
          </Link>
          <Button size="sm" variant="link" onClick={() => navegar(-1)}>
            Voltar
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[820px] flex-col gap-6 px-4 py-10 md:px-10 md:py-14">
        <div className="flex flex-col gap-3">
          <p className="eyebrow text-muted-foreground">Privacidade</p>
          <h1 className="text-[28px] md:text-[36px]">Meus dados</h1>
        </div>

        {carregando && !dados && (
          <div className="flex flex-col gap-4" aria-busy="true">
            <span className="sr-only">Carregando</span>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {erro && <EstadoDeErro mensagem={erro} aoTentarDeNovo={recarregar} />}

        {dados && (
          <>
            <Cartao titulo="Perfil">
              <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="eyebrow text-muted-foreground">Nome</dt>
                  <dd className="font-bold">{dados.perfil.nome}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-muted-foreground">E-mail</dt>
                  <dd className="font-bold break-all">{dados.perfil.email}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">A troca de e-mail é feita pelo professor.</p>
            </Cartao>

            <Cartao titulo="Turmas">
              {dados.inscricoes.length === 0 ? (
                <p className="text-muted-foreground">Você não está inscrito em nenhuma turma.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Curso</TableHead>
                      <TableHead>Turma</TableHead>
                      <TableHead>Último acesso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.inscricoes.map((inscricao) => (
                      <TableRow key={inscricao.id}>
                        <TableCell className="whitespace-normal font-bold">{inscricao.turma.curso.nome}</TableCell>
                        <TableCell>
                          <Link to={`/aluno/turmas/${inscricao.turma.codigo}`} className="font-mono underline">
                            {inscricao.turma.codigo}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono">
                          {inscricao.ultimo_acesso_em
                            ? formatarDataHora(inscricao.ultimo_acesso_em, FUSO_PADRAO)
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Cartao>

            <Cartao
              titulo="Consentimentos"
              descricao="Você pode mudar de ideia quando quiser. A mudança vale na hora."
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`${id}-comunicacao`} className="font-bold">
                      {ROTULO_FINALIDADE.comunicacao_professor}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {concedeu(dados.consentimentos, 'comunicacao_professor') ? 'Ativado' : 'Desativado'}
                    </p>
                  </div>
                  <Switch
                    id={`${id}-comunicacao`}
                    disabled={salvando}
                    checked={concedeu(dados.consentimentos, 'comunicacao_professor')}
                    onCheckedChange={(ligado) => void alterarComunicacao(ligado)}
                  />
                </div>

                <div className="flex items-start justify-between gap-4 border-t border-divisor pt-4">
                  <div className="flex flex-col gap-1">
                    <p className="font-bold">{ROTULO_FINALIDADE.uso_dados_pedagogicos}</p>
                    <p className="text-xs text-muted-foreground">
                      Aceito no termo de uso, versão{' '}
                      {consentimentoVigente(dados.consentimentos, 'uso_dados_pedagogicos')?.versao_termo ?? '—'}. Para
                      retirar, solicite a exclusão da conta.
                    </p>
                  </div>
                  <Badge variant="outline">
                    {concedeu(dados.consentimentos, 'uso_dados_pedagogicos') ? 'Concedido' : 'Não concedido'}
                  </Badge>
                </div>

                <details className="border-t border-divisor pt-4">
                  <summary className="eyebrow cursor-pointer text-muted-foreground">Histórico</summary>
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quando</TableHead>
                        <TableHead>Finalidade</TableHead>
                        <TableHead>Decisão</TableHead>
                        <TableHead>Origem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dados.consentimentos.map((c, indice) => (
                        <TableRow key={indice}>
                          <TableCell className="font-mono">{formatarDataHora(c.created_at, FUSO_PADRAO)}</TableCell>
                          <TableCell className="whitespace-normal">{ROTULO_FINALIDADE[c.finalidade]}</TableCell>
                          <TableCell>{c.concedido ? 'Concedido' : 'Negado ou revogado'}</TableCell>
                          <TableCell>{ROTULO_ORIGEM[c.origem]}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </details>
              </div>
            </Cartao>

            <Cartao titulo="Ações de privacidade">
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" disabled={baixando} onClick={() => void baixar()}>
                  {baixando ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <DownloadIcon aria-hidden="true" />}
                  Baixar meus dados
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Solicitar exclusão</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir sua conta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Seu perfil, suas inscrições, perguntas, mensagens e respostas são apagados. Você perde o
                        acesso às turmas. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={excluindo}
                        onClick={(evento) => {
                          // Mantém o diálogo aberto até o servidor confirmar.
                          evento.preventDefault()
                          void excluir()
                        }}
                      >
                        {excluindo && <Loader2Icon className="animate-spin" aria-hidden="true" />}
                        Excluir conta
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Cartao>
          </>
        )}
      </main>
    </div>
  )
}
