# proj-plataforma-vitor-ramos

Plataforma Vitor Ramos (vitorramos.com): landing page pública e plataforma de apoio para os
alunos do professor no SENAI. O professor publica conteúdos, aulas extras, questões,
atividades e avisos pelo painel; o aluno estuda, responde, tira dúvidas e fala com o
professor. Inclui também a sala ao vivo (perguntas, mensagens, quizzes e pesquisas).

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

Entradas: o aluno entra em `/aluno/entrar` com ID do aluno, ID da turma e senha; o
professor entra em `/admin/entrar` com e-mail e senha.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checagem de tipos e build de produção |
| `npm test` | Testes de domínio, de tela e de banco |
| `npm run lint` | Lint (oxlint) |
| `npm run usuarios:exemplo` | Cria o admin, a turma, o aluno e os dados de exemplo (lê o `.env`) |
| `npm run verificar:backend` | Confere o projeto Supabase do `.env` de ponta a ponta (login, RLS, funções) |

## Organização do código

```
src/
  dominio/      regras de negócio puras, cada uma com seu teste
  dados/        gateway do Supabase: o único lugar que fala com o SDK
  contextos/    sessão e rota protegida por papel
  componentes/  componentes do produto (landing, turma, sala, plataforma, admin)
  components/ui componentes do shadcn/ui ajustados ao guia de marca
  paginas/      telas, uma por rota
  conteudo/     textos versionados (política de privacidade, conteúdo padrão)
supabase/
  migrations/   modelo de dados, RLS, funções e views
  functions/    Edge Functions: acesso-aluno, admin-alunos, contato, excluir-conta,
                notificar-resposta, enviar-aviso
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
supabase functions deploy acesso-aluno admin-alunos contato excluir-conta notificar-resposta enviar-aviso
supabase secrets set VERSAO_TERMO=2026-10-v1 ORIGENS_PERMITIDAS=https://vitorramos.com
```

Para desenvolvimento, `supabase db reset` aplica as migrations e o `supabase/seed.sql` (turma de
exemplo `EXCIA-CPS-2610`), e `npm run usuarios:exemplo` cria o admin, a turma `TURMA-001`, o
aluno de demonstração (`ALUNO-001`) e conteúdos, questões, atividades e avisos de exemplo, com
as senhas do `.env`. As credenciais ficam no `USERS.md`, que é local e não vai para o git.

`ORIGENS_PERMITIDAS` é a lista (separada por vírgula) dos endereços que podem chamar as Edge
Functions. Para testar no computador, inclua `http://localhost:5173`; em produção, deixe só o
domínio do site.

Em produção, o primeiro admin pode ser criado pelo mesmo script ou no painel do Supabase
(Authentication > Users) e promovido com:

```sql
insert into public.perfil (id, papel, nome, email)
select id, 'admin', 'Vitor Ramos', email from auth.users where email = '<e-mail do professor>';
```

Pontos de atenção antes de ir para produção:

- **Senha do aluno:** não há e-mail de recuperação. Quem esquece a senha pede ao professor,
  que redefine em Alunos.
- **E-mail (respostas de atividade e avisos):** o envio usa o [Resend](https://resend.com).
  Crie a conta, verifique o domínio do remetente e grave os segredos:

  ```bash
  supabase secrets set RESEND_API_KEY=<chave> "EMAIL_REMETENTE=Vitor Ramos <avisos@seudominio.com>"
  supabase secrets set EMAIL_DO_PROFESSOR=<e-mail que recebe as respostas>   # opcional
  supabase secrets set ENDERECO_DO_SITE=https://seu-site
  ```

  Sem esses segredos a plataforma funciona normalmente, só não envia e-mail: o aviso é
  publicado na plataforma e a tela informa que o e-mail não está configurado.
- **Sessão:** a duração é ajustada em Authentication > Sessions.
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
- **Edge Functions:** o código real das seis funções roda no Vitest com `Deno` e o Supabase
  simulados em memória (`supabase/tests/funcoes`). Cobre o fluxo de cada função; não cobre o
  runtime do Deno.
- **Ponta a ponta:** o Playwright sobe o build de produção em dois servidores. Um sem backend
  (landing, rotas públicas, redirecionamentos) e outro com a API e o Realtime do Supabase
  simulados na rede (entrada por senha, painel do aluno, turma, sala ao vivo, "Meus dados" e
  painel do professor com alunos, dúvidas e demais seções). Todas
  as páginas passam por uma varredura de acessibilidade (axe, WCAG 2.1 AA).
- **Movimento da landing:** a landing é animada com GSAP (ScrollTrigger, SplitText, ScrambleText)
  e Lenis, e anima sempre por inteiro: por decisão do dono, não reduz o movimento a pedido do
  sistema (`prefers-reduced-motion`) e não tem controle de animações (ver "Movimento" no PRD).
  O que muda é só por capacidade do aparelho (ponteiro fino, largura e altura da tela). Os
  testes de tela rodam sem animação (o jsdom não casa nenhuma consulta de mídia);
  `e2e/landing-movimento.spec.ts` cobre no navegador o movimento completo mesmo com o sistema
  em redução, a abertura, a rolagem suave (âncoras, lista do `Select`, voltar ao topo), a seção
  fixada, os painéis empilhados, a limpeza ao trocar de rota e a ausência de rolagem horizontal
  de 360 a 1920 px.

Na primeira vez, instale o navegador de teste: `npx playwright install chromium`.

O que os testes **não** provam: a integração com um projeto Supabase de verdade (Auth,
Realtime e Storage em produção). Para isso existe `npm run verificar:backend`, que roda as
conferências contra o projeto do `.env`. Ele trabalha em duas turmas temporárias, criadas e
apagadas pelo próprio script, para que nada do que publica chegue a alunos de verdade.

## Como contribuir

1. Crie uma branch a partir de `main` (`feat/...`, `fix/...`).
2. Abra um Pull Request; é necessária 1 aprovação antes do merge (squash).
3. Copie `.env.example` para `.env` e preencha localmente. Nunca commite o `.env`.

## Status

Pronto: modelo de dados com RLS, funções e views; Edge Functions; seed e dados de exemplo;
landing animada; privacidade; área do aluno (entrada por senha, painel, conteúdos, atividades,
questões, dúvidas, mensagens, feedback, avisos, notificações, turma, sala ao vivo e "Meus
dados"); painel do professor (números da plataforma, alunos, turmas, conteúdos, atividades,
questões, dúvidas, mensagens, feedbacks, avisos e contatos do site).

Ainda não tem tela no painel (o banco já suporta; hoje se faz pelo Supabase): edição da
landing, calendário de encontros e materiais por encontro, condução da sala ao vivo pelo
professor e relatórios com exportação.
