import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // As Edge Functions importam o SDK pelo especificador do Deno; nos testes
      // ele é trocado por um Supabase em memória (supabase/tests/funcoes).
      "npm:@supabase/supabase-js@2": path.resolve(
        import.meta.dirname,
        "./supabase/tests/funcoes/sdk.ts",
      ),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "supabase/tests/**/*.test.ts"],
    setupFiles: ["src/teste/preparar.ts"],
    // Em ambientes mais restritos (como o Windows do cliente), o paralelismo
    // elevado pode esgotar memória antes mesmo do teste real rodar.
    maxWorkers: 1,
    fileParallelism: false,
    // Os testes de banco sobem um Postgres em memória por arquivo.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
