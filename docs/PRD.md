# PRD — Plataforma Vitor Ramos (Landing + Sala de Aula Interativa)

Sep 29, 2026 · @Vitor Ramos

## 1. Visão geral

Site pessoal de Vitor Ramos (vitorramos.com) com duas partes no mesmo app. A parte pública é uma landing page com contato, LinkedIn, experiência profissional e docência. A parte restrita é uma sala de aula interativa: alunos entram com ID de aluno + ID de turma pré-validados pelo professor e acessam calendário, materiais, ementa e uma sala ao vivo com perguntas, mensagens, quizzes e pesquisas de satisfação. Um painel admin (só o professor) cadastra cursos, turmas, encontros, listas de IDs autorizados e atividades, e exporta todos os dados de interação.

Referência de estrutura de turma: o cronograma "Excel Básico com IA Generativa" (SENAI Campinas, 5 encontros de 14/10 a 28/10/2026, 18:45–22:45, 20 vagas), em que cada encontro é dividido em blocos tipados (abertura, teoria, prática, perguntas, intervalo, margem) e ligado a situações de aprendizagem (SA).

**Plataforma de apoio (decisão de 07/10/2026).** A área restrita é uma plataforma de apoio para os alunos do professor no SENAI, não uma escola online: as aulas continuam presenciais. O fluxo é sempre professor → banco de dados → alunos. O professor publica conteúdos e aulas extras, questões, atividades e avisos, e acompanha cada aluno; o aluno estuda, responde, tira dúvidas e fala com o professor em privado. Tudo o que o aluno vê foi cadastrado pelo professor no painel existente (não há um segundo sistema de administração nem dados fixos no frontend). A sala ao vivo, o calendário e os materiais dos encontros continuam valendo.

## 2. Stack e convenções técnicas

- Backend: Supabase (Postgres + Auth + Realtime + Storage + Edge Functions). Assumido: stack sugerida, não especificada no brief.
- Frontend: React + TypeScript, shadcn/ui + Tailwind; tema via tweakcn com os tokens da seção 9.
- Idioma da UI: pt-BR. Datas em DD/MM/AAAA, horas em 24h (18:45). Fuso padrão `America/Sao_Paulo`.
- Rotas: `/` (landing, pública) · `/aluno/*` (autenticado, papel `aluno`) · `/admin/*` (autenticado, papel `admin`) · `/privacidade` (pública).
- Tabelas e colunas em snake\_case, nomes em português sem acento. PK `uuid`. Todo registro com `created_at`; os editáveis com `updated_at`.
- RLS ligado em todas as tabelas. Aluno lê só dados das turmas em que está inscrito e escreve só as próprias respostas. Admin lê e escreve tudo.
- Realtime (Postgres Changes) nas tabelas `sessao_ao_vivo`, `pergunta`, `mensagem`, `atividade` e `atividade_resposta`, filtrado por `sessao_ao_vivo_id`. A sessão entra na publicação porque é por ela que o aluno recebe abertura, encerramento e os avisos de moderação (pergunta ocultada e mensagem removida deixam de ser visíveis a ele, então o UPDATE dessas linhas não chega pelo Realtime).
- Escrita do aluno sempre por função (RPC), nunca direto na tabela: `enviar_pergunta`, `alternar_voto`, `enviar_mensagem` e `responder_atividade`. O aluno lê itens e opções de atividade pela função `atividade_para_aluno`, que não devolve o gabarito antes da resposta. Motivo: a RLS filtra linhas, não colunas.
- Testes: regras de negócio em `src/dominio` (Vitest) e políticas de RLS em `supabase/tests`, rodando as migrations num Postgres em memória (PGlite).
- Entrada do aluno com ID do aluno + ID da turma + senha, conferida na Edge Function `acesso-aluno`, nunca no cliente. A senha fica no Supabase Auth (hash bcrypt); a conta usa um endereço interno `aluno-<id>@alunos.vitorramos.invalid`, que nunca sai do servidor nem aparece na tela. O aluno não informa e-mail.
- Criar aluno com senha, redefinir senha e remover aluno passam pela Edge Function `admin-alunos` (só admin, JWT verificado), porque mexem no Auth com a service role. Bloquear, desbloquear e editar nome ou ID são escritas comuns protegidas por RLS.
- Realtime também em `notificacao`, `duvida` e `mensagem_privada`.
- Assumido: um único admin (o professor). Papel guardado em `perfil.papel`.

## 3. Modelo de dados

Todas as tabelas têm `id uuid PK default gen_random_uuid()` (exceto `perfil`) e `created_at timestamptz not null default now()`; as editáveis têm `updated_at timestamptz not null default now()`. Essas colunas são omitidas abaixo.

### Identidade e LGPD

**perfil** — tabela `perfil`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| id | uuid | PK, references auth.users(id) on delete cascade | Usuário do Supabase Auth |
| papel | text | not null, check (papel in ('admin','aluno')), default 'aluno' | Papel de acesso |
| nome | text | not null | Nome completo |
| email | text | not null, unique | E-mail confirmado por código |

**consentimento** — tabela `consentimento` (append-only; o estado vigente é o registro mais recente por perfil + finalidade)

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| perfil\_id | uuid | not null, FK perfil(id) on delete cascade | Titular |
| finalidade | text | not null, check (finalidade in ('comunicacao\_professor','uso\_dados\_pedagogicos')) | Finalidade do tratamento |
| concedido | boolean | not null | true = consentiu; false = negou ou revogou |
| versao\_termo | text | not null | Versão do texto de privacidade exibido (ex.: '2026-10-v1') |
| origem | text | not null, check (origem in ('cadastro','area\_aluno','admin')) | Onde o registro foi feito |

### Landing page

**perfil\_publico** — tabela `perfil_publico` (linha única)

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| nome\_exibicao | text | not null | Ex.: "Vitor Ramos" |
| titulo | text | not null | Ex.: "Dados · IA · Educação" |
| bio | text | not null | Parágrafo de apresentação |
| foto\_path | text | nullable | Caminho no bucket `publico` |
| email\_contato | text | not null | E-mail exibido e usado no formulário |
| telefone | text | nullable | WhatsApp/telefone opcional |
| linkedin\_url | text | not null | URL do perfil LinkedIn |
| unico | boolean | not null, default true, unique, check (unico) | Garante a linha única |
| outros\_links | jsonb | not null, default '\[\]' | Lista `{rotulo, url}` (GitHub etc.) |
| cidade | text | nullable | Cidade/UF exibida |

**experiencia** — tabela `experiencia`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| tipo | text | not null, check (tipo in ('profissional','docencia')) | Aba em que aparece |
| organizacao | text | not null | Empresa ou instituição de ensino |
| cargo | text | not null | Cargo ou papel docente |
| local | text | nullable | Cidade ou "remoto" |
| data\_inicio | date | not null | Início |
| data\_fim | date | nullable; null = atual | Fim |
| descricao | text | nullable | Resumo em até 600 caracteres |
| tags | text\[\] | not null, default '{}' | Ex.: {'dados','ia'} |
| ordem | int | not null, default 0 | Ordem manual dentro do tipo |
| publicado | boolean | not null, default true | Visível na landing |

**contato\_mensagem** — tabela `contato_mensagem`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| nome | text | not null | Remetente |
| email | text | not null | E-mail de resposta |
| assunto | text | not null, check (assunto in ('consultoria','treinamento','palestra','outro')) | Motivo |
| assunto\_outro | text | nullable; obrigatório quando assunto = 'outro' | Texto livre |
| mensagem | text | not null, 10–2000 caracteres | Corpo |
| lida | boolean | not null, default false | Controle do admin |

### Cursos e turmas

**curso** — tabela `curso`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| nome | text | not null | Ex.: "Excel Básico com IA Generativa" |
| tipo\_formacao | text | nullable | Ex.: "FIC Aperfeiçoamento" |
| carga\_horaria\_h | int | not null, check (> 0) | Ex.: 20 |
| objetivo | text | not null | Objetivo geral |
| ementa\_md | text | not null | Ementa em markdown |
| publico\_alvo | text | nullable | Público |
| pre\_requisitos | text | nullable | Pré-requisitos |
| criterios\_avaliacao\_md | text | nullable | Critérios e nível mínimo |

**capacidade** — tabela `capacidade`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| curso\_id | uuid | not null, FK curso(id) on delete cascade | Curso |
| codigo | text | not null; unique (curso\_id, codigo) | Ex.: 'CT1', 'CS1.2' |
| tipo | text | not null, check (tipo in ('tecnica','socioemocional')) | Natureza |
| descricao | text | not null | Texto da capacidade |

