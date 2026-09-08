# Epic 5 Context: Plataforma Headless, Developer Portal e Webhooks de Integração

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Disponibilizar uma infraestrutura aberta e headless para que desenvolvedores terceiros (sistemas de PDV, cardápios digitais, portais municipais e plataformas parceiras) possam integrar-se nativamente ao deLIVREry. A plataforma provê emissão de API Keys com escopo geográfico delimitado, documentação interativa OpenAPI/Swagger, endpoints RESTful para gestão de entregas, notificações de eventos em tempo real via Webhooks assinados com HMAC-SHA256 e o componente web embutível `<delivrery-button />`.

## Stories

- **Story 5.1:** Schema de Clientes de API, Webhooks e Gateway de Validação
- **Story 5.2:** Endpoints RESTful Headless de Gestão de Vagas e Perfis (OpenAPI 3.0)
- **Story 5.3:** Dispatcher de Webhooks de Saída Assinados Criptograficamente (HMAC-SHA256)
- **Story 5.4:** Portal do Desenvolvedor (`/developers`) com Swagger UI Interativo
- **Story 5.5:** Web Component Embutível Nativo (`<delivrery-button />`) para Cardápios e PDVs

## Requirements & Constraints

- **FR-3 (Gestão de API Keys & Escopo Geográfico):** Emissão de credenciais (`client_id`, `api_key_hash`, `secret_token`) com restrição geográfica via array `allowed_cities`. Requisições sem chave válida retornam `401 Unauthorized`; acessos fora das cidades autorizadas (e diferente de `{"*"}`) retornam `403 Forbidden`.
- **FR-16 (Endpoints Headless RESTful):** Rotas padronizadas para cadastro (`POST /api/v1/couriers`, `POST /api/v1/stores`), listagem georreferenciada (`GET /api/v1/jobs?city_id=...`) e matching operacional (`POST /api/v1/bids/:id/accept`). Formato JSON conforme OpenAPI 3.0.
- **FR-17 (Webhooks Assinados HMAC-SHA256):** Notificações HTTP POST em tempo real para eventos `job.created`, `bid.submitted`, `job.accepted` e `job.completed`. Cabeçalhos obrigatórios: `X-Signature-SHA256`, `X-Delivery-Event` e `X-Delivery-Timestamp`. Retentativas automáticas (até 3 tentativas) com backoff exponencial para respostas 5xx ou falhas de rede (NFR-6, NFR-10).
- **FR-18 (Web Component Embutível `<delivrery-button />`):** Custom Elements v1 em JavaScript puro (Vanilla JS, sem dependências externas em runtime, NFR-4). Renderização rápida $< 50\text{ms}$ para inclusão em cardápios digitais e portais externos com acionamento de chamadas.
- **NFR-5 (Isolamento e RLS):** 100% das tabelas com Row Level Security (RLS) ativo.
- **NFR-7 (Rate Limiting por Tenant & RFC 7807):** PWA oficial (300 req / 10s burst), Parceiro Free (120 RPM, burst 30 req / 5s), Enterprise/Municipal (600 RPM, burst 100 req / 5s). Respostas de erro padronizadas no formato Problem Details RFC 7807 (`type`, `title`, `status`, `detail`).

## Technical Decisions

- **Modelo de Dados (Supabase / PostgreSQL):**
  - `api_clients`: `id`, `client_name`, `api_key_hash`, `owner_email`, `allowed_cities` (TEXT[] DEFAULT '{"*"}'), `rate_limit_rpm` (INT DEFAULT 120), `is_active`, `created_at`.
  - `webhooks_subscriptions`: `id`, `client_id` (FK `api_clients`), `target_url`, `event_type`, `secret_token`, `is_active`, `created_at`.
  - Associação de origem: campo `origin_client_id` nas tabelas `users` e `job_posts`.
- **Edge Functions e Gateway de Validação:**
  - Middleware/Gateway para interceptar `X-API-Key`, validar hash SHA-256 no banco e verificar cidade solicitada contra `allowed_cities`.
  - Dispatcher assíncrono acionado por eventos de banco para calcular assinatura HMAC-SHA256 e efetuar entrega HTTP com retentativas.
- **Portal do Desenvolvedor (`apps/developer-portal`):**
  - Aplicação Vite + React com Swagger UI em `/developers` consumindo especificação OpenAPI 3.0 centralizada e interface para geração/gestão de credenciais.
- **Widget Embutível (`packages/embed-widget`):**
  - Web Component `<delivrery-button>` independente e empacotado sem bibliotecas pesadas.

## Cross-Story Dependencies

- **Story 5.1** é o alicerce fundamental: cria as tabelas `api_clients` e `webhooks_subscriptions`, além do mecanismo de autenticação via API Key e verificação de escopo.
- **Story 5.2** depende do schema e gateway da **Story 5.1** para expor os endpoints protegidos e com controle de taxa.
- **Story 5.3** utiliza as assinaturas e subscriptions cadastradas na **Story 5.1** e os eventos disparados pelas vagas criadas no Epic 2 e Story 5.2.
- **Story 5.4** expõe visualmente as APIs da **Story 5.2** no Swagger UI e consome as funções da **Story 5.1** para emissão de chaves.
- **Story 5.5** interage com os endpoints da **Story 5.2** usando as credenciais emitidas no ecossistema da **Story 5.1/5.4**.
