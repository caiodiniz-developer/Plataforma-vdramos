import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ubuntu/latin-500.css'
import '@fontsource/ubuntu/latin-700.css'
import '@fontsource/ubuntu-mono/latin-400.css'
import '@fontsource/ubuntu-mono/latin-700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