**turma** — tabela `turma`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| curso\_id | uuid | not null, FK curso(id) on delete restrict | Curso ministrado |
| codigo | text | not null, unique, `^[A-Z0-9-]{4,20}$` | ID da turma digitado pelo aluno |
| instituicao | text | not null | Ex.: "SENAI" |
| cidade | text | not null | Ex.: "Campinas" |
| modalidade | text | not null, check (modalidade in ('presencial','online','hibrido')) | Modalidade |
| data\_inicio | date | not null | Primeiro encontro |
| data\_fim | date | not null, check (data\_fim >= data\_inicio) | Último encontro |
| vagas | int | nullable, check (> 0) | Ex.: 20 |
| status | text | not null, check (status in ('planejada','ativa','encerrada')), default 'planejada' | Aluno só entra em turma 'ativa' |
| fuso | text | not null, default 'America/Sao\_Paulo' | Fuso para exibir horários |

**aluno\_autorizado** — tabela `aluno_autorizado` (lista de IDs válidos)

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| turma\_id | uuid | not null, FK turma(id) on delete cascade | Turma |
| matricula | text | not null; unique (turma\_id, matricula); trim + upper | ID do aluno na instituição |
| nome\_referencia | text | nullable | Nome vindo da lista oficial, só para conferência do admin |
| ativo | boolean | not null, default true | false bloqueia novo login |

**inscricao** — tabela `inscricao`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| aluno\_autorizado\_id | uuid | not null, unique, FK aluno\_autorizado(id) on delete cascade | Um ID autorizado gera no máximo uma inscrição |
| turma\_id | uuid | not null, FK turma(id) on delete cascade | Redundante para RLS |
| perfil\_id | uuid | not null, FK perfil(id) on delete cascade; unique (turma\_id, perfil\_id) | Aluno |
| ultimo\_acesso\_em | timestamptz | nullable | Atualizado a cada login |

### Calendário e materiais

**encontro** — tabela `encontro`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| turma\_id | uuid | not null, FK turma(id) on delete cascade | Turma |
| numero | int | not null; unique (turma\_id, numero) | 1, 2, 3… |
| data | date | not null | Dia |
| hora\_inicio | time | not null | Ex.: 18:45 |
| hora\_fim | time | not null, check (hora\_fim > hora\_inicio) | Ex.: 22:45 |
| titulo | text | not null | Ex.: "SA1 · Estruturação de Dados e IA Ética" |
| descricao | text | nullable | Resumo |
| local | text | nullable | Sala/laboratório ou link da chamada |

**bloco\_encontro** — tabela `bloco_encontro`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| encontro\_id | uuid | not null, FK encontro(id) on delete cascade | Encontro |
| ordem | int | not null; unique (encontro\_id, ordem) | Sequência |
| hora\_inicio | time | not null | Início do bloco |
| duracao\_min | int | not null, check (> 0) | Duração |
| tipo | text | not null, check (tipo in ('abertura','teoria','pratica','perguntas','intervalo','margem')) | Tipo do momento |
| titulo | text | not null | Ex.: "Pilares do uso ético da IA" |
| descricao | text | nullable | Atividade |

**material** — tabela `material`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| turma\_id | uuid | not null, FK turma(id) on delete cascade | Turma |
| encontro\_id | uuid | nullable, FK encontro(id) on delete set null | null = material geral do curso |
| titulo | text | not null | Nome |
| tipo | text | not null, check (tipo in ('link','arquivo','video','slides','exercicio','outro')) | Tipo |
| tipo\_outro | text | nullable; obrigatório quando tipo = 'outro' | Texto livre |
| url | text | nullable; obrigatório se arquivo\_path for null | Link externo |
| arquivo\_path | text | nullable | Caminho no bucket privado `materiais` |
| liberado\_em | timestamptz | nullable; null = liberado já | Liberação programada |
| ordem | int | not null, default 0 | Ordem |

### Sala ao vivo e interações

**sessao\_ao\_vivo** — tabela `sessao_ao_vivo`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| encontro\_id | uuid | not null, unique, FK encontro(id) on delete cascade | Uma sessão por encontro |
| status | text | not null, check (status in ('agendada','aberta','encerrada')), default 'agendada' | Só 'aberta' aceita interações |
| aberta\_em | timestamptz | nullable | Quando o admin abriu |
| encerrada\_em | timestamptz | nullable | Quando o admin encerrou |
| permite\_anonimo | boolean | not null, default true | Libera perguntas anônimas |
| chat\_ativo | boolean | not null, default true | Libera mensagens da turma |

**pergunta** — tabela `pergunta`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| sessao\_ao\_vivo\_id | uuid | not null, FK sessao\_ao\_vivo(id) on delete cascade | Sessão |
| bloco\_encontro\_id | uuid | nullable, FK bloco\_encontro(id) on delete set null | Bloco ativo no momento do envio |
| autor\_nome | text | nullable; null quando `anonima` | Nome exibido no mural |
| votos | int | not null, default 0, check (>= 0) | Contador mantido por `alternar_voto` |
| texto | text | not null, 3–500 caracteres | Pergunta |
| destino | text | not null, check (destino in ('turma','professor')) | 'turma' = mural aberto; 'professor' = só o admin vê |
| anonima | boolean | not null, default false | Esconde o nome para a turma e no painel |
| status | text | not null, check (status in ('aberta','respondida','oculta')), default 'aberta' | Moderação |
| resposta | text | nullable | Resposta escrita do professor |
| respondida\_em | timestamptz | nullable |  |

**pergunta\_autoria** — tabela `pergunta_autoria` (autor de cada pergunta, sempre gravado; fora do Realtime)

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| pergunta\_id | uuid | PK, FK pergunta(id) on delete cascade | Pergunta |
| inscricao\_id | uuid | not null, FK inscricao(id) on delete cascade | Autor |

A autoria fica fora de `pergunta` porque o Realtime entrega a linha inteira a quem pode lê-la: com `inscricao_id` na própria tabela, toda pergunta anônima chegaria aos colegas com o autor junto. O autor lê a própria autoria; o professor só lê a de perguntas não anônimas.

**pergunta\_voto** — tabela `pergunta_voto`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| pergunta\_id | uuid | not null, FK pergunta(id) on delete cascade | Pergunta |
| inscricao\_id | uuid | not null, FK inscricao(id) on delete cascade; unique (pergunta\_id, inscricao\_id) | Um voto por aluno |

**mensagem** — tabela `mensagem`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| sessao\_ao\_vivo\_id | uuid | not null, FK sessao\_ao\_vivo(id) on delete cascade | Sessão |
| perfil\_id | uuid | not null, FK perfil(id) on delete cascade | Autor (aluno ou admin) |
| autor\_nome | text | not null; preenchido por trigger | Nome exibido no feed (o aluno não lê `perfil` dos colegas) |
| tipo | text | not null, check (tipo in ('texto','link','aviso')) | 'aviso' só admin |
| texto | text | not null, 1–1000 caracteres | Conteúdo |
| fixada | boolean | not null, default false | Fixada no topo (só admin) |
| removida | boolean | not null, default false | Removida por moderação |

**atividade** — tabela `atividade` (quiz, pesquisa de satisfação e enquete num só modelo)

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| turma\_id | uuid | not null, FK turma(id) on delete cascade | Turma |
| sessao\_ao\_vivo\_id | uuid | nullable, FK sessao\_ao\_vivo(id) on delete set null | null = atividade assíncrona na área do aluno |
| tipo | text | not null, check (tipo in ('quiz','pesquisa\_satisfacao','enquete')) | Tipo |
| titulo | text | not null | Título |
| alvo | text | nullable, check (alvo in ('teoria','pratica','encontro','curso')); obrigatório quando tipo = 'pesquisa\_satisfacao' | O que está sendo avaliado |
| bloco\_encontro\_id | uuid | nullable, FK bloco\_encontro(id) on delete set null | Bloco específico avaliado (teoria ou prática) |
| status | text | not null, check (status in ('rascunho','publicada','encerrada')), default 'rascunho' | Aluno só responde 'publicada' |
| anonima | boolean | not null, default false | Resultados sem nome |
| mostrar\_resultado | text | not null, check (mostrar\_resultado in ('nunca','apos\_responder','apos\_encerrar')), default 'apos\_encerrar' | Quando o aluno vê o resultado agregado |
| tempo\_limite\_s | int | nullable, check (> 0) | Contagem regressiva (quiz ao vivo) |
| publicada\_em | timestamptz | nullable |  |
| encerrada\_em | timestamptz | nullable |  |

**atividade\_item** — tabela `atividade_item`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| atividade\_id | uuid | not null, FK atividade(id) on delete cascade | Atividade |
| ordem | int | not null; unique (atividade\_id, ordem) | Sequência |
| enunciado | text | not null | Pergunta |
| tipo\_resposta | text | not null, check (tipo\_resposta in ('escolha\_unica','escolha\_multipla','escala\_1\_5','nps\_0\_10','texto\_livre')) | Formato |
| obrigatorio | boolean | not null, default true |  |
| explicacao | text | nullable | Mostrada após responder (quiz) |

**atividade\_opcao** — tabela `atividade_opcao`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| atividade\_item\_id | uuid | not null, FK atividade\_item(id) on delete cascade | Item |
| ordem | int | not null | Sequência |
| texto | text | not null | Opção |
| correta | boolean | not null, default false | Usado só em quiz |

