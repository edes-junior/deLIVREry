---
title: 'Story 5.2: Endpoints RESTful Headless de Gestão de Vagas e Perfis (OpenAPI 3.0)'
type: 'feature'
created: '2026-09-08'
status: 'done'
baseline_commit: '7d2502caad89ac3bd4303150205d7c0a442a478c'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Parceiros comerciais (sistemas de PDV, cardápios digitais e portais municipais) não possuem endpoints RESTful padronizados para cadastrar entregadores e lojistas, listar vagas por município ou aceitar propostas de matching de forma programática (headless) sem depender da interface web do PWA.

**Approach:** Implementar o roteador e controladores da API RESTful `/api/v1/*` com validação de payloads, rate limiting por tenant (120 RPM / 600 RPM com HTTP 429 e `Retry-After`), respostas em conformidade com OpenAPI 3.0 e erros em RFC 7807 Problem Details.

## Boundaries & Constraints

**Always:**
- Todas as rotas `/api/v1/*` passam pelo `ApiGatewayService` para validação de `X-API-Key` e escopo de `allowed_cities`.
- Todas as respostas de erro devem seguir estritamente o formato RFC 7807 Problem Details (`application/problem+json`).
- Excesso de taxa de requisições por minuto (`rate_limit_rpm`) deve responder imediatamente com `HTTP 429 Too Many Requests` e cabeçalho `Retry-After: 60`.
- Cadastros headless originados via API devem registrar o `origin_client_id` do tenant autenticado.
- A listagem de vagas (`GET /api/v1/jobs`) requer obrigatoriamente o parâmetro `city_id` e valida contra as cidades autorizadas do cliente.

**Ask First:**
- Modificação dos limites padrão de RPM (120 para Free, 600 para Enterprise) além dos valores especificados no PRD.
- Alteração no contrato de parâmetros obrigatórios de cadastro já consolidados no Epic 1 e 2.

**Never:**
- Não permitir acesso headless a vagas de municípios fora do `allowed_cities` do parceiro.
- Não retornar códigos 200/201 contendo estruturas de erro embutidas (erros devem usar status codes HTTP 4xx/5xx).
- Não persistir nem expor senhas ou tokens sensíveis nos payloads de resposta.

## I/O & Edge-Case Matrix

| Cenário | Entrada / Estado | Saída Esperada / Comportamento | Tratamento de Erro |
|---|---|---|---|
| Cadastro de Entregador Válido | `POST /api/v1/couriers` com CPF válido, modal, tarifas e endereço | `HTTP 201 Created`, perfil criado com `origin_client_id` e `referral_code` | N/A |
| Cadastro de Lojista Válido | `POST /api/v1/stores` com CPF válido, nome da loja, endereço e coordenadas | `HTTP 201 Created`, loja criada com `reputation_score: 5.00` | N/A |
| Listagem de Vagas por Cidade | `GET /api/v1/jobs?city_id=sao_paulo&transport_modal=motorcycle` | `HTTP 200 OK`, lista JSON de vagas abertas (`status: open`) compatíveis | N/A |
| Aceite de Proposta (Matching) | `POST /api/v1/bids/:id/accept` com `store_id` e `job_id` | `HTTP 200 OK`, vaga atualizada para `matched`, propostas concorrentes rejeitadas | N/A |
| Rate Limit Excedido | Cliente 120 RPM realizando requisição #121 no mesmo minuto | `HTTP 429 Too Many Requests`, header `Retry-After: 60`, RFC 7807 | Rejeição antes do processamento do endpoint |
| Dados Inválidos (CPF ou campos) | `POST /api/v1/couriers` com CPF matematicamente inválido | `HTTP 400 Bad Request`, RFC 7807 com array `invalidParams` | Rejeição de validação de negócio |
| Vaga Inexistente no Matching | `POST /api/v1/bids/bid_999/accept` com vaga não encontrada | `HTTP 404 Not Found`, RFC 7807 informando recurso inexistente | Rejeição imediata |

</frozen-after-approval>

## Code Map

- `apps/pwa/src/api/gateway/rate-limiter.ts` -- Mecanismo de controle de taxa por janela móvel de minuto por tenant com cabeçalhos `X-RateLimit-*` e `Retry-After`.
- `apps/pwa/src/api/headless/headless-api-router.ts` -- Roteador RESTful `/api/v1/*` com dispatchers para couriers, stores, jobs e bids, interceptado pelo gateway.
- `apps/pwa/src/api/openapi/openapi-spec.ts` -- Especificação OpenAPI 3.0 consolidada em JSON/TypeScript cobrindo todos os endpoints headless e schemas RFC 7807.
- `packages/api-client-sdk/src/index.js` -- Extensão do SDK com métodos cliente para `createCourier`, `createStore`, `getJobs` e `acceptBid`.
- `tests/headless-api-endpoints.test.js` -- Suíte de testes automatizados cobrindo todos os endpoints, rate limiting, validações de payload e conformidade OpenAPI 3.0.

