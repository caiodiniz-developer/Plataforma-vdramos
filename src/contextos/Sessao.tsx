import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { aoMudarSessao, buscarPerfilLogado, type Papel, type PerfilLogado } from '@/dados/sessao'

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
}

const Contexto = createContext<ContextoSessao>({
  perfil: null,
  carregando: true,
  recarregar: () => Promise.resolve(),
})

/** Mantém o perfil do usuário logado disponível para as rotas protegidas. */
export function ProvedorDeSessao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<{ perfil: PerfilLogado | null; carregando: boolean }>({
    perfil: null,
    carregando: true,
  })

  const recarregar = useCallback(async () => {
    try {
      setEstado({ perfil: await buscarPerfilLogado(), carregando: false })
    } catch {
      // Falha ao ler o perfil: trata como sem sessão; as telas pedem novo login.
      setEstado({ perfil: null, carregando: false })
    }
  }, [])

  useEffect(() => {
    // Carga inicial e a cada mudança de sessão (login, logout, renovação).
    const cancelar = aoMudarSessao(() => void recarregar())
    // O estado só muda depois da resposta do servidor (após o await), nunca de forma síncrona no efeito.
    // oxlint-disable-next-line react/set-state-in-effect
    recarregar().catch(() => {})
    return cancelar
  }, [recarregar])

  return <Contexto.Provider value={{ ...estado, recarregar }}>{children}</Contexto.Provider>
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
    return <Navigate to={ENTRADA[papel]} replace state={{ de: local.pathname }} />
  }
  return <>{children}</>
}