**atividade\_resposta** — tabela `atividade_resposta`

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| atividade\_item\_id | uuid | not null, FK atividade\_item(id) on delete cascade | Item |
| inscricao\_id | uuid | not null, FK inscricao(id) on delete cascade; unique (atividade\_item\_id, inscricao\_id) | Uma resposta por aluno por item |
| opcao\_ids | uuid\[\] | nullable; 1 elemento em 'escolha\_unica', ≥1 em 'escolha\_multipla' | Opções marcadas |
| valor | int | nullable; 1–5 em 'escala\_1\_5', 0–10 em 'nps\_0\_10' | Nota |
| texto | text | nullable; até 1000 caracteres; usado em 'texto\_livre' | Resposta aberta |
| correta | boolean | nullable | Calculado no insert para quiz |
| tempo\_resposta\_ms | int | nullable | Tempo desde a publicação (quiz ao vivo) |

### Plataforma de apoio

Migration `20261008090000_plataforma_de_apoio.sql`. RLS em todas: o admin lê e escreve tudo; o aluno lê só o que foi publicado para a turma dele (ou para todas) e só as próprias dúvidas, mensagens, feedbacks e notificações. Aluno com `aluno_autorizado.ativo = false` (bloqueado) não lê nada.

| Tabela | Campos principais | Para que serve |
| --- | --- | --- |
| `conteudo` | `turma_id` (nulo = todas as turmas), `tipo` (aula, aula\_extra, texto, video, link, arquivo), `titulo`, `descricao`, `corpo_md`, `capa_path`, `arquivo_path`, `video_url`, `link_url`, `publicado`, `publicado_em` | Conteúdos e aulas extras. Data futura em `publicado_em` agenda a publicação |
| `conteudo_acesso` | `conteudo_id`, `inscricao_id`, `primeiro_em`, `ultimo_em` | Quem abriu o quê (função `registrar_acesso`) |
| `duvida` | `inscricao_id`, `turma_id`, `conteudo_id`, `titulo`, `pergunta`, `categoria`, `anexo_path`, `status` (aberta, respondida, arquivada), `resposta`, `respondida_em` | Dúvida do aluno para o professor |
| `mensagem_privada` | `inscricao_id`, `autor` (aluno, professor), `texto`, `lida_em` | Conversa privada aluno ↔ professor |
| `feedback` | `inscricao_id`, `turma_id`, `tipo` (dificuldade, sugestao, problema, avaliacao\_aula, comentario), `texto`, `lido` | Feedback do aluno |
| `aviso` | `turma_id` (nulo = todos), `titulo`, `texto` | Comunicado do professor |
| `notificacao` | `perfil_id`, `tipo`, `titulo`, `link`, `lida_em` | Criada por gatilho: conteúdo publicado, atividade publicada, aviso, dúvida respondida, mensagem do professor |

`atividade` ganhou os tipos `questao` (questão avulsa, corrigida na hora) e `licao` (atividade fora da sala ao vivo) e as colunas `descricao`, `instrucoes_md`, `prazo_em`, `arquivo_path`, `conteudo_id`, `dificuldade` (facil, medio, dificil) e `categoria`. `responder_atividade` corrige qualquer item com gabarito e recusa resposta depois do prazo.

Funções do aluno: `minhas_atividades(turma)`, `meu_progresso(turma)`, `registrar_acesso(conteudo)`, `marcar_mensagens_lidas()`. Views do professor (`security_invoker`): `vw_aluno` (uma linha por ID cadastrado, com situação sem\_conta | ativo | bloqueado, último acesso e contadores de progresso) e `vw_atividade_recente` (acessos, respostas, dúvidas, feedbacks e mensagens dos alunos, em ordem de data). Arquivos no bucket privado `materiais`: conteúdos e atividades seguem a RLS da tabela; o anexo da dúvida fica em `duvidas/<id do usuário>/`.

### Infraestrutura (sem acesso pelo cliente)

**limite\_tentativa** — tabela `limite_tentativa` (contagem por IP para os limites das Edge Functions; só a service role acessa)

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| acao | text | not null, check (acao in ('acesso\_aluno','contato')) | Limite aplicado |
| ip\_hash | text | not null | Hash do IP (o IP não é guardado) |

**cadastro\_pendente** — tabela `cadastro_pendente` (dados do cadastro entre o envio do código e a confirmação)

| Campo | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| aluno\_autorizado\_id | uuid | PK, FK aluno\_autorizado(id) on delete cascade | ID em cadastro |
| nome | text | not null | Nome informado |
| email | text | not null | E-mail a confirmar |
| quer\_comunicacao | boolean | not null, default false | Valor do switch de comunicação |
| versao\_termo | text | not null | Versão aceita |
| expira\_em | timestamptz | not null, default now() + 15 min | Validade |

A versão vigente do termo fica em `src/dominio/consentimento.ts` (`VERSAO_TERMO_VIGENTE`) e na variável `VERSAO_TERMO` das Edge Functions; o texto exibido em `/privacidade` é versionado no repositório.

Enums (todos como `text + check`):

- `perfil.papel`: admin | aluno
- `consentimento.finalidade`: comunicacao\_professor | uso\_dados\_pedagogicos
- `consentimento.origem`: cadastro | area\_aluno | admin
- `experiencia.tipo`: profissional | docencia
- `contato_mensagem.assunto`: consultoria | treinamento | palestra | outro
- `capacidade.tipo`: tecnica | socioemocional
- `turma.modalidade`: presencial | online | hibrido
- `turma.status`: planejada | ativa | encerrada
- `bloco_encontro.tipo`: abertura | teoria | pratica | perguntas | intervalo | margem
- `material.tipo`: link | arquivo | video | slides | exercicio | outro
- `sessao_ao_vivo.status`: agendada | aberta | encerrada
- `pergunta.destino`: turma | professor
- `pergunta.status`: aberta | respondida | oculta
- `mensagem.tipo`: texto | link | aviso
- `atividade.tipo`: quiz | pesquisa\_satisfacao | enquete
- `atividade.alvo`: teoria | pratica | encontro | curso
- `atividade.status`: rascunho | publicada | encerrada
- `atividade.mostrar_resultado`: nunca | apos\_responder | apos\_encerrar
- `atividade_item.tipo_resposta`: escolha\_unica | escolha\_multipla | escala\_1\_5 | nps\_0\_10 | texto\_livre

Relações:

- curso 1—N capacidade, curso 1—N turma.
- turma 1—N aluno\_autorizado 1—1 inscricao N—1 perfil (um perfil pode estar em várias turmas).
- turma 1—N encontro 1—N bloco\_encontro; encontro 1—1 sessao\_ao\_vivo.
- turma 1—N material (opcionalmente ligado a um encontro).
- sessao\_ao\_vivo 1—N pergunta, mensagem, atividade; pergunta 1—1 pergunta\_autoria N—1 inscricao; pergunta 1—N pergunta\_voto.
- atividade 1—N atividade\_item 1—N atividade\_opcao; atividade\_item 1—N atividade\_resposta N—1 inscricao.
- perfil 1—N consentimento.

Views para relatórios (somente admin): `vw_resultado_atividade` (agregado por item e opção, média de escala e NPS), `vw_satisfacao_por_bloco` (média de `escala_1_5` por `bloco_encontro.tipo` e por encontro), `vw_participacao_aluno` (perguntas, mensagens, respostas e acertos por inscrição; perguntas anônimas não entram na contagem), `vw_exportacao_respostas` (linhas do CSV, com hash da inscrição no lugar do nome em atividade anônima), `vw_emails_comunicacao` (e-mails com `comunicacao_professor` vigente = true) e `vw_turma_resumo` (contadores da lista de turmas).

## 4. Funcionalidades

### Público

### F1 — Landing page

- Entrada (UI): visitante abre `/`.
- Comportamento: lê `perfil_publico` e `experiencia` com `publicado = true`; ordena por `ordem` e depois `data_inicio desc`.
- Saída, nesta ordem: hero (título do perfil, nome em escala de página, faixa das quatro cores, bio, botões LinkedIn e Contato, lista dos cinco temas e foto), faixa de temas em letra grande, seção Frentes de trabalho (Palestra, Treinamento e Consultoria em três painéis de tela cheia, cada um na sua cor, com os textos dos cartões do guia; cada painel abre o contato com o assunto já escolhido), seção Experiência com abas Profissional | Docência (só quando há experiência publicada), seção Sala de aula interativa em fundo Tinta (recursos da área do aluno, link "Entrar na área do aluno", prévia ilustrativa de um encontro e o bloco "Como é uma aula" em cinco passos: calendário, aula ao vivo, perguntas, quiz e materiais, conforme o fluxo "Aula ao vivo" da seção 6), galeria de fotos, chamada final de tela cheia em azul, seção Contato (canais cadastrados e formulário), rodapé em Tinta com a assinatura, link `/privacidade` e "Área do aluno" → `/aluno/entrar`.
- Endereço com âncora (`/#contato`, `/#frentes`…): como as seções só existem depois da carga dos dados, a página rola até a seção assim que o conteúdo é montado.
- Fotos: configuradas em `src/conteudo/galeria.ts` (arquivos em `public/fotos/`). Enquanto forem ilustrações provisórias, aparecem com a etiqueta "Foto de exemplo". A foto enviada pelo admin (`perfil_publico.foto_path`) tem prioridade sobre o retrato do arquivo.

