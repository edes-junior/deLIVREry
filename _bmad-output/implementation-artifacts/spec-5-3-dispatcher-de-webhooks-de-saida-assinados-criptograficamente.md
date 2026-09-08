---
title: 'Story 5.3: Dispatcher de Webhooks de Saída Assinados Criptograficamente (HMAC-SHA256)'
type: 'feature'
created: '2026-09-08'
status: 'done'
baseline_commit: '3882daf27bc88db257c66dc64972f778d91c28c8'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Plataformas integradas e parceiros comerciais (PDVs, cardápios digitais, portais municipais) não recebem notificações em tempo real quando ocorrem eventos operacionais de entrega (`job.created`, `bid.submitted`, `job.accepted`, `job.completed`), e o deLIVREry não possui infraestrutura de despacho com garantia de autenticidade (HMAC) e resiliência a falhas de rede.

**Approach:** Desenvolver o serviço de despacho de webhooks de saída assíncrono (`WebhookDispatcherService`) com cálculo de assinatura criptográfica HMAC-SHA256, injeção de headers de segurança (`X-Signature-SHA256`, `X-Delivery-Event`, `X-Delivery-Timestamp`), filtragem por escopo municipal (`allowed_cities`) e mecanismo de retentativas automáticas (até 3 tentativas) com backoff exponencial para códigos 5xx ou falhas de rede.

## Boundaries & Constraints

**Always:**
- O payload deve ser transmitido via `HTTP POST` com cabeçalho `Content-Type: application/json`.
- A assinatura HMAC-SHA256 deve ser gerada utilizando o `secret_token` da subscrição sobre o corpo exato da requisição serializada e transmitida no cabeçalho `X-Signature-SHA256`.
- Cabeçalhos `X-Delivery-Event` (tipo do evento) e `X-Delivery-Timestamp` (timestamp ISO UTC do despacho) são obrigatórios em toda entrega.
- Caso o parceiro possua escopo restrito em `allowed_cities` (diferente de `{"*"}`), o evento só pode ser despachado se o município do evento constar em suas cidades autorizadas.
- Falhas temporárias (respostas HTTP >= 500 ou falhas de conexão/timeout) acionam política de retentativa de até 3 tentativas com backoff exponencial (1x, 2x, 4x o delay base).
- Erros de cliente parceiro (HTTP 4xx como 400 ou 404) são considerados falhas permanentes e não devem ser re-tentados.
- O despacho deve ser não-bloqueante para os fluxos síncronos da API e PWA.

**Ask First:**
- Expansão da lista de eventos canônicos suportados além de `job.created`, `bid.submitted`, `job.accepted`, `job.completed`.
- Alteração no número padrão de tentativas máximas (3 tentativas) ou timeouts de conexão.

**Never:**
- Nunca trafegar nem expor o `secret_token` no corpo do payload JSON ou em headers de log abertos.
- Nunca despachar webhooks para subscrições inativas (`is_active = false`) ou parceiros desativados (`api_clients.is_active = false`).
- Nunca bloquear a conclusão da transação principal de cadastro ou aceite de proposta aguardando o retorno HTTP do endpoint externo do parceiro.

## I/O & Edge-Case Matrix

| Cenário | Entrada / Evento | Saída Esperada / Comportamento | Tratamento de Erro |
|---|---|---|---|
| Despacho com Sucesso (200 OK) | Evento `job.created` com payload da vaga em `sao_paulo` para subscrição ativa | HTTP POST com `X-Signature-SHA256` correto, headers de evento e timestamp, status `success: true`, 1 tentativa | N/A |
| Falha Temporária (500 Server Error) | Servidor do parceiro responde HTTP 500 na 1ª tentativa | Retentativa com backoff exponencial (tentativas 2 e 3). Se responder 200 na 2ª tentativa, registra sucesso | Backoff exponencial (1s, 2s, 4s) |
| Falha Permanente por 4xx do Parceiro | Endpoint do parceiro retorna HTTP 404 Not Found ou 400 | Não repete requisições desnecessárias; encerra com status de falha permanente | Aborta imediatamente novas tentativas |
| Filtragem de Escopo Municipal | Vaga criada em `campinas`, mas cliente possui `allowed_cities: ['sao_paulo']` | O webhook é ignorado e nenhum HTTP POST é disparado para essa subscrição | Filtrado antes do disparo |
| Verificação Criptográfica HMAC | Payload JSON serializado com segredo conhecido | Digest hexadecimal SHA-256 gerado é matematicamente idêntico ao calculado pelo receptor | Erro se chave for inválida ou corpo modificado |
| Esgotamento de Tentativas (3 falhas 5xx/Timeout) | Endpoint do parceiro inoperante nas 3 tentativas consecutivas | Registra log de entrega com `success: false`, `attempts: 3`, armazenando último erro | Finaliza registrando auditoria de falha |

</frozen-after-approval>

## Code Map

