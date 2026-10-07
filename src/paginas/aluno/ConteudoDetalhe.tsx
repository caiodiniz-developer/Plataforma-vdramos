import { ArrowLeftIcon, ArrowUpRightIcon, DownloadIcon, Loader2Icon, PlayIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Markdown } from '@/componentes/Markdown'
import { Carregado } from '@/componentes/plataforma/Blocos'
import { buscarConteudo, registrarAcesso, ROTULO_TIPO_CONTEUDO, urlAssinada } from '@/dados/apoio'
import { formatarDataHora } from '@/dominio/tempo'
import { useConsulta } from '@/hooks/useConsulta'

/** Abre um arquivo do bucket privado com uma URL assinada nova a cada clique. */
function BotaoDeArquivo({ caminho }: { caminho: string }) {
  const [abrindo, setAbrindo] = useState(false)
  async function abrir() {
    if (abrindo) return
    setAbrindo(true)
    try {
      window.open(await urlAssinada(caminho), '_blank', 'noopener,noreferrer')
    } catch (falha) {
      toast.error((falha as Error).message, { action: { label: 'Tentar de novo', onClick: () => void abrir() } })
    } finally {
      setAbrindo(false)
    }
  }
  return (
    <Button variant="outline" disabled={abrindo} onClick={() => void abrir()}>
      {abrindo ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <DownloadIcon aria-hidden="true" />}
      Abrir arquivo
    </Button>
  )
}

function Capa({ caminho, titulo }: { caminho: string; titulo: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let ativo = true
    urlAssinada(caminho)
      .then((u) => ativo && setUrl(u))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [caminho])
  if (!url) return null
  return <img src={url} alt={`Capa de ${titulo}`} className="aspect-[16/7] w-full border-2 object-cover" />
}

/** Página de um conteúdo. Abrir a página registra o acesso (progresso). */
export default function ConteudoDetalhe() {
  const { id = '' } = useParams()
  const consulta = useConsulta(() => buscarConteudo(id), [id])

  useEffect(() => {
    // O registro é silencioso: falhar aqui não impede a leitura.
    if (consulta.dados?.id === id) registrarAcesso(id).catch(() => {})
  }, [consulta.dados?.id, id])

  return (
    <>
      <Button asChild variant="link" size="sm" className="self-start px-0">
        <Link to="/aluno/conteudos">
          <ArrowLeftIcon aria-hidden="true" />
          Conteúdos
        </Link>
      </Button>

      <Carregado consulta={consulta} linhas={4}>
        {(c) => (
          <article className="flex flex-col gap-6">
            <header className="flex flex-col gap-3 border-b-2 pb-5">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge variant={c.tipo === 'aula_extra' ? 'default' : 'outline'}>{ROTULO_TIPO_CONTEUDO[c.tipo]}</Badge>
                {c.publicado_em && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatarDataHora(c.publicado_em, 'America/Sao_Paulo')}
                  </span>
                )}
              </div>
              <h1 className="text-[28px] md:text-[34px]">{c.titulo}</h1>
              {c.descricao && <p className="max-w-[680px] text-lg text-muted-foreground">{c.descricao}</p>}
            </header>

            {c.capa_path && <Capa caminho={c.capa_path} titulo={c.titulo} />}

            {(c.video_url || c.link_url || c.arquivo_path) && (
              <div className="flex flex-wrap gap-3">
                {c.video_url && (
                  <Button asChild>
                    <a href={c.video_url} target="_blank" rel="noopener noreferrer">
                      <PlayIcon aria-hidden="true" />
                      Assistir ao vídeo
                      <span className="sr-only">(abre em nova aba)</span>
                    </a>
                  </Button>
                )}
                {c.link_url && (
                  <Button asChild variant="outline">
                    <a href={c.link_url} target="_blank" rel="noopener noreferrer">
                      Abrir link
                      <ArrowUpRightIcon aria-hidden="true" />
                      <span className="sr-only">(abre em nova aba)</span>
                    </a>
                  </Button>
                )}
                {c.arquivo_path && <BotaoDeArquivo caminho={c.arquivo_path} />}
              </div>
            )}

            {c.corpo_md && (
              <Card>
                <CardContent>
                  <Markdown>{c.corpo_md}</Markdown>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t-2 pt-5">
              <p className="text-sm text-muted-foreground">Ficou com dúvida sobre este conteúdo?</p>
              <Button asChild variant="secondary" size="sm">
                <Link to={`/aluno/duvidas?conteudo=${c.id}`}>Perguntar ao professor</Link>
              </Button>
            </div>
          </article>
        )}
      </Carregado>
    </>
  )
}