### F2 — Formulário de contato

- Entrada (UI): nome, e-mail, assunto (`Select`), assunto\_outro (se 'outro'), mensagem, checkbox obrigatório "Li a política de privacidade".
- Comportamento: valida; insere em `contato_mensagem` (insert público via RLS, sem select); limite de 3 envios por IP por hora na Edge Function `contato`.
- Saída: `Toast` "Mensagem enviada"; registro visível no admin.

### Aluno

### F3 — Primeiro acesso (criar conta)

- Entrada (UI): aba "Criar conta" em `/aluno/entrar`: nome completo, e-mail (opcional), ID do aluno, ID da turma, senha, confirmação da senha e aceite do termo de uso (obrigatório).
- Consentimento de comunicações: depois do termo e antes de abrir o portal, a plataforma pergunta uma única vez "Quer receber comunicações do professor?", com o campo de e-mail (opcional; obrigatório só para quem responde que quer). "Quero receber" grava o e-mail de contato e o consentimento `comunicacao_professor = true`; "Agora não" grava `false`. Vale também para aluno criado pelo professor e para quem já tinha conta. A escolha muda em Meus dados.
- Comportamento: a Edge Function `acesso-aluno` (ação `cadastrar`) normaliza os IDs (trim, upper), exige que o ID esteja na lista do professor (`aluno_autorizado`) e ainda não tenha conta, valida a senha (8 a 72 caracteres, com letras e números), cria o usuário no Supabase Auth, o `perfil`, a `inscricao` e o consentimento `uso_dados_pedagogicos`. O professor também pode criar o aluno já com senha pelo painel (F22); nesse caso o aluno aceita o termo no primeiro acesso.
- Saída: sessão autenticada; redireciona para `/aluno`.

### F4 — Login recorrente

- Entrada (UI): ID do aluno + ID da turma + senha.
- Comportamento: `acesso-aluno` (ação `entrar`) encontra a conta pelo par de IDs e confere a senha no Auth. Qualquer falha de ID, turma ou senha devolve a mesma mensagem: "ID, turma ou senha incorretos.". Com a senha certa e o aluno bloqueado: "Sua conta está temporariamente bloqueada. Entre em contato com seu professor.". Atualiza `inscricao.ultimo_acesso_em`.
- Saída: `/aluno`. Aluno com mais de uma inscrição troca de turma no menu.

### F5 — Informações do curso

- Entrada (UI): aba "Curso".
- Comportamento: lê `curso` e `capacidade` da turma.
- Saída: objetivo, carga horária, ementa renderizada de markdown, capacidades agrupadas em técnicas e socioemocionais (código + descrição), critérios de avaliação; cabeçalho com instituição, cidade, modalidade, período e vagas.

### F6 — Calendário de aulas

- Entrada (UI): aba "Calendário".
- Comportamento: lê `encontro` e `bloco_encontro` da turma; horários exibidos no `turma.fuso`.
- Saída: lista de encontros (data, dia da semana, horário, título, local) com o próximo encontro destacado; ao expandir, a régua do encontro (barra horizontal proporcional à duração de cada bloco, cor por `tipo`) e a tabela de blocos (horário, minutos, tipo, título, descrição). Botão "Adicionar ao calendário" baixa `.ics` com todos os encontros.

### F7 — Materiais

- Entrada (UI): aba "Materiais".
- Comportamento: lista `material` com `liberado_em` nulo ou ≤ agora; agrupa por encontro (geral primeiro). Arquivo → URL assinada do Storage válida por 10 min.
- Saída: cards com ícone por tipo, título, encontro e botão Abrir (nova aba).

### F8 — Privacidade e preferências do aluno

- Entrada (UI): página "Meus dados".
- Comportamento: mostra nome, e-mail, turmas e o estado vigente de cada consentimento. O switch de comunicação grava novo `consentimento` (`origem = 'area_aluno'`). Botão "Baixar meus dados" gera JSON com perfil, inscrições, perguntas, mensagens e respostas. Botão "Solicitar exclusão" abre `AlertDialog`; ao confirmar, apaga `perfil` (cascade) e a conta Auth via Edge Function.
- Saída: `Toast` de confirmação; histórico de consentimento preservado até a exclusão.

### Sala ao vivo

### F9 — Entrar na sala ao vivo

- Entrada (UI): botão "Entrar na aula ao vivo" (aparece quando `sessao_ao_vivo.status = 'aberta'` para um encontro da turma).
- Comportamento: assina canais Realtime da sessão.
- Saída: tela com abas Perguntas | Mensagens | Atividades e banner da atividade publicada no momento.

### F10 — Enviar pergunta

- Entrada (UI): `Textarea` (3–500), `RadioGroup` destino ("Para a turma" | "Só para o professor"), `Checkbox` "Enviar anônima" (só se `permite_anonimo`).
- Comportamento: insere `pergunta`; preenche `bloco_encontro_id` com o bloco cujo intervalo contém o horário atual.
- Saída: 'turma' aparece no mural de todos em tempo real; 'professor' aparece só para o autor ("Enviada ao professor") e no painel admin. Anônima mostra "Anônimo" para turma e admin.

### F11 — Votar em pergunta

- Entrada (UI): botão "+1" em pergunta de destino 'turma'.
- Comportamento: insere ou remove `pergunta_voto` (toggle).
- Saída: contador atualizado; mural ordenado por votos desc, depois `created_at`.

### F12 — Mensagens da turma

- Entrada (UI): `Input` + Enviar (só se `chat_ativo`).
- Comportamento: insere `mensagem` com `tipo = 'link'` quando o texto é só uma URL; limite de 1 mensagem a cada 5 s por aluno.
- Saída: feed em tempo real; mensagens `fixada` no topo; `aviso` do professor com destaque; `removida` some para todos.

### F13 — Responder atividade (quiz, enquete, pesquisa)

- Entrada (UI): itens da atividade publicada, no formato de `tipo_resposta`.
- Comportamento: valida obrigatórios; insere uma `atividade_resposta` por item em uma transação (RPC `responder_atividade`); em quiz calcula `correta` no servidor e grava `tempo_resposta_ms`. Rejeita se `status <> 'publicada'` ou se o `tempo_limite_s` passou.
- Saída: confirmação; em quiz mostra acerto e `explicacao` por item; resultado agregado conforme `mostrar_resultado`.

### Admin

### F14 — Login do admin

- Entrada (UI): e-mail + senha em `/admin/entrar`.
- Comportamento: Supabase Auth; exige `perfil.papel = 'admin'`.
- Saída: `/admin`.

### F15 — Gerir landing

- Entrada (UI): formulário de `perfil_publico`; CRUD de `experiencia` com ordenação.
- Comportamento: upsert; upload de foto para bucket `publico`.
- Saída: landing atualizada; caixa de `contato_mensagem` com filtro lida/não lida.

### F16 — Gerir cursos e turmas

- Entrada (UI): CRUD de `curso` (com `capacidade`) e `turma`.
- Comportamento: `turma.codigo` sugerido automaticamente (ex.: `EXCIA-CPS-2610`) e editável; botão "Duplicar turma" copia encontros, blocos, materiais e atividades em rascunho para nova turma do mesmo curso.
- Saída: lista de turmas por status com contadores (autorizados, inscritos, encontros).

### F17 — Lista de IDs autorizados

- Entrada (UI): colar lista (um ID por linha, opcional `;nome`) ou importar CSV `matricula,nome`.
- Comportamento: normaliza, remove duplicados, mostra prévia com contagem de novos, já existentes e inválidos antes de confirmar; confirma com insert em lote. Toggle `ativo` por ID.
- Saída: tabela de IDs com status Pendente (sem inscrição) | Inscrito (nome, e-mail, consentimento de comunicação, último acesso) | Inativo.

### F18 — Calendário e materiais da turma

- Entrada (UI): CRUD de `encontro` e, dentro dele, de `bloco_encontro` (arrastar para reordenar); CRUD de `material`.
- Comportamento: ao salvar blocos, recalcula `hora_inicio` de cada bloco pela soma das durações a partir de `encontro.hora_inicio`; avisa se a soma não fecha com `hora_fim`. Cria `sessao_ao_vivo` 'agendada' junto com cada encontro.
- Saída: prévia da régua igual à visão do aluno.

### F19 — Construtor de atividades

- Entrada (UI): tipo, título, alvo + bloco (pesquisa), anonimato, `mostrar_resultado`, tempo limite, itens e opções.
- Comportamento: salva em 'rascunho'; exige ao menos 1 item, 2 opções em itens de escolha e ao menos 1 opção correta por item de quiz. Modelos prontos: "Satisfação — teoria" e "Satisfação — prática" (3 itens `escala_1_5`: clareza, ritmo, utilidade + 1 `texto_livre`).
- Saída: atividade pronta para publicar ao vivo ou na área do aluno.

