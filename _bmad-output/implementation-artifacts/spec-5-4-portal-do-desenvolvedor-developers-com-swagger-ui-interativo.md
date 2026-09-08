---
title: 'Story 5.4: Portal do Desenvolvedor (/developers) com Swagger UI Interativo'
type: 'feature'
created: '2026-09-08'
status: 'done'
baseline_commit: 'e87bccfddfbcac3c79a7a4cf68edb37080418ff4'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Integradores terceiros (cardápios digitais, PDVs e portais municipais) não contam com uma interface centralizada e amigável para explorar a documentação OpenAPI 3.0, testar requisições em tempo real, gerar credenciais de API (`api_clients`) com restrição geográfica e configurar/testar subscrições de webhooks assinados.

**Approach:** Desenvolver o Portal do Desenvolvedor (`DeveloperPortal.tsx`) acessível na rota `/developers` e integrado ao ecossistema do deLIVREry (`apps/developer-portal` e PWA). O portal oferece: visualizador interativo OpenAPI/Swagger com console de teste ("Try It Out"), módulo de emissão e cópia segura de API Keys, gerenciador de webhooks com disparo de ping de teste simulado, exemplos de integração com o SDK e conformidade de acessibilidade/touch targets (NFR-9).

## Boundaries & Constraints

**Always:**
- A documentação de endpoints e esquemas deve ser alimentada dinamicamente pela especificação centralizada `openapi-spec.ts`.
- A emissão de chaves de API deve permitir delimitar escopo geográfico (`allowed_cities`), suportando acesso nacional `{"*"}` ou lista restrita de cidades, com taxa de 120 RPM (Free) ou 600 RPM (Enterprise).
- A chave de API em texto puro só deve ser exibida no momento da geração (com feedback de cópia), salvando no backend apenas o hash SHA-256 (`api_key_hash`).
- O módulo de webhooks deve permitir cadastrar URLs receptoras (`target_url`), selecionar tipos de evento canônicos (`job.created`, `bid.submitted`, `job.accepted`, `job.completed`) e disparar simulação de evento com assinatura HMAC-SHA256 (`X-Signature-SHA256`).
- Elementos interativos (botões, inputs, seletores de abas) devem respeitar alvos de toque mínimos de $48\text{px}$ com suporte a feedback tátil/haptic (NFR-9).
- Design deve seguir estética moderna e legível (dark theme voltado a desenvolvedores, tipografia mono para códigos e tokens, badges de método HTTP coloridos).

**Ask First:**
- Remoção ou alteração de rotas ou parâmetros da especificação OpenAPI já consolidada na Story 5.2.
- Adição de novos esquemas de autenticação além de `X-API-Key`.

**Never:**
- Nunca exibir nem persistir chaves de API em texto puro no banco de dados.
- Nunca permitir emissão de API Key sem nome do cliente ou e-mail de contato do responsável técnico.
- Nunca quebrar a navegação no PWA quando o usuário transitar entre a visão operacional e o portal de desenvolvedores.

## I/O & Edge-Case Matrix

| Cenário | Entrada / Ação do Usuário | Saída Esperada / Comportamento | Tratamento de Erro |
|---|---|---|---|
| Exploração de Endpoints OpenAPI | Acesso à aba "Documentação / Endpoints" | Renderização completa dos 4 endpoints `/api/v1/*` com métodos, tags, parâmetros, respostas e RFC 7807 | Exibe fallback descritivo caso especificação não carregue |
| Emissão de API Key Válida | Preenche nome, e-mail, seleciona cidades (`sao_paulo`) e clica em [Gerar Nova API Key] | Modal/Alerta exibe chave `dlv_live_...` com botão [Copiar], hash SHA-256 gravado e RPM configurado | N/A |
| Validação de Campos Obrigatórios | Submete formulário de credenciais com e-mail inválido ou nome vazio | Exibe mensagem de erro inline e bloqueia submissão | Alerta visual de validação |
| Teste de Endpoint (Try It Out) | Seleciona `GET /api/v1/jobs`, preenche `city_id: sao_paulo` e executa requisição de teste | Executa chamada via `HeadlessApiRouter` e exibe status HTTP, headers e body JSON formatado | Exibe RFC 7807 Problem Details em caso de 4xx/5xx |
| Teste de Webhook Simulado | Informa URL receptora, seleciona `job.created` e clica em [Disparar Webhook de Teste] | Executa disparo via `WebhookDispatcherService`, exibe resultado da entrega (status HTTP, latência, assinatura HMAC enviada) | Exibe erro e contagem de tentativas se endpoint falhar |
| Cópia com Haptic Feedback | Clique no botão [Copiar Chave] ou [Copiar Secret] | Texto transferido para clipboard com feedback tátil `navigator.vibrate([15])` e badge "Copiado!" | Fallback gracioso caso clipboard API não esteja disponível |

</frozen-after-approval>

## Code Map

- `apps/pwa/src/components/developers/DeveloperPortal.tsx` -- Componente principal do Portal do Desenvolvedor com abas: Documentação OpenAPI, Console de Testes (Try It Out), Emissão de API Keys e Simulador de Webhooks.
- `apps/pwa/src/components/developers/SwaggerDocsViewer.tsx` -- Visualizador interativo dos endpoints OpenAPI 3.0, parâmetros e esquemas RFC 7807.
- `apps/pwa/src/components/developers/ApiKeyGeneratorModal.tsx` -- Módulo para criação e emissão de credenciais de parceiros B2B com definição de `allowed_cities` e RPM.
- `apps/pwa/src/components/developers/WebhookTester.tsx` -- Simulador e cadastrador de subscrições com teste de entrega e verificação de assinatura HMAC.
- `apps/developer-portal/src/App.tsx` -- Ponto de entrada independente da aplicação de desenvolvedores.
- `apps/pwa/src/App.tsx` -- Integração de botão e rota/visão `/developers` no menu e cabeçalho do PWA.
- `tests/developer-portal.test.js` -- Suíte de testes automatizados cobrindo renderização, geração de chaves, execução de chamadas headless e simulação de webhooks.

