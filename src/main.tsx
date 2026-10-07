import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ubuntu/latin-500.css'
import '@fontsource/ubuntu/latin-700.css'
import '@fontsource/ubuntu-mono/latin-400.css'
import '@fontsource/ubuntu-mono/latin-700.css'
import './index.css'
import App from './App.tsx'
import { iniciarNivelDeMovimento } from './lib/nivelDeMovimento'

// Antes do primeiro render: o <html> já nasce com o nível de movimento.
iniciarNivelDeMovimento()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