### F20 — Painel da aula ao vivo (professor)

- Entrada (UI): botões Abrir sessão | Encerrar sessão; publicar/encerrar atividade; responder, marcar respondida ou ocultar pergunta; fixar ou remover mensagem; enviar aviso.
- Comportamento: atualiza status e timestamps; tudo propaga por Realtime.
- Saída: fila de perguntas (filtros: destino, status; ordenação por votos), contador de presentes (Realtime Presence), gráfico ao vivo de respostas da atividade aberta, modo "projetar" em tela cheia com a pergunta ou resultado selecionado.

### F21 — Relatórios e exportação

- Entrada (UI): turma + filtro por encontro ou atividade.
- Comportamento: lê as views da seção 3.
- Saída: média de satisfação por encontro separada em teoria e prática, acerto por quiz e por item, participação por aluno; exporta CSV de perguntas, mensagens, respostas e da lista de e-mails com `comunicacao_professor` vigente = true. Em atividades anônimas o CSV traz um hash da inscrição no lugar do nome.

### Plataforma de apoio — professor

### F22 — Gerenciar alunos

- Entrada (UI): `/admin/alunos`: tabela com Nome, ID, Turma, Status, Progresso, Último acesso e Ações; busca por nome ou ID; filtros por turma e status.
- Comportamento: criar (nome, ID, turma e senha inicial opcional), editar nome e ID, redefinir senha, enviar mensagem, bloquear, desbloquear e remover. Bloquear, desbloquear e remover pedem confirmação. Bloquear corta o acesso na hora; remover apaga a conta e tudo o que o aluno enviou.
- Saída: perfil do aluno em `/admin/alunos/:id` com dados, progresso, respostas, dúvidas, feedbacks, conteúdos acessados e a conversa privada.

### F23 — Turmas

- `/admin/turmas`: criar e editar turma (ID, curso ou disciplina, instituição, cidade, datas, modalidade, vagas, status). O curso é reaproveitado pelo nome ou criado na hora. Conteúdos, atividades e avisos são publicados por turma.

### F24 — Conteúdos e aulas extras

- `/admin/conteudos`: criar, editar, publicar, despublicar, agendar e excluir. Campos: tipo, turma (uma ou todas), título, descrição, texto em Markdown, link de vídeo, link externo, capa e arquivo. Publicar gera notificação para os alunos da turma.

### F25 — Questões

- `/admin/questoes`: enunciado, alternativas, alternativa correta, explicação, dificuldade, categoria e conteúdo relacionado. Só publica com ao menos duas alternativas e gabarito marcado. O aluno vê a correção e a explicação logo depois de responder.

### F26 — Atividades e lições

- `/admin/atividades`: lição (perguntas abertas ou de escolha, sem correção automática) ou quiz (com gabarito), com descrição, instruções, prazo opcional, arquivo e turma. Rascunho → publicada → encerrada. O professor vê as respostas por aluno. Com respostas enviadas, os itens ficam travados.

### F27 — Dúvidas, mensagens, feedbacks e avisos

- `/admin/duvidas`: responder, editar a resposta, arquivar e reabrir; responder marca como respondida e notifica o aluno.
- `/admin/conversas`: conversas privadas por aluno, com contador de não lidas.
- `/admin/feedbacks`: lista com filtro lido/não lido.
- `/admin/avisos`: publicar para todos os alunos ou para uma turma; excluir.

### F28 — Painel do professor

- `/admin`: total de alunos, ativos, bloqueados e novos cadastros (7 dias); aulas, atividades, questões e materiais; perguntas pendentes, feedbacks não lidos, atividades enviadas e mensagens não lidas; atividade recente dos alunos; contatos do site não lidos. Todos os números vêm do banco.

### Plataforma de apoio — aluno

### F29 — Área do aluno

- `/aluno`: progresso (atividades realizadas, questões respondidas, conteúdos acessados, desempenho), conteúdos recentes, atividades, dúvidas e avisos.
- `/aluno/conteudos` e `/aluno/conteudos/:id`: lista com busca e filtro; a página do conteúdo registra o acesso.
- `/aluno/atividades` e `/aluno/questoes`: situação de cada uma, filtro e resposta na própria página.
- `/aluno/duvidas`, `/aluno/mensagens`, `/aluno/feedback`, `/aluno/avisos`: canal com o professor. Notificações no sino do cabeçalho, em tempo real.

### Ajustes do guia do professor (08/10/2026)

Migration `20261009090000_ajustes_do_professor.sql`; funções `notificar-resposta` e `enviar-aviso`.

### F30 — Aluno em mais de uma turma

- O perfil do aluno no painel lista todas as turmas de que ele participa.
- Professor: no cadastro ("Novo aluno"), além da turma principal dá para marcar outras turmas em "Também nestas turmas". Para quem já existe, a ação "Adicionar a outra turma" coloca o aluno em mais uma turma (função `matricular_em_turma`). Com conta, é a mesma conta nas duas: mesmo ID, mesma senha.
- Aluno: em `/aluno/minhas-turmas` ele vê as turmas de que participa, troca a turma em uso, entra em outra com o ID da turma (`entrar_na_turma`; só turma ativa, e leva a própria matrícula) e sai de uma (`sair_da_turma`; nunca da última, e o que enviou naquela turma é apagado).
- Casos: ID já usado por outra pessoa na turma de destino é recusado; aluno bloqueado não entra em turma nova.

### F31 — Questões ocultas por padrão e liberação

- Toda questão nasce oculta (status `rascunho`): o botão principal do editor é "Salvar oculta"; "Salvar e liberar" é a opção ao lado.
- Cada questão tem uma chave "Visível para os alunos". O botão geral "Liberar todas" / "Ocultar todas" alterna a visibilidade de todas as questões que estão na lista (com os filtros aplicados), com confirmação.
- Função `definir_visibilidade(ids, visivel)`: as que não podem ser liberadas (sem gabarito, por exemplo) ficam ocultas e voltam com o motivo. A turma é notificada só na primeira liberação.

### F32 — Filtros por instituição e por turma

- Em Conteúdos, Atividades e Questões do painel: seletores de instituição e de turma (a instituição reduz a lista de turmas). Item publicado para todas as turmas aparece em qualquer filtro. Regra em `src/dominio/turmas.ts`.

### F33 — Entrega de arquivos e e-mail ao professor

- O professor marca na atividade "O aluno pode enviar arquivos na resposta". O aluno anexa até 5 arquivos (zip ou avulsos), 25 MB cada, que sobem junto com as respostas.
- Armazenamento: bucket privado `materiais`, em `entregas/<id do usuário>/`; registro em `atividade_entrega` pela função `registrar_entrega` (confere turma, atividade aberta, prazo, pasta e limite). Só o aluno e o professor leem.
- O professor vê e abre os arquivos em Atividades > Ver respostas.
- E-mail: ao responder, a função `notificar-resposta` envia ao e-mail do professor as respostas e os arquivos. Assunto: "Turma - Aluno - Atividade". Corpo: detalhes da atividade, respostas e arquivos (em anexo até 8 MB no total; acima disso, link válido por 7 dias). Um e-mail por atividade e aluno.

### F34 — Links em dúvidas, mensagens e avisos

- Endereços `https://…` e trechos `[texto](https://…)` viram links clicáveis (nova aba), quantos houver. O botão "Inserir link" monta o trecho. Só http e https; o restante é mostrado como texto. Regra em `src/dominio/links.ts`, repetida no e-mail.

### F35 — Aviso para várias turmas e por e-mail

- Novo aviso: "Todos os alunos" ou "Escolher turmas", com filtro por instituição e seleção de várias turmas. Um aviso para N turmas vira N linhas com o mesmo `lote_id`; o professor vê e exclui como um aviso só.
- "Enviar também por e-mail": a função `enviar-aviso` manda o aviso só para alunos das turmas escolhidas com consentimento `comunicacao_professor` vigente e e-mail de contato informado (`vw_emails_comunicacao`). Um e-mail por aluno, sem expor os demais.

### F36 — Navegação do aluno

- "Voltar ao painel" em Aulas presenciais (`/aluno/turmas/:codigo`) e em Meus dados. Meus dados também edita o e-mail de contato; ligar as comunicações exige um e-mail informado.

### E-mail (provedor)

- Gateway único em `supabase/functions/_shared/email.ts` (Resend). Segredos: `RESEND_API_KEY`, `EMAIL_REMETENTE` e, opcional, `EMAIL_DO_PROFESSOR` (destino das respostas; sem ele, vale o e-mail das contas de professor). Sem os segredos, nada é enviado, as telas avisam e o resto funciona.

## 5. Telas e componentes

### Landing `/`

