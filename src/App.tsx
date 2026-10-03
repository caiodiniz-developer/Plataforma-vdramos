import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { ProvedorDeSessao } from '@/contextos/Sessao'
import Landing from '@/paginas/Landing'

const Privacidade = lazy(() => import('@/paginas/Privacidade'))
const Entrar = lazy(() => import('@/paginas/aluno/Entrar'))
const NaoEncontrada = lazy(() => import('@/paginas/NaoEncontrada'))

/**
 * Rotas (PRD, seção 2): `/` e `/privacidade` são públicas; `/aluno/*` exige
 * papel aluno e `/admin/*` exige papel admin.
 */
function App() {
  return (
    <BrowserRouter>
      <ProvedorDeSessao>
      <Suspense fallback={<div className="p-10 text-muted-foreground">Carregando</div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/aluno/entrar" element={<Entrar />} />
          <Route path="*" element={<NaoEncontrada />} />
        </Routes>
      </Suspense>
      </ProvedorDeSessao>
      <Toaster position="bottom-right" />
    </BrowserRouter>
  )
}

export default App
