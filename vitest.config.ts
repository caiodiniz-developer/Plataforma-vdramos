import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'supabase/tests/**/*.test.ts'],
    setupFiles: ['src/teste/preparar.ts'],
    // Os testes de banco sobem um Postgres em memória por arquivo.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