- Layout: coluna de até 1680 px com calha lateral fluida (16 px no celular, até 64 px), grade de 12 colunas no desktop. As seções alternam Papel, Tinta e azul. Header fixo (wordmark "Vitor Ramos" em Ubuntu Mono + links âncora Frentes · Experiência · Docência · Sala de aula · Contato, com sublinhado na seção em leitura + botão "Área do aluno"; abaixo de 1024 px os links vão para o menu em `Sheet`), barra de progresso de leitura e botão de voltar ao topo.
- Tipografia da landing: o nome no hero e a assinatura no rodapé ocupam a largura útil da página. Como a Ubuntu Mono avança 0,5 em por caractere, o tamanho é `largura útil / (caracteres × 0,5)`, calculado por `escalaDoNome()` a partir do nome cadastrado (uma linha a partir de 768 px; uma palavra por linha no celular), com teto pela altura da tela. Títulos de seção em `clamp(40px, 7vw, 124px)`, título da chamada final em `clamp(40px, 8.4vw, 152px)`, sempre com altura de linha 1. O número da seção vai em azul por ser texto grande (≥ 24 px bold).
- Seções: hero com grade técnica de fundo (linhas), eyebrow, régua de 2 px, nome, faixa das quatro cores, bio, botões, lista de temas com marcador de cor e retrato. Frentes: três painéis de tela cheia (azul com texto branco; laranja e verde com texto Tinta), cada um com numeração, rótulo, título em letra grande, texto, "Conversar sobre …" e o número do painel em escala de página; o painel inteiro é o link. Experiência: tabela editorial (período, cargo e organização, descrição e temas) separada por réguas de 2 px. Sala de aula: texto e recursos à esquerda, prévia do encontro à direita (relógio, régua do encontro com agulha, pergunta com votos, quiz e materiais). Galeria: grade assimétrica de 12 colunas, cada foto com legenda, numeração e régua. Chamada final: tela cheia em azul. Contato: frase de orientação e canais em linhas (e-mail, LinkedIn, telefone, outros links) + formulário em moldura de 2 px. Rodapé em Tinta.
- Respiro: a landing usa uma escala fluida de espaços definida em `src/index.css` — `--espaco-secao` (entre seções, `clamp(6rem, 4rem + 9vw, 15rem)`), `--espaco-bloco` (entre título e conteúdo), `--espaco-item` (entre itens de uma lista) e `--espaco-miolo` (dentro de um item). Novos blocos da landing usam essas variáveis em vez de valores soltos.
- Movimento (GSAP com ScrollTrigger, SplitText e ScrambleText, montado por `useMovimento` em `src/lib/movimento.ts`; rolagem suave com Lenis em `src/lib/rolagem.ts`):
  - **A landing anima sempre por inteiro, inclusive quando o sistema pede movimento reduzido.** Decisão do dono do produto: `prefers-reduced-motion: reduce` também liga sozinho quando a pessoa desativa as animações do Windows por desempenho, e ele quer que a página abra com todo o movimento, sem depender de clique. Não há controle de animações na página nem versão reduzida. Isso é uma exceção consciente à recomendação de acessibilidade de permitir desligar animações disparadas por interação (WCAG 2.3.3, nível AAA); o alvo do projeto continua sendo WCAG 2.1 AA, que essa decisão não viola. Se o requisito mudar, o ponto de entrada é `useMovimento`.
  - Histórico: uma versão anterior tinha três níveis (completo, essencial, nenhum) e um controle no rodapé que guardava a escolha em `localStorage` (`vr:movimento`). Isso saiu; a chave antiga é apagada na inicialização (`src/lib/escolhaAntigaDeMovimento.ts`).
  - O que varia é a capacidade do aparelho, não a preferência: rolagem suave, cursor decorativo, botões magnéticos e reações ao ponteiro só com ponteiro fino; seção da sala fixada só em telas com pelo menos 1024 × 720 px; painéis das frentes empilhados só em telas largas; parallax entre colunas só no desktop. No celular a página é a versão mais leve dessas peças.
  - Abertura: cortina em Tinta com contador de 000 a 100, o nome se montando e a faixa das quatro cores; cerca de 1,6 s, só na primeira carga da sessão, pulável por clique, toque ou tecla, com temporizador de segurança. É decorativa (`aria-hidden`) e o conteúdo já está montado por baixo.
  - Hero: as letras do nome sobem de dentro da linha, régua e faixa de cores se desenham, o retrato abre por recorte e assenta com zoom; ao rolar, grade, nome e retrato saem em velocidades diferentes; com ponteiro fino, a grade desliza, o retrato inclina e a cor da faixa sob o ponteiro cresce.
  - Faixa de temas: rola sozinha, acelera e inverte com a velocidade da rolagem e inclina de leve; para fora da tela.
  - Cabeçalhos de seção: o número se embaralha e assenta, as palavras do título sobem de dentro da linha e a régua se desenha.
  - Frentes de trabalho: painéis de tela cheia que empilham (`position: sticky`), cada um tomando a tela com a sua cor enquanto o anterior recua; o número gigante sobe mais devagar que o painel. O foco por teclado leva a página até o painel focado.
  - Sala de aula: a seção entra por recorte preso à rolagem (Papel → Tinta). Fixada, a rolagem conduz a aula — a régua do encontro se preenche bloco a bloco, o relógio vai de 18:45 a 22:45 com o bloco em andamento, e a pergunta, o quiz e os materiais entram no momento em que cada recurso é usado; rolar para cima retrocede. Sem fixar (celular e janelas baixas), a mesma sequência toca sozinha uma vez (3,5 s) quando a prévia entra na tela. Os passos de "Como é uma aula" entram um a um.
  - Galeria: molduras abrem por recorte enquanto a imagem assenta com zoom, parallax entre colunas, inclinação leve pela velocidade da rolagem, hover com zoom e legenda que desliza. Chamada final: o painel azul abre por recorte preso à rolagem e o título sobe palavra a palavra. Contato: réguas desenhadas e moldura do formulário abrindo. Rodapé: letras da assinatura subindo.
  - Cursor decorativo: quadrado que segue o ponteiro com atraso e abre uma etiqueta ("Conversar", "Ver", "Abrir", "Rolar") sobre elementos interativos; `aria-hidden`, sem eventos, nunca esconde o cursor do sistema e some dentro de campos. Botões magnéticos com preenchimento que varre nos CTAs.
  - Regras: só `transform`, `opacity` e `clip-path` são animados, sem `will-change`; animação presa à rolagem não usa curva temporal, e com a rolagem suave ligada o scrub fica colado (não se suaviza duas vezes). O estado escondido é aplicado pelo próprio GSAP, nunca por CSS: se o JavaScript de animação não rodar, todo o conteúdo aparece. Nunca se esconde com `visibility` (um link abaixo da dobra perderia o nome acessível). Texto dividido pelo SplitText fica só em títulos, com `aria-label` no título e `aria-hidden` nos pedaços; texto embaralhado, só em elementos decorativos. Entradas não usam `once` no ScrollTrigger. Ao sair da rota tudo é desfeito (tweens, gatilhos, espaçador da seção fixa, rolagem suave).
  - Rolagem suave e o que ela não pode quebrar: âncoras do cabeçalho e do menu passam pelo Lenis e atualizam o endereço; `/#contato` direto rola ao montar; a lista do `Select` e o `Sheet` do menu rolam por dentro (o Lenis fica de fora de listas e diálogos do Radix e de quando o corpo da página está travado); teclado, foco e toque seguem nativos; o botão de voltar ao topo usa o mesmo caminho.
  - Sem sombras nem gradientes (a grade de fundo do hero é feita de linhas).
- Componentes shadcn: `Button`, `Badge`, `Tabs`, `Input`, `Textarea`, `Label`, `Select`, `Checkbox`, `Skeleton`, `Toast`/`Sonner`, `Sheet` (menu mobile). A landing editorial não usa `Card`, `Avatar`, `Separator` nem `NavigationMenu`: as seções são separadas por réguas de 2 px e o retrato é uma imagem com moldura.

### Privacidade `/privacidade`

- Layout: texto longo em markdown (controlador, finalidades, bases legais, retenção, direitos do titular, contato do encarregado); versão e data no topo.
- Componentes shadcn: `Card`, `Separator`.

### Entrar `/aluno/entrar`

- Layout: cartão central com as abas Entrar (ID do aluno, ID da turma, senha) e Criar conta (nome, IDs, senha, confirmação, aceite do termo).
- Componentes shadcn: `Card`, `Tabs`, `Input`, `Checkbox`, `Button`.

### Área do aluno `/aluno/*`