## Tasks & Acceptance

**Execution:**
- [x] `apps/pwa/src/api/gateway/rate-limiter.ts` -- Implementar `RateLimiterService` com controle de RPM por tenant, decremento, reset e cabeçalho `Retry-After`.
- [x] `apps/pwa/src/api/openapi/openapi-spec.ts` -- Criar especificação OpenAPI 3.0 completa para as rotas `/api/v1/couriers`, `/api/v1/stores`, `/api/v1/jobs`, `/api/v1/bids/{id}/accept`.
- [x] `apps/pwa/src/api/headless/headless-api-router.ts` -- Implementar roteamento RESTful e controladores headless integrados ao `ApiGatewayService` e `RateLimiterService`.
- [x] `packages/api-client-sdk/src/index.js` -- Adicionar métodos no SDK cliente para interagir nativamente com as rotas headless.
- [x] `tests/headless-api-endpoints.test.js` -- Criar suíte de testes validando os cenários da matriz de I/O, rate limiting 429, validações 400/404 e aderência a OpenAPI 3.0.

**Acceptance Criteria:**
- Given requisições enviadas para as rotas `/api/v1/*` com chaves válidas e escopo autorizado, when os payloads forem válidos, then as respostas devem retornar em formato JSON estritamente aderente à especificação OpenAPI 3.0.
- Given ocorrência de erros de validação ou de negócio na API, when a resposta for gerada, then ela deve seguir a padronização RFC 7807 Problem Details (campos `type`, `title`, `status`, `detail`).
- Given um cliente excedendo o limite de requisições configurado (120 RPM para Free, 600 RPM para Enterprise), when o rate limit for atingido, then o gateway deve responder com `HTTP 429 Too Many Requests` e cabeçalho `Retry-After`.

## Spec Change Log

<!-- Append-only. Populated by step-04 during review loops. -->

## Design Notes

- **Algoritmo de Rate Limiting:**
  - Janela móvel de 60 segundos por `client_id`.
  - Cabeçalhos de resposta:
    - `X-RateLimit-Limit`: Limite contratual do cliente (ex: 120 ou 600).
    - `X-RateLimit-Remaining`: Requisições restantes na janela atual.
    - `X-RateLimit-Reset`: Timestamp UNIX em segundos de quando a janela será resetada.
    - `Retry-After`: Segundos restantes para tentar novamente quando o status for 429 (ex: `60`).
- **Rotas Canônicas e Verbos HTTP:**
  - `POST /api/v1/couriers`: Cria entregador headless (`origin_client_id` preenchido automaticamente).
  - `POST /api/v1/stores`: Cria lojista headless.
  - `GET /api/v1/jobs`: Lista vagas com status `open` filtradas por `city_id` e opcionalmente `neighborhood_id`, `transport_modal`.
  - `POST /api/v1/bids/:id/accept`: Aceita a proposta e fecha o matching com status `matched`.
- **Formatação de Erro RFC 7807 Problem Details:**
  - Em erros 400: array `invalidParams: [{ name, reason }]` apontando os campos defeituosos.
  - Em erros 404: `type: 'https://delivrery.app.br/errors/not-found'`.
  - Em erros 429: `type: 'https://delivrery.app.br/errors/rate-limit-exceeded'`.

## Verification

**Commands:**
- `npm test` -- expected: Todas as suítes passam, incluindo `tests/headless-api-endpoints.test.js`.
- `node --experimental-strip-types --test tests/headless-api-endpoints.test.js` -- expected: 100% de aprovação nos testes da Story 5.2.
- `git status` -- expected: Árvore de trabalho limpa e arquivos versionados.

**Manual checks (if no CLI):**
- Inspecionar a especificação OpenAPI 3.0 para garantir compatibilidade com Swagger UI / Redoc.
- Testar a cascata de rate limiting simulando 121 requisições em menos de 1 minuto.

## Suggested Review Order

**Headless Routing & API Gateway**

- Entry point central interceptando rotas headless e aplicando gateway e rate limiting
  [`headless-api-router.ts:20`](../../apps/pwa/src/api/headless/headless-api-router.ts#L20)

- Algoritmo de rate limiting por tenant em janela deslizante com cabeçalhos RFC e 429
  [`rate-limiter.ts:28`](../../apps/pwa/src/api/gateway/rate-limiter.ts#L28)

**API Contract & SDK**

- Especificação OpenAPI 3.0.3 e esquemas RFC 7807 Problem Details
  [`openapi-spec.ts:1`](../../apps/pwa/src/api/openapi/openapi-spec.ts#L1)

- Métodos do SDK cliente para consumo nativo dos endpoints headless
  [`index.js:66`](../../packages/api-client-sdk/src/index.js#L66)

**Automated Tests & Quality Gate**

- Suíte de testes com cobertura completa dos endpoints, erros 4xx e rate limiting
  [`headless-api-endpoints.test.js:1`](../../tests/headless-api-endpoints.test.js#L1)

