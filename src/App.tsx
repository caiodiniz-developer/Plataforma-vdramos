import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import Landing from '@/paginas/Landing'

const Privacidade = lazy(() => import('@/paginas/Privacidade'))
const NaoEncontrada = lazy(() => import('@/paginas/NaoEncontrada'))

/**
 * Rotas (PRD, seção 2): `/` e `/privacidade` são públicas; `/aluno/*` exige
 * papel aluno e `/admin/*` exige papel admin.
 */
function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-10 text-muted-foreground">Carregando</div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="*" element={<NaoEncontrada />} />
        </Routes>
      </Suspense>
      <Toaster position="bottom-right" />
    </BrowserRouter>
  )
}

export default App