- Layout: barra lateral (menu em `Sheet` no celular) com Início, Conteúdos, Atividades, Questões, Minhas dúvidas, Mensagens, Feedback, Avisos, Aulas presenciais e Meus dados; sino de notificações no cabeçalho.
- Toda lista tem carregamento (`Skeleton`), erro com "Tentar de novo" e estado vazio com ícone e texto.
- Visual: barra lateral em Tinta com a faixa das quatro cores na identificação da turma; cada seção tem um selo na sua cor de acento (com o par de texto que passa em contraste). O Início abre com um bloco em Tinta: saudação, progresso geral (atividades feitas + conteúdos abertos sobre o total publicado) e o próximo passo sugerido (atividade pendente de prazo mais próximo, depois questão, depois conteúdo não aberto), seguido de números, atalhos e listas.
- Tempo real: a conversa com o professor e a resposta das dúvidas aparecem na tela aberta, sem recarregar; no painel do professor, dúvidas e mensagens novas entram na lista na hora.

### Turma do aluno `/aluno/turmas/:codigo`

- Layout: cabeçalho com curso, instituição · cidade · período e `Select` de turma; faixa de destaque "Aula ao vivo agora" quando houver sessão aberta; abas Calendário | Materiais | Curso | Atividades.
- Componentes shadcn: `Tabs`, `Select`, `Alert`, `Accordion` (encontros), `Table` (blocos), `Card`, `Badge`, `Button`, `Skeleton`, `Tooltip` (blocos da régua).

### Sala ao vivo `/aluno/turmas/:codigo/ao-vivo`

- Layout: desktop em duas colunas (esquerda: mural de perguntas + formulário; direita: mensagens); celular com abas Perguntas | Mensagens | Atividades. Atividade publicada abre como `Dialog` não bloqueante com contagem regressiva.
- Componentes shadcn: `Tabs`, `ScrollArea`, `Textarea`, `RadioGroup`, `Checkbox`, `Button`, `Badge`, `Dialog`, `Progress`, `Card`, `Slider` ou `ToggleGroup` (escala 1–5 e NPS).

### Meus dados `/aluno/meus-dados`

- Layout: cartões Perfil, Turmas, Consentimentos, Ações de privacidade.
- Componentes shadcn: `Card`, `Switch`, `Table`, `Button`, `AlertDialog`.

### Admin — estrutura geral `/admin/*`

- Layout: barra lateral em três grupos: Geral (Painel, Alunos, Turmas), Ensino (Conteúdos, Atividades, Questões) e Comunicação (Dúvidas, Mensagens, Feedbacks, Avisos, Contatos do site). No celular o menu abre em `Sheet`.
- Formulários em `Dialog`; ações que mudam acesso ou apagam dados em `AlertDialog` de confirmação; retorno em `Toast`.
- Componentes shadcn: `Sheet`, `Table`, `DropdownMenu`, `Dialog`, `AlertDialog`, `Select`, `Switch`, `Badge`, `Button`.

### Admin — Turma `/admin/turmas/:id`

- Layout: abas Dados | Alunos autorizados | Calendário | Materiais | Atividades | Ao vivo | Relatórios.
- Componentes shadcn: `Tabs`, `Form`, `Table` (com busca, filtro de status e paginação), `Dialog` (importar IDs com prévia), `Textarea`, `Badge`, `Switch`, `Calendar` + `Popover` (datas), `Sheet` (editar encontro e blocos), `Command` (buscar aluno).

### Admin — Construtor de atividade

- Layout: coluna esquerda com configurações; coluna direita com lista de itens reordenáveis e prévia como o aluno vê.
- Componentes shadcn: `Form`, `Select`, `Switch`, `Input`, `Card`, `Button`, `RadioGroup`, `Checkbox`.

### Admin — Painel ao vivo

- Layout: barra superior (status da sessão, presentes, Abrir/Encerrar); três colunas: fila de perguntas | atividade atual com gráfico de barras ao vivo | mensagens. Botão "Projetar" abre visão em tela cheia, fonte grande, fundo Papel.
- Componentes shadcn: `Card`, `Badge`, `Button`, `Tabs`, `ScrollArea`, `Textarea`, `Chart` (Recharts), `Dialog`.

### Admin — Relatórios

- Layout: filtros no topo; cartões de resumo; gráficos: satisfação média por encontro (barras agrupadas teoria × prática), acerto por item de quiz (barras horizontais); tabela de participação; botões Exportar CSV.
- Componentes shadcn: `Select`, `Card`, `Chart`, `Table`, `Button`.

## 6. Fluxos principais

### Professor prepara uma turma

1. Admin cria (ou reaproveita) o `curso` com ementa e capacidades.
2. Cria a `turma` (instituição, cidade, modalidade, período, vagas); o sistema sugere o `codigo`.
3. Cadastra os encontros e seus blocos (ou duplica de uma turma anterior do mesmo curso).
4. Cadastra os materiais, com liberação programada quando for o caso.
5. Cola ou importa a lista de matrículas, confere a prévia e confirma.
6. Cria as atividades em rascunho (quizzes e pesquisas por bloco de teoria e prática).
7. Muda `turma.status` para 'ativa' e compartilha com os alunos o ID da turma e o endereço `/aluno/entrar`.

### Aluno faz o primeiro acesso

1. O professor cadastra o aluno em `/admin/alunos` (com ou sem senha inicial) e passa o ID do aluno e o ID da turma.
2. Sem senha inicial: o aluno abre `/aluno/entrar`, aba Criar conta, informa nome, IDs e senha, e aceita o termo.
3. Sistema cria a conta e abre o painel do aluno.

### Aluno volta em outro dia

1. Aluno informa ID do aluno, ID da turma e senha.
2. Sistema confere e abre o painel. Se esqueceu a senha, o professor redefine em `/admin/alunos`.

### Aula ao vivo

1. No início do encontro o admin clica "Abrir sessão" no painel ao vivo.
2. Alunos logados veem a faixa "Aula ao vivo agora" e entram na sala.
3. Alunos enviam perguntas (turma ou só professor, anônimas ou não), votam nas da turma e trocam mensagens.
4. Ao fim de um bloco de teoria, o admin publica o quiz; alunos respondem dentro do tempo; o admin encerra e projeta o resultado.
5. Ao fim de um bloco de prática, o admin publica a pesquisa "Satisfação — prática" ligada ao bloco.
6. No momento de perguntas, o admin projeta as mais votadas, responde e marca como respondidas.
7. No fim, o admin clica "Encerrar sessão"; atividades publicadas são encerradas; sala vira somente leitura.

### Professor analisa a turma

1. Admin abre Relatórios e filtra a turma.
2. Compara a satisfação de teoria × prática por encontro e o acerto por item de quiz.
3. Exporta CSV de respostas e perguntas e a lista de e-mails que consentiram com comunicação.

## 7. Casos extremos

### Acesso

- ID, turma ou senha que não batem → sempre a mesma mensagem genérica "ID, turma ou senha incorretos." (não revelar qual campo falhou). Conta bloqueada só é informada depois da senha certa.
- Não há bloqueio por número de tentativas na entrada do aluno (decisão do dono, 08/10/2026): em sala a turma inteira usa o mesmo IP, e erros de digitação de alguns travavam todos. O formulário de contato mantém o limite por IP.
- Criar conta com ID que já tem conta → "Já existe uma conta para este ID. Use a aba Entrar.". ID fora da lista do professor → mensagem genérica.
- Senha fraca (menos de 8 caracteres ou sem letras e números) → recusada na tela e de novo no servidor.
- Turma passa para 'encerrada' → aluno ainda entra e vê calendário, materiais e resultados em modo leitura; não há sessão ao vivo.
- Aluno removido da lista (`ativo = false`) com sessão aberta → próxima chamada ao banco falha por RLS e o app faz logout.

### Formulários e validação

- Campos obrigatórios vazios → bloquear submit e mostrar erro no campo.
- `assunto = 'outro'` ou `material.tipo = 'outro'` com texto livre vazio → bloquear submit.
- Material sem `url` e sem `arquivo_path` → bloquear salvar.
- Importação de IDs: linhas vazias ignoradas; duplicados dentro da lista contados uma vez; IDs já existentes não duplicam; linhas fora do padrão listadas como inválidas na prévia.
- Soma das durações dos blocos diferente do tempo do encontro → aviso não bloqueante.
- Quiz sem opção correta ou item de escolha com menos de 2 opções → bloquear publicar.
- Atividade publicada com respostas → itens e opções ficam somente leitura (só título editável).

### Tempo real e concorrência

- Clique duplo em Enviar (pergunta, mensagem, resposta, cadastro) → botão desabilitado com spinner até a resposta; unique constraints impedem duplicata.
- Resposta enviada depois de `tempo_limite_s` ou após encerrar → RPC rejeita; UI mostra "Tempo encerrado".
- Conexão Realtime cai → `Alert` "Reconectando…"; ao voltar, recarregar a lista completa da sessão.
- Aluno entra com sessão já em andamento → vê o histórico completo e a atividade publicada no momento.
- Sessão encerrada com aluno digitando → envio rejeitado; texto preservado no campo.
- Mensagem com HTML ou script → renderizar como texto puro; URLs viram link com `rel="noopener noreferrer"`.

### Estados vazios

