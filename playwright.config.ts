import { defineConfig, devices } from '@playwright/test'

/**
 * Testes de ponta a ponta num navegador real, sobre o build de produção.
 *
 * Dois servidores, porque o endereço do Supabase entra no build:
 *   4173 — sem backend: landing, rotas públicas e redirecionamentos.
 *   4174 — com a API do Supabase simulada na rede (e2e/apoio/supabase.ts):
 *          telas do aluno e do professor. Os arquivos `*.backend.spec.ts`
 *          rodam aqui.
 *
 * As variáveis são definidas aqui, e não lidas do `.env`, para os testes
 * darem o mesmo resultado em qualquer máquina.
 */
const SEM_BACKEND = 'http://localhost:4173'
const COM_BACKEND = 'http://localhost:4174'

const comuns = { locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', trace: 'retain-on-failure' as const }
const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
const celular = devices['Pixel 7']

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.resultados',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list']],
  projects: [
    { name: 'desktop', testIgnore: /\.backend\.spec\.ts$/, use: { ...comuns, ...desktop, baseURL: SEM_BACKEND } },
    { name: 'celular', testIgnore: /\.backend\.spec\.ts$/, use: { ...comuns, ...celular, baseURL: SEM_BACKEND } },
    { name: 'backend-desktop', testMatch: /\.backend\.spec\.ts$/, use: { ...comuns, ...desktop, baseURL: COM_BACKEND } },
    { name: 'backend-celular', testMatch: /\.backend\.spec\.ts$/, use: { ...comuns, ...celular, baseURL: COM_BACKEND } },
  ],
  webServer: [
    {
      command: 'npx vite build --outDir dist-e2e-sem-backend && npx vite preview --outDir dist-e2e-sem-backend --port 4173 --strictPort',
      url: SEM_BACKEND,
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'npx vite build --outDir dist-e2e-com-backend && npx vite preview --outDir dist-e2e-com-backend --port 4174 --strictPort',
      url: COM_BACKEND,
      env: { VITE_SUPABASE_URL: 'http://localhost:54399', VITE_SUPABASE_ANON_KEY: 'chave-publica-de-teste' },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
})
