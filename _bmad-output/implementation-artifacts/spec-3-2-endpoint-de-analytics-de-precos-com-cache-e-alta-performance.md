---
title: 'Story 3.2: Endpoint de Analytics de Preços com Cache e Alta Performance'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: '2f90e69'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O PWA de entregadores e lojistas, landing pages públicas e eventuais integrações de PDVs/portais municipais parceiros precisam carregar os balizadores regionais de preços (medianas, mínimos e máximos) de forma instantânea, sem sobrecarregar o banco de dados relacional e com garantia estrita de latência $< 100\text{ms}$ (NFR-3).

**Approach:** Desenvolver o endpoint analítico público `GET /api/v1/analytics/pricing-stats` (Supabase Edge Function / Handler HTTP REST) e integrá-lo ao `api-client-sdk` e ao `PricingService`. O endpoint disponibiliza cache em memória multi-camadas (5 minutos), cabeçalhos HTTP padronizados (`Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=600` e `ETag`), suporte a CORS universal, erros padronizados RFC 7807 Problem Details (400 Bad Request, 405 Method Not Allowed) e cálculo em tempo real de valores sugeridos ("Sugerir Preço de Mercado") para formulários de vagas.

## Boundaries & Constraints

**Always:**
- O endpoint deve responder requisições `GET` em formato JSON e aceitar requisições `OPTIONS` para preflight CORS.
- Parâmetros obrigatórios de consulta: `city_id` e `neighborhood_id` (com `state_id` e `transport_modal` como filtros complementares).
- Resposta a consultas válidas deve incluir os cabeçalhos `Cache-Control` (`public, max-age=300, s-maxage=300, stale-while-revalidate=600`) e `Content-Type: application/json; charset=utf-8`.
- Tratamento de erro deve seguir rigorosamente a especificação RFC 7807 Problem Details (`application/problem+json`) com campos `type`, `title`, `status`, `detail` e `instance`.
- A latência da consulta em condições de cache/índice deve ser $< 100\text{ms}$ (NFR-3).
- Deve incluir valor sugerido de mercado para facilitação de preenchimento em 1 toque no PWA.

**Ask First:**
- Alterar o TTL de cache de 5 minutos (300 segundos).
- Tornar autenticação obrigatória no endpoint analítico (ele é desenhado como público/read-only para PWA e Landing Pages).

**Never:**
- Nunca expor dados sensíveis ou informações de identificação de usuários nas métricas consolidadas.
- Nunca quebrar ou retornar 500 caso o bairro não possua dados; deve responder 200 com fallback transparente (`is_consolidated = false`).
- Nunca processar métodos com mutação (`POST`, `PUT`, `DELETE`, `PATCH`) neste endpoint analítico.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Consulta Válida com Bairro Consolidado | `GET ?city_id=rio-de-janeiro&neighborhood_id=copacabana&state_id=RJ` | HTTP 200 com JSON completo ($P_{min}, P_{med}, P_{max}$, diária, taxa, `suggested_pricing`), headers `Cache-Control`, `is_consolidated: true` | N/A |
| Consulta em Bairro Novo (< 10 transações) | `GET ?city_id=rio-de-janeiro&neighborhood_id=bairro-novo` | HTTP 200 com fallback da cidade, `is_consolidated: false`, dados de referência | N/A |
| Ausência de Parâmetros Obrigatórios | `GET /api/v1/analytics/pricing-stats` (sem `city_id` ou `neighborhood_id`) | HTTP 400 Bad Request no formato RFC 7807 Problem Details | `application/problem+json` com detalhes dos campos faltantes |
| Método HTTP Não Permitido | `POST /api/v1/analytics/pricing-stats` | HTTP 405 Method Not Allowed no formato RFC 7807 Problem Details com header `Allow: GET, OPTIONS` | `application/problem+json` |
| Requisição Preflight CORS | `OPTIONS /api/v1/analytics/pricing-stats` | HTTP 204 No Content com headers `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, OPTIONS` | N/A |
| Consulta com Modal Específico | `GET ?city_id=sao-paulo&neighborhood_id=pinheiros&transport_modal=bicycle` | Retorna métricas calculadas especificamente para ciclistas | Se não houver amostra do modal, faz fallback para todos os modais |

</frozen-after-approval>

## Code Map

- `supabase/functions/pricing-stats/index.ts` -- Supabase Edge Function pública servindo o endpoint analítico com CORS, validação e cache HTTP.
- `apps/pwa/src/pricing/pricing-service.ts` -- Ampliação do `PricingService` com `handlePricingStatsRequest`, cálculo de valores sugeridos e headers RFC 7807.
- `apps/pwa/src/pricing/types.ts` -- Tipos para respostas de API (`PricingStatsApiResponse`, `RFC7807ProblemDetails`, `SuggestedPricing`).
- `packages/api-client-sdk/src/index.js` -- Inclusão do método `getPricingStats(params)` no SDK do cliente.
- `tests/pricing-endpoint-analytics.test.js` -- Suíte de testes automatizados com Node test runner validando latência, RFC 7807, CORS, cache headers e integração com SDK.

## Tasks & Acceptance

**Execution:**
- [x] `apps/pwa/src/pricing/types.ts` -- Adicionar interfaces para payload da API analítica, resposta sugerida e RFC 7807.
- [x] `apps/pwa/src/pricing/pricing-service.ts` -- Implementar `handlePricingStatsRequest`, formatação padronizada RFC 7807 e cálculo de preço sugerido de mercado.
- [x] `supabase/functions/pricing-stats/index.ts` -- Criar a Supabase Edge Function conectando o endpoint com roteamento e cabeçalhos HTTP.
- [x] `packages/api-client-sdk/src/index.js` -- Adicionar método `getPricingStats` no SDK universal.
- [x] `tests/pricing-endpoint-analytics.test.js` -- Implementar e rodar suíte de testes do endpoint analítico com 100% de aprovação.

**Acceptance Criteria:**
- Given uma requisição HTTP `GET /api/v1/analytics/pricing-stats` com parâmetros válidos, when a função responder, then deve retornar HTTP 200, métricas completas, cabeçalhos de cache HTTP e tempo de execução $< 100\text{ms}$.
- Given uma requisição sem parâmetros obrigatórios, when o endpoint validar a entrada, then deve responder HTTP 400 com RFC 7807 Problem Details.
- Given uma requisição com método não permitido (`POST`), when o endpoint receber o comando, then deve responder HTTP 405 com header `Allow: GET, OPTIONS`.
- Given o `DelivreryClient` do SDK, when invocar `getPricingStats(params)`, then deve retornar as métricas analíticas padronizadas.

## Verification

**Commands:**
- `npm test` -- expected: Todos os testes anteriores + novos testes da Story 3.2 passando com 100% de sucesso.
- `git status` -- expected: Branch `feat/story-3-2-pricing-analytics-endpoint` com código versionado.
