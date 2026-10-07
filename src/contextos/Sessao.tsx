import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { aoMudarSessao, buscarPerfilLogado, sair, type Papel, type PerfilLogado } from '@/dados/sessao'

type ContextoSessao = {
  perfil: PerfilLogado | null
  carregando: boolean
  /**
   * Relê o perfil do usuário logado. A promessa só resolve depois que o
   * contexto foi atualizado: quem acabou de fazer login ou logout deve
   * esperar por ela antes de navegar, senão a rota protegida ainda enxerga o
   * estado antigo e devolve o usuário para a tela de entrada.
   */
  recarregar: () => Promise<void>
  /**
   * Encerra a sessão. Com `destino`, a rota protegida em que a pessoa está
   * leva para lá em vez da tela de entrada (ex.: início, após excluir a conta).
   * O destino é registrado antes do logout, então não depende de qual evento
   * assíncrono termina primeiro.
   */
  encerrar: (destino?: string) => Promise<void>
}

const Contexto = createContext<ContextoSessao>({
  perfil: null,
  carregando: true,
  recarregar: () => Promise.resolve(),
  encerrar: () => Promise.resolve(),
})

type Estado = { perfil: PerfilLogado | null; carregando: boolean; destinoAoSair: string | null }

/** Para onde a rota protegida manda quem acabou de sair (null = tela de entrada do papel). */
const DestinoAoSair = createContext<string | null>(null)

/** Mantém o perfil do usuário logado disponível para as rotas protegidas. */
export function ProvedorDeSessao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ perfil: null, carregando: true, destinoAoSair: null })

  const recarregar = useCallback(async () => {
    let perfil: PerfilLogado | null = null
    try {
      perfil = await buscarPerfilLogado()
    } catch {
      // Falha ao ler o perfil: trata como sem sessão; as telas pedem novo login.
    }
    // Um novo login limpa o destino de saída que tenha ficado registrado.
    setEstado((atual) => ({ perfil, carregando: false, destinoAoSair: perfil ? null : atual.destinoAoSair }))
  }, [])

  const encerrar = useCallback(
    async (destino?: string) => {
      setEstado((atual) => ({ ...atual, destinoAoSair: destino ?? null }))
      await sair()
      await recarregar()
    },
    [recarregar],
  )

  useEffect(() => {
    // Carga inicial e a cada mudança de sessão (login, logout, renovação).
    const cancelar = aoMudarSessao(() => void recarregar())
    // O estado só muda depois da resposta do servidor (após o await), nunca de forma síncrona no efeito.
    // oxlint-disable-next-line react/set-state-in-effect
    recarregar().catch(() => {})
    return cancelar
  }, [recarregar])

  return (
    <Contexto.Provider value={{ perfil: estado.perfil, carregando: estado.carregando, recarregar, encerrar }}>
      <DestinoAoSair.Provider value={estado.destinoAoSair}>{children}</DestinoAoSair.Provider>
    </Contexto.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSessao(): ContextoSessao {
  return useContext(Contexto)
}

const ENTRADA: Record<Papel, string> = { aluno: '/aluno/entrar', admin: '/admin/entrar' }

/**
 * Rota que exige um papel (PRD, seção 2). Sem sessão, ou com o papel errado,
 * volta para a tela de entrada correspondente. A proteção de verdade é a RLS;
 * este componente só evita mostrar uma tela que viria vazia.
 */
export function RotaProtegida({ papel, children }: { papel: Papel; children: ReactNode }) {
  const { perfil, carregando } = useSessao()
  const destinoAoSair = useContext(DestinoAoSair)
  const local = useLocation()

  if (carregando) {
    return (
      <div className="mx-auto flex max-w-[1080px] flex-col gap-4 px-4 py-14 md:px-10" aria-busy="true">
        <span className="sr-only">Carregando</span>
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (!perfil || perfil.papel !== papel) {
    return <Navigate to={destinoAoSair ?? ENTRADA[papel]} replace state={{ de: local.pathname }} />
  }
  return <>{children}</>
}
