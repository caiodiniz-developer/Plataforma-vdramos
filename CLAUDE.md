# CLAUDE.md — proj-plataforma-vitor-ramos (Projeto Corporativo)

Diretrizes para qualquer agente (Claude Code ou outro) trabalhando neste repositório.
Este repositório é **privado** e contém código de um projeto/cliente corporativo
(Plataforma Vitor Ramos: landing page pública + sala de aula interativa com painel admin).

## Fonte de verdade do produto

- O escopo, o modelo de dados, as funcionalidades (F1–F21), as telas e os casos extremos estão em
  [`docs/PRD.md`](docs/PRD.md). Ler antes de implementar qualquer coisa.
- Stack: Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) + React + TypeScript +
  shadcn/ui + Tailwind. UI em pt-BR, fuso padrão `America/Sao_Paulo`.
- Tabelas e colunas em snake_case, português sem acento; RLS ligado em todas as tabelas.
- Identidade visual: [`docs/brand/brand-style-guide.html`](docs/brand/brand-style-guide.html)
  (Brand Style Guide Vitor Ramos v1.0; abrir no navegador). Os tokens e as regras de
  contraste/acessibilidade estão resumidos na seção 9 do PRD.
- Mudanças de escopo ou de modelo de dados: atualizar o `docs/PRD.md` no mesmo PR.

## 🔒 Regras de Segurança (obrigatórias)

- **Nunca commitar secrets, chaves de API, tokens, senhas ou credenciais** em qualquer
  arquivo, mesmo em exemplos ou comentários. Usar variáveis de ambiente (`.env`, nunca
  versionado) e um `.env.example` com placeholders.
- `.env`, `*.pem`, `*.key`, arquivos de credenciais de nuvem devem estar no `.gitignore`
  desde o primeiro commit.
- Antes de qualquer commit ou push, revisar o diff em busca de dados sensíveis.
- Não expor dados de clientes/usuários em logs, mensagens de commit ou issues.
- A `service_role` key do Supabase nunca vai para o frontend nem para o repositório.
- Dependências devem ser mantidas atualizadas; vulnerabilidades reportadas por
  auditorias automáticas devem ser tratadas com prioridade.
- Acesso ao repositório restrito à equipe autorizada do projeto.

## Padrões de Arquitetura Corporativa

- Seguir a arquitetura em camadas já estabelecida no projeto — não misturar lógica de
  negócio com código de UI ou acesso a dados diretamente em controllers/handlers.
- Toda integração externa deve passar por uma camada de abstração (adapter/gateway).
- Configurações sensíveis por ambiente via variáveis de ambiente, nunca hardcoded.
- Testes automatizados são obrigatórios para regras de negócio novas.

## Fluxo de Code Review

1. Nenhum código vai direto para `main` — sempre via Pull Request.
2. PR precisa de pelo menos **1 aprovação** antes do merge (branch protection quando
   o plano do GitHub permitir — ver nota abaixo).
3. Descrição do PR deve explicar o *porquê* da mudança, não só o *o quê*.
4. CI (build/testes/lint) deve passar antes do merge, quando configurado.
5. Reviewer deve verificar: ausência de secrets, aderência à arquitetura, cobertura de
   testes e impacto em outros módulos.
6. Merge preferencialmente via squash, mantendo histórico limpo em `main`.

> **Nota sobre branch protection**: em organizações no plano GitHub Free, branch
> protection em repositórios **privados** não é suportada pela API (retorna 403).
> Nesse caso, o code review via PR fica como processo de equipe, não como trava técnica,
> até upgrade para GitHub Team/Enterprise.
