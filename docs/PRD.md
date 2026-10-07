# PRD — Plataforma Vitor Ramos (Landing + Sala de Aula Interativa)

Sep 29, 2026 · @Vitor Ramos

## 1. Visão geral

Site pessoal de Vitor Ramos (vitorramos.com) com duas partes no mesmo app. A parte pública é uma landing page com contato, LinkedIn, experiência profissional e docência. A parte restrita é uma sala de aula interativa: alunos entram com ID de aluno + ID de turma pré-validados pelo professor e acessam calendário, materiais, ementa e uma sala ao vivo com perguntas, mensagens, quizzes e pesquisas de satisfação. Um painel admin (só o professor) cadastra cursos, turmas, encontros, listas de IDs autorizados e atividades, e exporta todos os dados de interação.

Referência de estrutura de turma: o cronograma "Excel Básico com IA Generativa" (SENAI Campinas, 5 encontros de 14/10 a 28/10/2026, 18:45–22:45, 20 vagas), em que cada encontro é dividido em blocos tipados (abertura, teoria, prática, perguntas, intervalo, margem) e ligado a situações de aprendizagem (SA).

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
- Validação de ID de aluno + ID de turma e envio de código de acesso ficam numa Edge Function (`acesso-aluno`), nunca no cliente.
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
- Saída, nesta ordem: hero (título do perfil, nome em escala de página, faixa das quatro cores, bio, botões LinkedIn e Contato, lista dos cinco temas e foto), faixa de temas em letra grande, seção Frentes de trabalho (Palestra, Treinamento e Consultoria em lista editorial, com os textos dos cartões do guia; cada linha abre o contato com o assunto já escolhido), seção Experiência com abas Profissional | Docência (só quando há experiência publicada), seção Sala de aula interativa em fundo Tinta (recursos da área do aluno, link "Entrar na área do aluno" e prévia ilustrativa de um encontro), galeria de fotos, chamada final de tela cheia em azul, seção Contato (canais cadastrados e formulário), rodapé em Tinta com a assinatura, link `/privacidade` e "Área do aluno" → `/aluno/entrar`.
- Endereço com âncora (`/#contato`, `/#frentes`…): como as seções só existem depois da carga dos dados, a página rola até a seção assim que o conteúdo é montado.
- Fotos: configuradas em `src/conteudo/galeria.ts` (arquivos em `public/fotos/`). Enquanto forem ilustrações provisórias, aparecem com a etiqueta "Foto de exemplo". A foto enviada pelo admin (`perfil_publico.foto_path`) tem prioridade sobre o retrato do arquivo.

### F2 — Formulário de contato

- Entrada (UI): nome, e-mail, assunto (`Select`), assunto\_outro (se 'outro'), mensagem, checkbox obrigatório "Li a política de privacidade".
- Comportamento: valida; insere em `contato_mensagem` (insert público via RLS, sem select); limite de 3 envios por IP por hora na Edge Function `contato`.
- Saída: `Toast` "Mensagem enviada"; registro visível no admin.

### Aluno

### F3 — Primeiro acesso (cadastro na turma)

- Entrada (UI): ID do aluno (matrícula) + ID da turma.
- Comportamento: Edge Function `acesso-aluno` normaliza (trim, upper) e busca `aluno_autorizado` com `ativo = true` em `turma` com `status = 'ativa'`. Se não há `inscricao` para esse ID, abre a etapa de cadastro: nome, e-mail, aceite do termo de uso (obrigatório), switch "Quero receber comunicações do professor por e-mail" (opcional, desligado por padrão). Envia código OTP de 6 dígitos ao e-mail (Supabase Auth `signInWithOtp`). Com o código válido: cria ou reaproveita `perfil` pelo e-mail, cria `inscricao`, grava dois registros em `consentimento` (`uso_dados_pedagogicos` = true pelo aceite; `comunicacao_professor` = valor do switch) com `versao_termo` vigente e `origem = 'cadastro'`.
- Saída: sessão autenticada; redireciona para `/aluno/turmas/:codigo`.
- Assumido: o login só com os dois IDs não é seguro (IDs circulam em listas de chamada), por isso o e-mail é confirmado por código.

