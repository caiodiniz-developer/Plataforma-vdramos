import { defineConfig, devices } from '@playwright/test'

/**
 * Testes de ponta a ponta num navegador real. Sobem o build de produção
 * (`vite preview`) sem backend: cobrem a landing, as rotas públicas e os
 * redirecionamentos das áreas protegidas.
 */
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.resultados',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
