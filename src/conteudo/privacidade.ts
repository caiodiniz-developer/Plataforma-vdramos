/**
 * Texto da política de privacidade e termo de uso exibido em `/privacidade` e
 * no cadastro do aluno. Ao alterar o texto, troque também
 * `VERSAO_TERMO_VIGENTE` em `src/dominio/consentimento.ts` e a variável
 * `VERSAO_TERMO` das Edge Functions: os alunos aceitam de novo no próximo login.
 *
 * RASCUNHO: o conteúdo descreve o que o sistema faz hoje, mas precisa ser
 * revisado pelo controlador (e pelo jurídico, se houver) antes de ir ao ar.
 */
export const DATA_DA_POLITICA = '2026-10-03'

export const POLITICA_DE_PRIVACIDADE = `
## Quem é o controlador

O controlador dos dados é **Vitor Ramos**, responsável pelo site vitorramos.com e pela sala de aula interativa usada nos cursos que ministra.

## Quais dados são tratados

- **Formulário de contato:** nome, e-mail, assunto e a mensagem enviada.
- **Cadastro do aluno:** ID de aluno informado pela instituição e nome. O e-mail é opcional: você só informa se quiser, e ele só é usado para as comunicações que autorizar.
- **Uso da plataforma:** perguntas, votos, mensagens, dúvidas, feedbacks, respostas a questões, atividades, quizzes, enquetes e pesquisas de satisfação, os arquivos que você anexar às atividades, os conteúdos que abriu e a data do último acesso.
- **Segurança:** no formulário de contato, um código derivado do endereço IP, guardado por até 24 horas, para limitar o número de envios. O endereço IP em si não é armazenado.

O site não usa cookies de publicidade nem ferramentas de rastreamento de terceiros.

## Para que os dados são usados e com qual base legal

| Finalidade | Base legal (LGPD) |
| --- | --- |
| Responder ao contato enviado pelo formulário | Procedimentos preliminares a contrato, a pedido do titular (art. 7º, V) |
| Dar acesso à turma e conduzir as atividades do curso | Execução do serviço educacional (art. 7º, V) |
| Analisar resultados de quizzes e pesquisas para melhorar as aulas | Consentimento — "uso dos dados para fins pedagógicos" (art. 7º, I) |
| Enviar comunicações do professor por e-mail | Consentimento específico e opcional (art. 7º, I) |
| Enviar ao professor, por e-mail, as respostas e os arquivos das atividades | Execução do serviço educacional (art. 7º, V) |
| Limitar envios do formulário de contato e prevenir abuso | Legítimo interesse (art. 7º, IX) |

O consentimento para comunicações nunca vem marcado: no primeiro acesso a plataforma pergunta se você quer receber, e responder "não" não muda nada no seu acesso. Ele pode ser retirado a qualquer momento na página "Meus dados", com efeito imediato. O envio de e-mails é feito por um serviço de entrega contratado para isso, que recebe apenas o endereço de destino e o conteúdo da mensagem.

## Perguntas anônimas e pesquisas anônimas

Quando você envia uma pergunta como anônima, seu nome não aparece para a turma nem para o professor. A autoria fica registrada apenas no banco de dados, para permitir que você veja e exclua as próprias contribuições.

Nas atividades marcadas como anônimas, os relatórios do professor mostram um código no lugar do seu nome, e as respostas em texto só são exibidas quando há pelo menos três respostas.

## Com quem os dados são compartilhados

Os dados ficam hospedados na Supabase, que atua como operadora e fornece banco de dados, autenticação e envio do código de acesso por e-mail. Os dados não são vendidos nem cedidos para publicidade.

A instituição onde o curso acontece não recebe pela plataforma as suas perguntas, mensagens ou respostas individuais.

## Por quanto tempo os dados ficam guardados

- **Dados da turma** (inscrição, perguntas, mensagens e respostas): até 24 meses depois do fim da turma. Depois disso são apagados.
- **Mensagens do formulário de contato:** pelo tempo necessário para responder e dar seguimento ao assunto.
- **Histórico de consentimento:** enquanto a conta existir.

## Seus direitos

Você pode, a qualquer momento:

- **Acessar e baixar seus dados** em "Meus dados", no botão "Baixar meus dados".
- **Corrigir** seu nome na mesma página. A troca de e-mail é feita pelo professor.
- **Retirar o consentimento** para comunicações.
- **Pedir a exclusão** da conta em "Solicitar exclusão". A exclusão apaga perfil, inscrições e contribuições. Resultados agregados já exportados não são afetados.
- **Pedir informações** sobre o tratamento ou apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).

## Contato do encarregado

Dúvidas e pedidos sobre privacidade podem ser enviados pelo formulário de contato do site, com o assunto "Outro" e a indicação "Privacidade".

## Mudanças nesta política

Quando o texto mudar, a versão e a data no topo desta página são atualizadas e os alunos precisam aceitar a nova versão no próximo acesso.
`