## Tasks & Acceptance

**Execution:**
- [x] `apps/pwa/src/components/developers/SwaggerDocsViewer.tsx` -- Implementar visualizador OpenAPI 3.0 com tags, métodos, parâmetros, respostas e exemplos interativos.
- [x] `apps/pwa/src/components/developers/ApiKeyGeneratorModal.tsx` -- Implementar gerador de API Keys com seleção de escopo municipal (`allowed_cities`), limite de taxa (120/600 RPM) e feedback de cópia.
- [x] `apps/pwa/src/components/developers/WebhookTester.tsx` -- Implementar testador de webhooks com disparo de ping simulado via `WebhookDispatcherService` e inspeção de assinatura HMAC.
- [x] `apps/pwa/src/components/developers/DeveloperPortal.tsx` -- Consolidar os módulos em um portal com abas temáticas, estética para desenvolvedores e acessibilidade NFR-9 (alvos $\ge 48\text{px}$).
- [x] `apps/pwa/src/App.tsx` & `apps/developer-portal/src/App.tsx` -- Integrar portal à navegação do PWA e à aplicação dedicada em `apps/developer-portal`.
- [x] `tests/developer-portal.test.js` -- Criar suíte de testes cobrindo renderização de contratos, geração de chaves com escopo municipal, try-it-out e disparo simulado de webhooks.

**Acceptance Criteria:**
- Given um desenvolvedor navegando no portal, when selecionar a aba de documentação, then todos os endpoints `/api/v1/*` da especificação OpenAPI 3.0 devem ser apresentados de forma clara com parâmetros, headers e códigos de status.
- Given a criação de uma nova credencial B2B, when o formulário for preenchido com nome, e-mail e cidades autorizadas, then uma API Key única deve ser gerada, exibida ao usuário com opção de cópia e seu hash SHA-256 persistido.
- Given o teste de um webhook pelo parceiro, when o desenvolvedor disparar um ping de teste, then a requisição deve ser enviada com cabeçalho `X-Signature-SHA256` e o resultado da entrega (status code e latência) detalhado na tela.

## Spec Change Log

<!-- Append-only. Populated by step-04 during review loops. -->

## Design Notes

- **Paleta de Cores e Estilo Visual (Developer Experience):**
  - Fundo escuro elegante (`#0f172a`, slate-900) com cards em `#1e293b` (slate-800) e bordas sutis (`#334155`).
  - Badges de métodos HTTP padronizados:
    - `GET`: `#10b981` (verde esmeralda)
    - `POST`: `#3b82f6` (azul clássico)
    - `DELETE`: `#ef4444` (vermelho)
  - Fonte monospace para URLs de endpoints, JSONs de resposta e tokens (`ui-monospace`, `Courier New`).
- **Navegação em Abas:**
  - `docs`: Documentação OpenAPI e Console Interativo.
  - `keys`: Emissão e Gestão de Chaves de API.
  - `webhooks`: Cadastro e Simulador de Webhooks.
  - `sdk`: Guias de Instalação e Código Rápido com `@delivrery/api-client-sdk`.

## Verification

**Commands:**
- `npm test` -- expected: Todas as suítes passam, incluindo a nova `tests/developer-portal.test.js`.
- `node --experimental-strip-types --test tests/developer-portal.test.js` -- expected: 100% de aprovação nos testes da Story 5.4.
- `git status` -- expected: Árvore de trabalho íntegra.

**Manual checks (if no CLI):**
- Acessar o Portal do Desenvolvedor via rota `/developers` ou aba no PWA.
- Gerar uma chave com cidade `sao_paulo`, verificar que ela é copiada com sucesso e testar a chamada no console Try It Out.
- Disparar um webhook de teste para um mock server e checar headers recebidos.

## Suggested Review Order

**Portal Architecture & Central Hub**

- Ponto de entrada consolidado do Portal do Desenvolvedor com abas e controle de sessão
  [`DeveloperPortal.tsx:16`](../../apps/pwa/src/components/developers/DeveloperPortal.tsx#L16)

- Integração no PWA (rota `/developers` e botões de acesso rápido)
  [`App.tsx:142`](../../apps/pwa/src/App.tsx#L142)

**OpenAPI Interactive Documentation & Console**

- Visualizador interativo OpenAPI 3.0 com tags, parâmetros e console Try It Out
  [`SwaggerDocsViewer.tsx:10`](../../apps/pwa/src/components/developers/SwaggerDocsViewer.tsx#L10)

- Especificação canônica enriquecida com tags e schemas completos
  [`openapi-spec.ts:32`](../../apps/pwa/src/api/openapi/openapi-spec.ts#L32)

**Security & Webhook Simulators**

- Gerador de API Keys com seleção de escopo geográfico e feedback tátil de cópia
  [`ApiKeyGeneratorModal.tsx:15`](../../apps/pwa/src/components/developers/ApiKeyGeneratorModal.tsx#L15)

- Simulador de disparos de Webhook com auditoria de cabeçalho HMAC-SHA256
  [`WebhookTester.tsx:8`](../../apps/pwa/src/components/developers/WebhookTester.tsx#L8)

**Automated Tests & Quality Gate**

- Suíte de testes com cobertura completa para os requisitos da Story 5.4
  [`developer-portal.test.js:1`](../../tests/developer-portal.test.js#L1)

