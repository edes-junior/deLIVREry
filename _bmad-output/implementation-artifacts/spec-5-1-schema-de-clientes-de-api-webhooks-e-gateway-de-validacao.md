---
title: 'Story 5.1: Schema de Clientes de API, Webhooks e Gateway de Validação'
type: 'feature'
created: '2026-09-08'
status: 'done'
baseline_commit: '4acca3ce9e247f0af339e62720c0a1dbd04ab09f'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Parceiros B2B e integradores terceiros (cardápios digitais, PDVs e portais municipais) não possuem uma infraestrutura segura para autenticar requisições na API pública nem registrar URLs de webhook com escopo territorial restrito.

**Approach:** Criar o schema relacional no Supabase com tabelas `api_clients` e `webhooks_subscriptions` protegidas por RLS, e implementar o Gateway de Validação para autenticar chamadas via `X-API-Key` (hash SHA-256) e barrar acessos a cidades não autorizadas (`allowed_cities`).

## Boundaries & Constraints

**Always:**
- Persistir apenas o hash SHA-256 da API Key no banco (`api_key_hash`), nunca a chave em texto puro.
- Respostas de erro devem aderir estritamente à RFC 7807 Problem Details (`application/problem+json`) com campos `type`, `title`, `status`, `detail`.
- Requisições sem chave ou com chave inválida/inativa retornam `HTTP 401 Unauthorized`.
- Requisições para cidades não contempladas em `allowed_cities` (e diferente de `{"*"}`) retornam `HTTP 403 Forbidden`.
- 100% das novas tabelas devem possuir Row Level Security (RLS) habilitado.

**Ask First:**
- Modificação de políticas de expiração automática de API Keys ou rotação forçada.
- Alteração na estrutura de tabelas existentes (`users`, `job_posts`) além da inclusão do campo `origin_client_id`.

**Never:**
- Não armazenar `api_key` ou `secret_token` em texto plano em logs, respostas HTTP de consulta ou tabelas sem hash/segredo.
- Não permitir que parceiros de cidades restritas acessem ou criem vagas fora do seu escopo geográfico.
- Não expor dados confidenciais ou de outras organizações via RLS permissivo.

## I/O & Edge-Case Matrix

| Cenário | Entrada / Estado | Saída Esperada / Comportamento | Tratamento de Erro |
|---|---|---|---|
| Autenticação Válida (Nacional) | Header `X-API-Key: dlv_live_abc123`, `allowed_cities: ["*"]`, query `city_id=rio_de_janeiro` | `HTTP 200/Next`, contexto do cliente injetado (`client_id`, `rate_limit_rpm`) | N/A |
| Autenticação Válida (Cidade Permitida) | Header `X-API-Key: dlv_live_xyz789`, `allowed_cities: ["sao_paulo", "santos"]`, query `city_id=sao_paulo` | `HTTP 200/Next`, acesso autorizado para a cidade especificada | N/A |
| Chave Ausente | Requisição sem cabeçalho `X-API-Key` nem `Authorization: Bearer` | `HTTP 401 Unauthorized`, Problem Details RFC 7807 | Rejeição imediata antes do processamento de negócio |
| Chave Inválida ou Revogada | Header `X-API-Key: dlv_invalid` ou cliente com `is_active: false` | `HTTP 401 Unauthorized`, `detail: "API Key inválida, revogada ou inativa"` | Log de auditoria e resposta RFC 7807 |
| Escopo Geográfico Não Autorizado | Header válido com `allowed_cities: ["curitiba"]`, query `city_id=sao_paulo` | `HTTP 403 Forbidden`, `detail: "Acesso não autorizado para o município solicitado"` | RFC 7807 403 Forbidden com cidade solicitada |
| Subscrição de Webhook Válida | Registro em `webhooks_subscriptions` com `event_type='job.created'` | Registro persistido com FK `client_id`, `secret_token` e status ativo | N/A |
| Evento de Webhook Inválido | Registro em `webhooks_subscriptions` com `event_type='invalid.event'` | Violação de CHECK constraint (`check_webhook_event_type`) | Rejeição no banco com erro de integridade |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260908130000_api_clients_and_webhooks_schema.sql` -- Migration DDL das tabelas `api_clients`, `webhooks_subscriptions`, foreign keys `origin_client_id`, constraints, índices e RLS.
- `apps/pwa/src/api/gateway/api-gateway-service.ts` -- Serviço core do API Gateway para validação de `X-API-Key`, hashing SHA-256, checagem de escopo em `allowed_cities` e formatação RFC 7807.
- `apps/pwa/src/api/gateway/types.ts` -- Interfaces TypeScript para `ApiClient`, `WebhookSubscription`, `GatewayValidationResult` e RFC 7807 `ProblemDetails`.
- `packages/api-client-sdk/src/index.js` -- Extensão do SDK para suportar cabeçalho `X-API-Key` e utilitários de geração/validação de hash de credenciais.
- `tests/api-clients-gateway.test.js` -- Suíte de testes automatizados cobrindo DDL, RLS, regras de autenticação, escopo geográfico e formato RFC 7807.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260908130000_api_clients_and_webhooks_schema.sql` -- Criar migration SQL com tabelas `api_clients`, `webhooks_subscriptions`, coluna `origin_client_id` em `users` e `job_posts`, constraints de integridade, índices e políticas de RLS.
- [x] `apps/pwa/src/api/gateway/types.ts` -- Definir tipos e contratos do Gateway (clientes, subscrições de webhooks, resultados de validação e RFC 7807 Problem Details).
- [x] `apps/pwa/src/api/gateway/api-gateway-service.ts` -- Implementar `ApiGatewayService` com métodos de hashing SHA-256, verificação de credencial, validação de escopo geográfico `allowed_cities` e manipulação de requisições HTTP.
- [x] `packages/api-client-sdk/src/index.js` -- Atualizar SDK para envio automático do cabeçalho `X-API-Key` e exportação dos utilitários de hash.
- [x] `tests/api-clients-gateway.test.js` -- Criar suíte de testes unitários e de integração validando os cenários da matriz de I/O, DDL e erros RFC 7807.