### F4 — Login recorrente

- Entrada (UI): ID do aluno + ID da turma.
- Comportamento: `acesso-aluno` encontra a `inscricao`, dispara OTP para o e-mail do `perfil` e mostra o e-mail mascarado (ex.: v•••@gmail.com). Código válido → sessão de 30 dias; atualiza `inscricao.ultimo_acesso_em`.
- Saída: `/aluno/turmas/:codigo`. Aluno com mais de uma inscrição vê um `Select` para trocar de turma.

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

## 5. Telas e componentes

### Landing `/`

- Layout: coluna de até 1680 px com calha lateral fluida (16 px no celular, até 64 px), grade de 12 colunas no desktop. As seções alternam Papel, Tinta e azul. Header fixo (wordmark "Vitor Ramos" em Ubuntu Mono + links âncora Frentes · Experiência · Docência · Sala de aula · Contato, com sublinhado na seção em leitura + botão "Área do aluno"; abaixo de 1024 px os links vão para o menu em `Sheet`), barra de progresso de leitura e botão de voltar ao topo.
- Tipografia da landing: o nome no hero e a assinatura no rodapé ocupam a largura útil da página. Como a Ubuntu Mono avança 0,5 em por caractere, o tamanho é `largura útil / (caracteres × 0,5)`, calculado por `escalaDoNome()` a partir do nome cadastrado (uma linha a partir de 768 px; uma palavra por linha no celular), com teto pela altura da tela. Títulos de seção em `clamp(40px, 7vw, 124px)`, título da chamada final em `clamp(40px, 8.4vw, 152px)`, sempre com altura de linha 1. O número da seção vai em azul por ser texto grande (≥ 24 px bold).
- Seções: hero com grade técnica de fundo (linhas), eyebrow, régua de 2 px, nome, faixa das quatro cores, bio, botões, lista de temas com marcador de cor e retrato. Frentes: uma linha por frente, com número, rótulo, título grande, texto e "Conversar sobre …"; no hover e no foco um bloco chapado da cor da frente varre a linha (texto branco sobre azul, Tinta sobre laranja e verde). Experiência: tabela editorial (período, cargo e organização, descrição e temas) separada por réguas de 2 px. Sala de aula: texto e recursos à esquerda, prévia do encontro à direita (relógio, régua do encontro com agulha, pergunta com votos, quiz e materiais). Galeria: grade assimétrica de 12 colunas, cada foto com legenda, numeração e régua. Chamada final: tela cheia em azul. Contato: frase de orientação e canais em linhas (e-mail, LinkedIn, telefone, outros links) + formulário em moldura de 2 px. Rodapé em Tinta.
- Movimento (GSAP com ScrollTrigger e SplitText, montado por `useMovimento` em `src/lib/movimento.ts`; sem biblioteca de rolagem suave, a rolagem é a nativa do navegador):
  - Hero: as letras do nome sobem em sequência, a régua e a faixa de cores se desenham, a bio e o retrato abrem por recorte (`clip-path`); ao rolar, a grade, o nome e o retrato deslizam em velocidades diferentes.
  - Faixa de temas: rola sozinha em velocidade constante, acelera com a velocidade da rolagem e inverte o sentido ao rolar para cima; para fora da tela.
  - Cabeçalhos de seção: número e palavras do título sobem de dentro da linha e a régua se desenha. Frentes e Experiência: régua desenhada e conteúdo subindo, linha a linha.
  - Sala de aula: em telas com pelo menos 1024 px de largura e 800 px de altura a seção fica fixa (pin) e a rolagem faz a aula passar — a régua do encontro se preenche bloco a bloco, o relógio vai de 18:45 a 22:45 com o bloco em andamento, e a pergunta, o quiz e os materiais entram no momento em que cada recurso é usado; rolar para cima retrocede. Em telas menores a mesma sequência toca uma vez (3,5 s) quando a prévia entra na tela, sem fixar nada.
  - Galeria: molduras abrem por recorte enquanto a imagem assenta; no desktop as colunas têm parallax leve. Chamada final: o painel azul abre por recorte preso à rolagem e o título sobe palavra a palavra. Contato: réguas desenhadas e moldura do formulário abrindo. Rodapé: letras da assinatura subindo.
  - Regras: só `transform`, `opacity` e `clip-path` são animados, sem `will-change`; animação presa à rolagem (scrub) não usa curva temporal. O estado escondido é aplicado pelo próprio GSAP, nunca por CSS, e nunca com `visibility` (um link abaixo da dobra perderia o nome acessível). Texto dividido pelo SplitText fica só em títulos, com `aria-label` no título e `aria-hidden` nos pedaços. Ao sair da rota tudo é desfeito (tweens, gatilhos e o espaçador da seção fixa).
  - Com `prefers-reduced-motion: reduce` nada disso é montado: a página aparece completa e estática (prévia da sala com o encontro inteiro), sem seção fixa; nenhuma informação depende da animação. A barra de progresso de leitura continua, por ser resposta direta à rolagem da própria pessoa.
  - Sem sombras nem gradientes (a grade de fundo do hero é feita de linhas).