- Landing sem experiências de um tipo → esconder a aba correspondente.
- Turma sem encontros, materiais ou atividades → `Card` com texto "O professor ainda não publicou …".
- Sala sem perguntas ou mensagens → texto convidando a enviar a primeira.
- Relatório sem respostas → gráficos substituídos por "Sem respostas ainda"; atividade com 1 resposta mostra o valor sem média de grupo.
- Encontro sem pesquisa de teoria ou prática → barra ausente no gráfico (lacuna), sem zero.
- Atividade anônima com menos de 3 respostas → esconder respostas de texto livre no relatório para não identificar o aluno.

### Datas e fuso

- Todos os horários de encontro e bloco são locais da turma (`turma.fuso`); timestamps gravados em UTC e exibidos no fuso da turma.
- "Próximo encontro" e agregações por dia calculados no fuso da turma.
- Arquivo `.ics` com `TZID` da turma.

### Loading e erro

- Toda lista usa `Skeleton` durante carregamento.
- Falha de rede ou do servidor → `Toast` de erro com ação "Tentar de novo"; nada é marcado como enviado antes da confirmação.
- URL assinada expirada → gerar outra ao clicar de novo.

### LGPD

- Sem aceite do termo → cadastro não conclui.
- `comunicacao_professor` nunca pré-marcado; revogação tem efeito imediato na exportação de e-mails.
- Mudança de `versao_termo` → no próximo login, aluno vê o termo novo e precisa aceitar de novo antes de entrar.
- Pedido de exclusão → apaga perfil, inscrições e contribuições em cascata; agregados já exportados não são afetados.
- Retenção: Assumido — dados de turma apagados ou anonimizados 24 meses após `turma.data_fim` (job agendado mensal).
- `contato_mensagem` não é legível por usuários anônimos (insert only).

## 8. Fora de escopo (nesta fase)

- Newsletters e campanhas de e-mail. Os únicos e-mails que o sistema envia são as respostas de atividade para o professor e os avisos para os alunos que consentiram (F33 e F35). Não há e-mail de recuperação de senha: a entrada do aluno é por senha e quem redefine é o professor.
- Vídeo, áudio ou transmissão da aula dentro do app (a aula acontece presencialmente ou em ferramenta externa; `encontro.local` guarda o link).
- Notas, frequência e diário de classe oficiais da instituição.
- Gamificação (pontos, ranking, medalhas) e placar público de quiz.
- Outros tipos de interação além de quiz, enquete e pesquisa (nuvem de palavras, perguntas com imagem, sorteio). O campo `atividade.tipo` fica pronto para crescer.
- Mais de um professor ou papéis de monitor/coordenador.
- Blog, artigos ou venda de cursos na landing.
- Integração com sistemas das instituições (SENAI, etc.) para puxar listas de alunos automaticamente.
- App mobile nativo e notificações push.
- Internacionalização (só pt-BR).

## 9. Design tokens e estilo

Fonte: Brand Style Guide Vitor Ramos v1.0. Identidade de contraste alto, tipografia técnica e um acento dominante (azul) com três acentos de suporte. Montar o tema no tweakcn (https://tweakcn.com/) com os valores abaixo.

### Cores (tema claro)

| Token shadcn | Valor | Papel na marca |
| --- | --- | --- |
| `--background` | #f4f2ee | Papel — fundo/base |
| `--foreground` | #181a1e | Tinta — texto/contraste |
| `--card` | #ffffff | Superfície de cartão (Assumido) |
| `--primary` | #2f6fed | Principal |
| `--primary-foreground` | #ffffff | Texto sobre Principal |
| `--secondary` | #181a1e | Botão secundário (fundo Tinta) |
| `--secondary-foreground` | #f4f2ee | Texto sobre Tinta |
| `--muted-foreground` | #5a5a56 | Neutro sobre claro — texto secundário |
| `--border` / `--input` | #181a1e | Bordas de 2 px em Tinta |
| `--ring` | #2f6fed | Foco |
| `--accent-orange` | #d9711c | Alterno |
| `--accent-violet` | #8b5cf6 | Alterno |
| `--accent-green` | #1f9d55 | Alterno; também sucesso |

Tema escuro: `--background` #181a1e, `--foreground` #f4f2ee, `--muted-foreground` #c9c9c4 (Neutro sobre escuro), `--border` #f4f2ee; acentos iguais.

Tokens derivados (Assumido — o guia não define; deduzidos da paleta para completar o tema do shadcn/ui):

| Token | Claro | Escuro | Origem |
| --- | --- | --- | --- |
| `--muted` / `--accent` | #e9e6df | #2a2d33 | Papel escurecido / Tinta clareada (hover e fundos discretos) |
| `--popover` | #ffffff | #22252a | Igual ao card |
| `--card` (escuro) | — | #22252a | Tinta clareada |
| `--destructive` | #b3261e | #ff8a80 | A marca não define vermelho; usado só em erro e exclusão |
| `--accent-violet-tint` | roxo a 12 % sobre o fundo | idem | Regra do roxo na revisão de marca |
| `--chart-1…5` | azul, laranja, roxo, verde, Tinta | idem | Séries de gráfico |

### Tipografia

- Títulos H1–H3: Ubuntu Mono 700, letter-spacing -0.02em a -0.01em.
- Corpo: Ubuntu 500; destaque e chamadas: Ubuntu 700.
- Eyebrow (rótulo acima de títulos e seções): Ubuntu 700, 10–11 px, maiúsculas, letter-spacing 0.14–0.16em.
- Escala usada no guia: 10, 11, 12, 13, 16, 18, 19, 28 px.
- Títulos de página seguem a amostra tipográfica do guia: H1 56 px, H2 36 px, H3 22 px no desktop, reduzindo no celular (H1 36 px, H2 28 px). A landing usa escala própria, proporcional à largura da tela (seção 5, Landing).

**Plataforma (área do aluno e painel do professor) — decisão do dono, 07/10/2026.** Fundo branco (#ffffff) no lugar do Papel, para o preto destacar; o Papel vira tom de apoio (faixas, hover, cabeçalho de tabela). Texto corrido em Inter (fonte limpa). A fonte de código do guia (Ubuntu Mono 700) fica só nos títulos e no que é importante: números, IDs e datas (utilitário `destaque`). Cores, bordas de 2 px, raio de 2 px e regras de contraste continuam as do guia. A landing não muda. Implementação: classe `.plataforma` em `src/index.css`.

### Forma e espaçamento

- `--radius`: 2px (cantos quase retos em botões, cards e badges).
- Bordas: 2 px sólidas em Tinta nos cards e botões; botão de acento com borda 2 px Principal.
- Espaçamentos do guia: botão 13×24 px; badge 7×12 px; card 16×18 px; seções 64×40 px no desktop.
- Sem sombras nem gradientes.

### Cor por tipo de bloco (régua do calendário e badges)

| `bloco_encontro.tipo` | Cor |
| --- | --- |
| abertura | Tinta #181a1e |
| teoria | Principal #2f6fed |
| pratica | Alterno #d9711c |
| perguntas | Alterno #8b5cf6 |
| intervalo | Neutro #c9c9c4 |
| margem | Papel com hachura em #c9c9c4 |

Tags de tema da landing seguem o guia: Dados, IA, Educação, Produto, Engenharia.

### Revisão de marca (brand review) — regras para o agente

| Achado | Severidade | Regra de implementação |
| --- | --- | --- |
| Principal #2f6fed sobre Papel tem contraste 4,07:1, abaixo de 4,5:1 (WCAG AA) para texto comum | Alta | Azul como texto só em ≥ 18,7 px bold ou ≥ 24 px; links de corpo em Tinta sublinhada. Branco sobre azul (4,55:1) pode ser usado em botões. A mesma regra vale no tema escuro (azul sobre Tinta = 3,83:1) |
| O guia aplica sombra em cards e usa texto Papel sobre os acentos nos badges | Média | Prevalece esta seção: sem sombras; texto sobre acento sempre em Tinta |
| Laranja (2,97:1), verde (3,12:1) e roxo (3,79:1) sobre Papel falham para texto | Alta | Acentos só como preenchimento, borda ou ícone; texto sobre eles em Tinta (laranja 5,25:1, verde 4,99:1). Roxo: usar fundo tingido (12 %) com texto Tinta, nunca sólido com texto |
| Neutro sobre escuro #c9c9c4 sobre Papel = 1,49:1 | Média | Usar #c9c9c4 só no tema escuro ou como preenchimento (intervalo) |
| Status e cor não podem depender só da cor (ex.: acerto em verde) | Média | Sempre ícone ou texto junto ("Correta", "Encerrada") |
| Tom de voz do guia: "rigor técnico e clareza didática" | Baixa | Microcopy curta, em segunda pessoa ("você"), sem gírias, sem exclamações, sem emoji; títulos em caixa de frase (só eyebrows em maiúsculas) |
| Landing não deve ter superlativos sem prova ("o melhor", "referência nº 1") | Baixa | Descrever experiência com fatos: organização, cargo, período, tema |

Frase de apresentação do guia, para o hero: "Construindo produtos e educação em dados e inteligência artificial — do modelo ao letramento, com rigor técnico e clareza didática."