- `apps/pwa/src/api/webhooks/types.ts` -- Definição de interfaces TypeScript para eventos (`WebhookEvent`), subscrições, payloads, headers e log de entrega (`WebhookDeliveryResult`).
- `apps/pwa/src/api/webhooks/webhook-crypto.ts` -- Algoritmo de cálculo e verificação de assinatura criptográfica HMAC-SHA256 compatível com Node.js e navegadores.
- `apps/pwa/src/api/webhooks/webhook-dispatcher.ts` -- Serviço de orquestração de despacho de webhooks, consulta de subscrições ativas, filtragem de cidades e ciclo de retentativas com backoff.
- `packages/api-client-sdk/src/index.js` -- Exportação do utilitário `verifyWebhookSignature` para clientes do SDK auditarem payloads recebidos.
- `tests/webhook-dispatcher.test.js` -- Suíte de testes automatizados cobrindo cálculo HMAC, headers, ciclo de retentativas 5xx, corte em 4xx e isolamento geográfico.

## Tasks & Acceptance

**Execution:**
- [x] `apps/pwa/src/api/webhooks/types.ts` -- Criar contratos de tipagem para eventos de webhook, subscrições, payloads e resultados de despacho.
- [x] `apps/pwa/src/api/webhooks/webhook-crypto.ts` -- Implementar funções `generateWebhookSignature` e `verifyWebhookSignature` com algoritmo HMAC-SHA256.
- [x] `apps/pwa/src/api/webhooks/webhook-dispatcher.ts` -- Implementar `WebhookDispatcherService` com disparo HTTP assíncrono, checagem de escopo municipal, backoff exponencial e registro de tentativas.
- [x] `packages/api-client-sdk/src/index.js` -- Adicionar método `verifyWebhookSignature` no SDK cliente para facilidade de integração de desenvolvedores terceiros.
- [x] `tests/webhook-dispatcher.test.js` -- Implementar suíte de testes com mocks HTTP cobrindo todos os cenários da matriz de I/O, segurança HMAC e retentativas.

**Acceptance Criteria:**
- Given um evento disparado (`job.created`, `bid.submitted`, `job.accepted`, `job.completed`), when houver subscrições ativas para o evento com escopo municipal compatível, then o webhook deve ser despachado via HTTP POST contendo os cabeçalhos `X-Signature-SHA256`, `X-Delivery-Event` e `X-Delivery-Timestamp`.
- Given um endpoint receptor respondendo com erro 5xx ou falha de rede, when a política de resiliência for executada, then o dispatcher deve re-tentar até 3 vezes com backoff exponencial antes de declarar falha.
- Given um endpoint receptor respondendo com erro 4xx, when a resposta for recebida, then o dispatcher não deve executar retentativas, encerrando imediatamente como falha permanente.

## Spec Change Log

<!-- Append-only. Populated by step-04 during review loops. -->

## Design Notes

- **Formato Canônico do Payload de Webhook:**
  ```json
  {
    "id": "evt_01J7K...",
    "event": "job.created",
    "timestamp": "2026-09-08T18:00:00.000Z",
    "data": { ... }
  }
  ```
- **Cabeçalhos HTTP Obrigatórios:**
  - `Content-Type`: `application/json`
  - `X-Delivery-Event`: `job.created` (ou outro evento canônico)
  - `X-Delivery-Timestamp`: Timestamp em formato ISO 8601 UTC
  - `X-Signature-SHA256`: Hash hexadecimal calculado como `HMAC-SHA256(secret_token, raw_json_body)`
- **Política de Retentativas e Backoff:**
  - Tentativa 1: Imediata.
  - Tentativa 2: Após $1 \times \text{baseDelayMs}$ (ex: 1000ms ou configurável para testes).
  - Tentativa 3: Após $2 \times \text{baseDelayMs}$ (ex: 2000ms).
  - Status final registrado com array de detalhes de cada tentativa (`attempts: [{ attemptNumber, statusCode, durationMs, error }]`).

## Verification

**Commands:**
- `npm test` -- expected: Todas as suítes passam, incluindo a nova `tests/webhook-dispatcher.test.js`.
- `node --experimental-strip-types --test tests/webhook-dispatcher.test.js` -- expected: 100% de aprovação nos testes da Story 5.3.
- `git status` -- expected: Árvore de trabalho íntegra.

**Manual checks (if no CLI):**
- Inspecionar assinatura HMAC-SHA256 comparando com utilitário padrão crypto do Node.js.
- Simular servidor receptor falhando nas primeiras 2 tentativas e sucedendo na 3ª.

## Suggested Review Order

**Webhook Dispatcher & Resilience Engine**

- Ponto de entrada de despacho para subscrição com retentativas e backoff exponencial
  [`webhook-dispatcher.ts:70`](../../apps/pwa/src/api/webhooks/webhook-dispatcher.ts#L70)

- Algoritmo criptográfico HMAC-SHA256 e validação segura contra timing attacks
  [`webhook-crypto.ts:16`](../../apps/pwa/src/api/webhooks/webhook-crypto.ts#L16)

**Data Contracts & Client SDK**

- Definições de tipagem para payload, tentativas e resultado consolidado
  [`types.ts:13`](../../apps/pwa/src/api/webhooks/types.ts#L13)

- Utilitários clientes de verificação de assinatura exportados pelo SDK
  [`index.js:189`](../../packages/api-client-sdk/src/index.js#L189)

**Automated Tests & Quality Gate**

- Suíte completa cobrindo matriz de I/O, segurança HMAC, erros 4xx vs 5xx e isolamento geográfico
  [`webhook-dispatcher.test.js:1`](../../tests/webhook-dispatcher.test.js#L1)