- Componentes shadcn: `Button`, `Badge`, `Tabs`, `Input`, `Textarea`, `Label`, `Select`, `Checkbox`, `Skeleton`, `Toast`/`Sonner`, `Sheet` (menu mobile). A landing editorial não usa `Card`, `Avatar`, `Separator` nem `NavigationMenu`: as seções são separadas por réguas de 2 px e o retrato é uma imagem com moldura.

### Privacidade `/privacidade`

- Layout: texto longo em markdown (controlador, finalidades, bases legais, retenção, direitos do titular, contato do encarregado); versão e data no topo.
- Componentes shadcn: `Card`, `Separator`.

### Entrar `/aluno/entrar`

- Layout: cartão central em 3 etapas: (1) IDs, (2) cadastro — só no primeiro acesso, (3) código OTP. Indicador de etapa no topo.
- Componentes shadcn: `Card`, `Form`, `Input`, `Switch`, `Checkbox`, `InputOTP`, `Button`, `Alert`, `Progress`.

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

- Layout: `Sidebar` com Painel, Landing, Mensagens de contato, Cursos, Turmas, Relatórios; área principal com breadcrumb.
- Componentes shadcn: `Sidebar`, `Breadcrumb`, `DropdownMenu`, `Button`.

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

1. Aluno abre `/aluno/entrar` e informa ID do aluno + ID da turma.
2. Sistema valida os IDs; como não há inscrição, mostra o cadastro.
3. Aluno informa nome e e-mail, aceita o termo e escolhe se quer receber comunicações.
4. Sistema envia código de 6 dígitos; aluno digita.
5. Sistema cria perfil, inscrição e registros de consentimento, e abre a página da turma.

### Aluno volta em outro dia

1. Aluno informa os mesmos IDs.
2. Sistema envia código ao e-mail cadastrado e mostra o e-mail mascarado.
3. Aluno digita o código e cai na página da turma (sessão vale 30 dias no mesmo aparelho).

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

- IDs não encontrados, ID `ativo = false` ou turma não 'ativa' → sempre a mesma mensagem genérica "Não encontramos essa combinação. Confira com o professor." (não revelar qual campo falhou).
- Mais de 5 tentativas de IDs inválidos por IP em 15 min → bloquear por 15 min.
- Código OTP errado ou expirado (validade 10 min) → erro no `InputOTP` + botão "Reenviar código" liberado após 60 s.
- E-mail já usado por outro perfil em outra turma → reaproveitar o perfil (mesma pessoa em várias turmas); nome existente é mantido.
- ID já inscrito tentando novo cadastro com outro e-mail → seguir o fluxo de login recorrente; troca de e-mail só pelo admin.
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

- Envio de e-mails em massa ou newsletters pelo sistema (fase 1 só exporta a lista de quem consentiu). Único e-mail transacional: o código OTP.
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
