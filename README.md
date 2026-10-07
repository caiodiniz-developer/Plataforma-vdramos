# proj-plataforma-vitor-ramos

Plataforma Vitor Ramos (vitorramos.com): landing page pública e sala de aula interativa
(calendário, materiais, perguntas, mensagens, quizzes e pesquisas) com painel admin.

- Especificação completa: [`docs/PRD.md`](docs/PRD.md)
- Diretrizes para agentes e equipe: [`CLAUDE.md`](CLAUDE.md)
- Identidade visual: [`docs/brand/brand-style-guide.html`](docs/brand/brand-style-guide.html)
- Stack: Supabase + React + TypeScript + shadcn/ui + Tailwind

## Como rodar

Requer Node 22 ou mais novo.

```bash
npm install
cp .env.example .env   # preencha com a URL e a chave anônima do projeto Supabase
npm run dev
```

Sem o `.env` preenchido, a landing abre com o conteúdo padrão do guia de marca e as áreas
que dependem do backend avisam que ele não está configurado.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checagem de tipos e build de produção |
| `npm test` | Testes de domínio, de tela e de banco |
| `npm run lint` | Lint (oxlint) |
| `npm run usuarios:exemplo` | Cria o admin e o aluno de exemplo (lê o `.env`) |

## Organização do código

```
src/
  dominio/      regras de negócio puras, cada uma com seu teste
  dados/        gateway do Supabase: o único lugar que fala com o SDK
  contextos/    sessão e rota protegida por papel
  componentes/  componentes do produto (landing, turma)
  components/ui componentes do shadcn/ui ajustados ao guia de marca
  paginas/      telas, uma por rota
  conteudo/     textos versionados (política de privacidade, conteúdo padrão)
supabase/
  migrations/   modelo de dados, RLS, funções e views
  functions/    Edge Functions: acesso-aluno, contato, excluir-conta
  tests/        testes de RLS e de funções do banco
```

As telas não importam o SDK do Supabase: chamam `src/dados`, que devolve dados já tipados
e erros com mensagem pronta em pt-BR. As regras (validações, ordenações, cálculos de
horário) ficam em `src/dominio` e não dependem de React nem de rede.

## Banco de dados

As migrations em `supabase/migrations` criam todo o modelo da seção 3 do PRD, com RLS em
todas as tabelas. Para aplicar num projeto Supabase, com a CLI instalada e o projeto
vinculado:

```bash
supabase db push
supabase functions deploy acesso-aluno contato excluir-conta
supabase secrets set VERSAO_TERMO=2026-10-v1 ORIGENS_PERMITIDAS=https://vitorramos.com
```

Para desenvolvimento, `supabase db reset` aplica as migrations e o `supabase/seed.sql` (turma de
exemplo `EXCIA-CPS-2610`), e `npm run usuarios:exemplo` cria o admin e o aluno de exemplo com
os dados do `.env`. As credenciais ficam no `USERS.md`, que é local e não vai para o git.

Em produção, o primeiro admin pode ser criado pelo mesmo script ou no painel do Supabase
(Authentication > Users) e promovido com:

```sql
insert into public.perfil (id, papel, nome, email)
select id, 'admin', 'Vitor Ramos', email from auth.users where email = '<e-mail do professor>';
```

Pontos de atenção antes de ir para produção:

- **E-mail do código de acesso:** o envio padrão do Supabase tem limite baixo por hora.
  Configure um SMTP próprio, ou uma turma inteira entrando ao mesmo tempo fica sem código.
- **Modelo do e-mail:** o template "Magic Link" precisa exibir `{{ .Token }}` (o código de
  6 dígitos) no lugar do link.
- **Sessão de 30 dias:** ajuste em Authentication > Sessions.
- **Retenção:** habilite a extensão `pg_cron` antes de aplicar as migrations para o job
  mensal de retenção ser agendado.

## Testes

| Comando | O que cobre |
| --- | --- |
| `npm test` | Regras de negócio, telas (jsdom), banco e Edge Functions |
| `npm run test:e2e` | Navegador real (Chromium), em desktop e celular |

- **Banco:** as migrations rodam num Postgres em memória (PGlite) com papéis e `auth.uid()`
  simulados; os testes exercitam as políticas de RLS como aluno, admin e visitante. Não
  precisa de Docker.
- **Edge Functions:** o código real das três funções roda no Vitest com `Deno` e o Supabase
  simulados em memória (`supabase/tests/funcoes`). Cobre o fluxo de cada função; não cobre o
  envio real de e-mail nem o runtime do Deno.
- **Ponta a ponta:** o Playwright sobe o build de produção em dois servidores. Um sem backend
  (landing, rotas públicas, redirecionamentos) e outro com a API e o Realtime do Supabase
  simulados na rede (entrada, turma, sala ao vivo, "Meus dados", painel do professor). Todas
  as páginas passam por uma varredura de acessibilidade (axe, WCAG 2.1 AA).

Na primeira vez, instale o navegador de teste: `npx playwright install chromium`.

O que os testes **não** provam: a integração com um projeto Supabase de verdade (Auth, envio
de e-mail, Realtime e Storage em produção). Isso só se confirma com o roteiro manual depois
de configurar o backend.

## Como contribuir

1. Crie uma branch a partir de `main` (`feat/...`, `fix/...`).
2. Abra um Pull Request; é necessária 1 aprovação antes do merge (squash).
3. Copie `.env.example` para `.env` e preencha localmente. Nunca commite o `.env`.

## Status

Pronto: modelo de dados com RLS, funções e views; Edge Functions; seed e usuários de exemplo;
landing animada com galeria de exemplo; privacidade; área do aluno completa (entrada, turma,
atividades, sala ao vivo, "Meus dados"); entrada do admin, painel e mensagens de contato.

Em andamento no admin: gestão da landing, cursos e turmas, IDs autorizados, calendário,
construtor de atividades, painel ao vivo e relatórios.
