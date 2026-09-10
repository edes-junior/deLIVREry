---
title: 'Ocultação de Ficha e Contatos em Turnos Fechados e Exibição de Avaliação Pendente'
type: 'bugfix'
created: '2026-09-10'
status: 'done'
route: 'one-shot'
---

# Ocultação de Ficha e Contatos em Turnos Fechados e Exibição de Avaliação Pendente

## Intent

**Problem:** Quando um turno de entrega estava fechado/concluído (`status: 'completed'`), o card gerencial do lojista continuava exibindo a ficha completa do entregador, opções de contato (WhatsApp/Ligar) e o botão redundante de conclusão de turno, além do botão de avaliar mesmo após o envio da avaliação.

**Approach:** Adaptar os componentes `MatchedContactCard`, `StoreJobManagementCard` e `StoreJobsList` para que, com o turno fechado, a ficha do entregador, contatos e botão de conclusão sejam ocultados, mantendo apenas o botão de avaliação caso o turno ainda não tenha sido avaliado pelo usuário. Uma vez avaliado, exibe confirmação limpa de turno finalizado e avaliado.

## Suggested Review Order

**Componente de Contato e Ações**

- Renderização condicional para omitir ficha/contatos/conclusão quando o turno estiver fechado (`isClosed`) e exibir apenas o bloco de avaliação pendente.
  [`MatchedContactCard.tsx:107`](../../apps/pwa/src/components/jobs/MatchedContactCard.tsx#L107)

**Card Gerencial do Lojista**

- Consulta de status de avaliação e repasse das propriedades `jobStatus` e `hasRated` para o card do turno.
  [`StoreJobManagementCard.tsx:28`](../../apps/pwa/src/components/jobs/StoreJobManagementCard.tsx#L28)

**Lista de Vagas e Turnos**

- Carregamento em lote dos IDs de turnos avaliados e atualização reativa do estado ao concluir avaliação no modal.
  [`StoreJobsList.tsx:28`](../../apps/pwa/src/components/jobs/StoreJobsList.tsx#L28)

**Camada de Serviço (Job Service)**

- Implementação das funções `getRatedJobIdsForUser` e `hasUserRatedJob` consultando a tabela `job_ratings`.
  [`job-service.ts:927`](../../apps/pwa/src/jobs/job-service.ts#L927)

**Testes Automatizados**

- Suíte de validação cobrindo os cenários de turno fechado avaliado, turno pendente de avaliação e turno em andamento.
  [`closed-shift-card-actions.test.js:1`](../../tests/closed-shift-card-actions.test.js#L1)