**Acceptance Criteria:**
- Given a migration SQL executada no Supabase PostgreSQL, when as tabelas `api_clients` e `webhooks_subscriptions` forem criadas, then devem conter constraints de chave única para `api_key_hash`, validação de eventos canônicos para webhooks (`job.created`, `bid.submitted`, `job.accepted`, `job.completed`), `rate_limit_rpm > 0` e RLS ativo.
- Given uma requisição para a API sem cabeçalho `X-API-Key` ou com chave inválida/revogada, when o gateway processar o cabeçalho, then deve retornar `HTTP 401 Unauthorized` no padrão RFC 7807.
- Given uma requisição com chave válida mas solicitando cidade não presente em `allowed_cities` (e diferente de `{"*"}`), when o escopo for avaliado pelo gateway, then deve retornar `HTTP 403 Forbidden` no padrão RFC 7807.

## Spec Change Log

<!-- Append-only. Populated by step-04 during review loops. -->

## Design Notes

- **Hashing de Chave de API:**
  - Prefixo de chave: `dlv_live_` (produção) ou `dlv_test_` (testes/sandbox).
  - Algoritmo de hash: `SHA-256` em representação hexadecimal minúscula (`64 caracteres`).
  - No banco `api_clients`: persistido exclusivamente `api_key_hash`. A chave original nunca é armazenada após a criação.
- **Escopo Geográfico (`allowed_cities`):**
  - Valor padrão `{"*"}` autoriza todas as cidades e bairros nacionais.
  - Valores específicos contêm arrays de strings normalizadas (slugs em lowercase, ex: `{"sao_paulo", "rio_de_janeiro"}`).
  - Se a requisição indicar `city_id` (via query param, header ou payload), o gateway verifica se `allowed_cities` contém `*` ou a cidade normalizada.
- **Estrutura de Erro RFC 7807 Problem Details:**
  - Content-Type: `application/problem+json; charset=utf-8`
  - Campos: `type` (URI), `title` (resumo PT-BR), `status` (código numérico), `detail` (explicação do erro), `instance` (URI da requisição).

## Verification

**Commands:**
- `npm test` -- expected: Todas as suítes passam, incluindo `tests/api-clients-gateway.test.js`.
- `node --experimental-strip-types --test tests/api-clients-gateway.test.js` -- expected: 100% de aprovação nos testes da Story 5.1.
- `git status` -- expected: Árvore de trabalho limpa e arquivos versionados.

**Manual checks (if no CLI):**
- Inspecionar a migration SQL para garantir sintaxe compatível com PostgreSQL 15+ e RLS habilitado em ambas as tabelas.
- Verificar se `types.ts` exporta as tipagens completas sem erros de TypeScript.

## Suggested Review Order

**Autenticação e Interceptação no Gateway**

- Ponto de entrada do gateway para validação de X-API-Key e bloqueio por escopo municipal.
  [`api-gateway-service.ts:139`](../../apps/pwa/src/api/gateway/api-gateway-service.ts#L139)

- Hashing criptográfico SHA-256 e normalização de cidades para checagem contra allowed_cities.
  [`api-gateway-service.ts:24`](../../apps/pwa/src/api/gateway/api-gateway-service.ts#L24)

**Schema Relacional e Isolamento RLS**

- DDL das tabelas api_clients e webhooks_subscriptions com constraints de hash e eventos.
  [`20260908130000_api_clients_and_webhooks_schema.sql:10`](../../supabase/migrations/20260908130000_api_clients_and_webhooks_schema.sql#L10)

- Políticas de Row Level Security garantindo isolamento por tenant e acesso de service_role.
  [`20260908130000_api_clients_and_webhooks_schema.sql:98`](../../supabase/migrations/20260908130000_api_clients_and_webhooks_schema.sql#L98)

- Função PL/pgSQL de validação performática no banco com retorno padronizado.
  [`20260908130000_api_clients_and_webhooks_schema.sql:145`](../../supabase/migrations/20260908130000_api_clients_and_webhooks_schema.sql#L145)

**Integração do SDK e Contratos**

- Extensão do SDK para envio automático do cabeçalho X-API-Key e gerador de chaves.
  [`packages/api-client-sdk/src/index.js:58`](../../packages/api-client-sdk/src/index.js#L58)

- Modelos de tipos TypeScript e contrato de erro RFC 7807 Problem Details.
  [`types.ts:16`](../../apps/pwa/src/api/gateway/types.ts#L16)

**Testes Automatizados e Auditoria de Matriz**

- Testes de integração cobrindo cenários da matriz de I/O, DDL e erros RFC 7807.
  [`tests/api-clients-gateway.test.js:15`](../../tests/api-clients-gateway.test.js#L15)

