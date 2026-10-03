import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { aoMudarSessao, buscarPerfilLogado, type Papel, type PerfilLogado } from '@/dados/sessao'
import { useConsulta } from '@/hooks/useConsulta'

type ContextoSessao = {
  perfil: PerfilLogado | null
  carregando: boolean
  recarregar: () => void
}

const Contexto = createContext<ContextoSessao>({ perfil: null, carregando: true, recarregar: () => {} })

/** Mantém o perfil do usuário logado disponível para as rotas protegidas. */
export function ProvedorDeSessao({ children }: { children: ReactNode }) {
  const { dados, carregando, recarregar } = useConsulta(buscarPerfilLogado, [])

  useEffect(() => aoMudarSessao(recarregar), [recarregar])

  return <Contexto.Provider value={{ perfil: dados, carregando, recarregar }}>{children}</Contexto.Provider>
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
