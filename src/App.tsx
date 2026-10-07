import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { LayoutAdmin } from '@/componentes/admin/LayoutAdmin'
import { LayoutAluno } from '@/componentes/plataforma/LayoutAluno'
import { PortaoDoTermo } from '@/componentes/PortaoDoTermo'
import { Toaster } from '@/components/ui/sonner'
import { ProvedorDeSessao, RotaProtegida } from '@/contextos/Sessao'

// A landing carrega à parte: o GSAP só é baixado por quem abre a página inicial.
const Landing = lazy(() => import('@/paginas/Landing'))
const Privacidade = lazy(() => import('@/paginas/Privacidade'))
const Entrar = lazy(() => import('@/paginas/aluno/Entrar'))
const Inicio = lazy(() => import('@/paginas/aluno/Inicio'))
const Conteudos = lazy(() => import('@/paginas/aluno/Conteudos'))
const ConteudoDetalhe = lazy(() => import('@/paginas/aluno/ConteudoDetalhe'))
const Atividades = lazy(() => import('@/paginas/aluno/Atividades').then((m) => ({ default: m.Atividades })))
const Questoes = lazy(() => import('@/paginas/aluno/Atividades').then((m) => ({ default: m.Questoes })))
const Duvidas = lazy(() => import('@/paginas/aluno/Duvidas'))
const Mensagens = lazy(() => import('@/paginas/aluno/Comunicacao').then((m) => ({ default: m.Mensagens })))
const Feedback = lazy(() => import('@/paginas/aluno/Comunicacao').then((m) => ({ default: m.Feedback })))
const Avisos = lazy(() => import('@/paginas/aluno/Comunicacao').then((m) => ({ default: m.Avisos })))
const Turma = lazy(() => import('@/paginas/aluno/Turma'))
const AoVivo = lazy(() => import('@/paginas/aluno/AoVivo'))
const MeusDados = lazy(() => import('@/paginas/aluno/MeusDados'))
const EntrarAdmin = lazy(() => import('@/paginas/admin/Entrar'))
const Painel = lazy(() => import('@/paginas/admin/Painel'))
const MensagensDeContato = lazy(() => import('@/paginas/admin/MensagensDeContato'))
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
            <Route
              path="/aluno"
              element={
                <RotaProtegida papel="aluno">
                  <PortaoDoTermo>
                    <LayoutAluno />
                  </PortaoDoTermo>
                </RotaProtegida>
              }
            >
              <Route index element={<Inicio />} />
              <Route path="conteudos" element={<Conteudos />} />
              <Route path="conteudos/:id" element={<ConteudoDetalhe />} />
              <Route path="atividades" element={<Atividades />} />
              <Route path="questoes" element={<Questoes />} />
              <Route path="duvidas" element={<Duvidas />} />
              <Route path="mensagens" element={<Mensagens />} />
              <Route path="feedback" element={<Feedback />} />
              <Route path="avisos" element={<Avisos />} />
            </Route>
            <Route
              path="/aluno/turmas/:codigo"
              element={
                <RotaProtegida papel="aluno">
                  <PortaoDoTermo>
                    <Turma />
                  </PortaoDoTermo>
                </RotaProtegida>
              }
            />
            <Route
              path="/aluno/turmas/:codigo/ao-vivo"
              element={
                <RotaProtegida papel="aluno">
                  <PortaoDoTermo>
                    <AoVivo />
                  </PortaoDoTermo>
                </RotaProtegida>
              }
            />
            <Route
              path="/aluno/meus-dados"
              element={
                <RotaProtegida papel="aluno">
                  <MeusDados />
                </RotaProtegida>
              }
            />
            <Route path="/admin/entrar" element={<EntrarAdmin />} />
            <Route
              path="/admin"
              element={
                <RotaProtegida papel="admin">
                  <LayoutAdmin />
                </RotaProtegida>
              }
            >
              <Route index element={<Painel />} />
              <Route path="mensagens" element={<MensagensDeContato />} />
            </Route>
            <Route path="*" element={<NaoEncontrada />} />
          </Routes>
        </Suspense>
      </ProvedorDeSessao>
      <Toaster position="bottom-right" />
    </BrowserRouter>
  )
}

export default App
