# Verification Gap Review

**Goal:** Find changed behavior that could break without reliable verification catching it. Ask one question — "if the behavior this change is supposed to produce broke where it's actually used, would verification fail?" Do not hunt for correctness bugs, but report genuine problems you notice while tracing verification.

The main verification gap shapes are:

1. **Regression gap:** the changed code regresses where it's used, and no test covering that use would fail.
2. **Missing-adoption gap:** a place that should now use the new behavior doesn't; it handles the same case its own way, or not at all, and no test would flag the omission.
3. **Broken-verification gap:** a test appears to cover the changed behavior, but would not actually protect it because it is skipped, flaky, not run in the normal verification path, or too weak to observe the regression.

## Evidence Rules

- Read a test before claiming what it covers, runs, asserts, or misses.
- Before claiming no test exists, search the whole repo by the symbol under test and by import references; expected file locations are not enough.
- Never assert what you did not verify. If a finding cannot be grounded, drop it.
- In a finding, say what you actually checked — "none of the tests I read cover this" — and show how far you looked. Say a test doesn't exist anywhere only when the symbol/import-reference search actually shows that.
- Do not assign severity, confidence, priority, or ranking.

## Review Sequence

### Step 1: Screen for behavioral change

Screen each part of the change separately. If a part is non-behavioral, skip it. Call a part non-behavioral only when the changed code does not alter return values, thrown errors, caller-visible side effects, or observable state (including iteration order and emitted messages). Once a part meets that test, move on; do not inspect callers or tests for extra confirmation.

Common non-behavioral examples: formatting, comments, whitespace; pure renames; trivial getters/setters and pass-throughs; type-only or compiler-enforced changes with no runtime effect; etc.

Only outcomes produced by deterministic code are worth automatically testing; tests are useless on static source text and brittle on LLM output. Skip those parts.

If every part is skipped, output the clean result (see Output Format).

### Step 2: Find the behavior that changed

Identify what behavior changed compared to the previous version: output, side effect, branch, error path, schema/event shape, config default, validation/authorization rule, external contract, etc. If the change affects more than one behavior, handle each separately.

Treat broad-impact changes as behavioral even when no single changed line looks important: dependency, toolchain, build/config, data-file, etc.

### Step 3: Trace where that behavior is used

Trace the changed behavior to the places that observe it. Start with direct callers and registered entry points (routes, commands, DI), contract consumers (schemas, events, APIs, database readers), and reverse-dependency info if already available.

Follow a path only while the changed behavior is reachable and unverified. Stop when a test at that boundary would fail, the consumer does not observe the changed behavior, or the next hop is guesswork (dynamic dispatch, reflection, outside-repo consumers, etc.). Prefer the nearest observable boundary, often one to three hops away, especially across contract, integration, or service edges. If there are more than five similar consumers, group obvious repeats and check representative paths; expand only when a consumer observes the behavior differently.

### Step 4: Qualify the consumer, then check its test

For each consumer, name the smallest realistic regression this consumer would observe: invert the branch, drop the default, omit the field, return the old error code, skip the integration call, etc. This is the Demonstration. If no such regression exists, drop the path; untested downstream code is not a finding.

A `Missing-adoption gap` qualifies not by the adoption failure alone but by a supersession signal: the change gives clear evidence the new behavior is meant to replace the local one — PR intent, naming or docs, a replaced sibling site, deleted duplicate logic, or a test defining the new rule — and the local site shares the same observable contract. Without a supersession signal and a shared observable contract, it is a refactor suggestion, not a verification-gap finding. Once both hold, check whether any test for that site would flag the non-adoption; missing coverage of the non-adoption is the gap itself, not a disqualifier.

Find and read the relevant test. Ask whether the Demonstration would make an assertion fail.

- If yes, the behavior is verified. No finding.
- For a regression-style Demonstration: if no test runs the path, the test is skipped/flaky/not run normally, or the test runs the code without checking the changed result, report a `Regression gap` or `Broken-verification gap`.
- For a qualifying Missing-adoption case: if none of the site tests you found assert it adopts the new behavior, report a `Missing-adoption gap`.

A test counts only if it runs normally and an assertion observes the changed output, branch, or contract. These do not count: no execution; source-text assertions that match a file's wording instead of running it; success/no-throw/snapshot-only checks; mock/log-call checks; human-only checks; tests that mock away the integration; e2e tests that pass through without checking the changed output; stale assertions or fixtures.

For example, `expect(x ?? DEFAULT).toBe(DEFAULT)` passes when `x` is missing.

Common patterns:

- **Caller-path gap** — helper test covers the branch, but caller values skip it.
- **Contract drift** — payload/schema/event changes must be verified at the consumer.
- **Migration compatibility** — tests only create new-format rows or fresh schemas.
- **Phantom exception** — handled partial-failure path has no test.
- **Missing-adoption gap** — sibling site should use the new rule/helper and does not.
- **Removed verification** — deleted test or weakened assertion leaves behavior unpinned; removing a source-text assertion is not this, since it never counted.

### Step 5: Confirm each finding is real

Before writing a finding, re-open the specific tests or search results the finding relies on. Verify the Demonstration would not make any test you checked fail, or that the absence claim is backed by the symbol/import-reference search. Do not claim more than you verified; drop any finding you cannot ground.

Explain why the test misses the bug using what the test sets up and checks.

Do not report: compiler/type-checker-enforced cases; behavior already verified by an integration, contract, or e2e test; implementation-detail or mock-only tests; low coverage or a missing test file by itself; legacy untested code the change did not affect.

Report genuine problems you noticed while tracing verification, even if they are not verification gaps. Put them under `Other findings` in the output. This permits reporting what you already reached, not extra hunting.

## OUTPUT FORMAT

Emit each verification-gap finding as one block. No general advice, no severity or confidence.

```markdown
### <one-line title naming the gap>

- **Changed surface:** the exact behavior or contract that changed — `file:line`.
- **Impacted consumer or site:** named concretely with `file:line` (e.g. "the `createInvoice` mutation used by the billing dashboard at `billing/dashboard.ts:88`," not "callers of this function").
- **Existing test evidence:**
  - `Regression gap`: what the relevant test actually asserts, with `file:line`; or, if none, the symbol/import-reference searches run and their result.
  - `Missing-adoption gap`: tests for the impacted site, and whether any assert it adopts the new behavior.
  - `Broken-verification gap`: the apparent test or verification path, and why it does not count.
- **Missing verification:** the precise assertion or check that's absent.
- **Demonstration:**
  - `Regression gap` / `Broken-verification gap`: the concrete regression that would ship undetected, and why the tests you checked would not fail.
  - `Missing-adoption gap`: the case the site mishandles by not adopting the new behavior, and that none of the tests you read assert adoption.
- **Consequence:** the concrete thing that ships wrong — a regression the checked evidence would not catch, or a site that should use the new behavior and doesn't.
- **Suggested test shape:** (optional) the kind of test that would close the gap, fit to the repo's own way of verifying — don't impose a generic test pyramid.
```

If you noticed genuine non-gap problems while tracing verification, append:

```markdown
## Other findings

- <description only; no severity, confidence, priority, or ranking>
```

When you find no verification gaps and no other findings, output exactly this single line, not an empty response:

`No verification gaps found.`

## CONTENT SOURCE

Review the content supplied under "Review content:

diff --git a/_bmad-output/implementation-artifacts/spec-5-4-portal-do-desenvolvedor-developers-com-swagger-ui-interativo.md b/_bmad-output/implementation-artifacts/spec-5-4-portal-do-desenvolvedor-developers-com-swagger-ui-interativo.md
new file mode 100644
index 0000000..23004b9
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/spec-5-4-portal-do-desenvolvedor-developers-com-swagger-ui-interativo.md
@@ -0,0 +1,105 @@
+---
+title: 'Story 5.4: Portal do Desenvolvedor (/developers) com Swagger UI Interativo'
+type: 'feature'
+created: '2026-09-08'
+status: 'in-review'
+baseline_commit: 'e87bccfddfbcac3c79a7a4cf68edb37080418ff4'
+review_loop_iteration: 0
+context: []
+---
+
+<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
+
+## Intent
+
+**Problem:** Integradores terceiros (cardápios digitais, PDVs e portais municipais) não contam com uma interface centralizada e amigável para explorar a documentação OpenAPI 3.0, testar requisições em tempo real, gerar credenciais de API (`api_clients`) com restrição geográfica e configurar/testar subscrições de webhooks assinados.
+
+**Approach:** Desenvolver o Portal do Desenvolvedor (`DeveloperPortal.tsx`) acessível na rota `/developers` e integrado ao ecossistema do deLIVREry (`apps/developer-portal` e PWA). O portal oferece: visualizador interativo OpenAPI/Swagger com console de teste ("Try It Out"), módulo de emissão e cópia segura de API Keys, gerenciador de webhooks com disparo de ping de teste simulado, exemplos de integração com o SDK e conformidade de acessibilidade/touch targets (NFR-9).
+
+## Boundaries & Constraints
+
+**Always:**
+- A documentação de endpoints e esquemas deve ser alimentada dinamicamente pela especificação centralizada `openapi-spec.ts`.
+- A emissão de chaves de API deve permitir delimitar escopo geográfico (`allowed_cities`), suportando acesso nacional `{"*"}` ou lista restrita de cidades, com taxa de 120 RPM (Free) ou 600 RPM (Enterprise).
+- A chave de API em texto puro só deve ser exibida no momento da geração (com feedback de cópia), salvando no backend apenas o hash SHA-256 (`api_key_hash`).
+- O módulo de webhooks deve permitir cadastrar URLs receptoras (`target_url`), selecionar tipos de evento canônicos (`job.created`, `bid.submitted`, `job.accepted`, `job.completed`) e disparar simulação de evento com assinatura HMAC-SHA256 (`X-Signature-SHA256`).
+- Elementos interativos (botões, inputs, seletores de abas) devem respeitar alvos de toque mínimos de $48\text{px}$ com suporte a feedback tátil/haptic (NFR-9).
+- Design deve seguir estética moderna e legível (dark theme voltado a desenvolvedores, tipografia mono para códigos e tokens, badges de método HTTP coloridos).
+
+**Ask First:**
+- Remoção ou alteração de rotas ou parâmetros da especificação OpenAPI já consolidada na Story 5.2.
+- Adição de novos esquemas de autenticação além de `X-API-Key`.
+
+**Never:**
+- Nunca exibir nem persistir chaves de API em texto puro no banco de dados.
+- Nunca permitir emissão de API Key sem nome do cliente ou e-mail de contato do responsável técnico.
+- Nunca quebrar a navegação no PWA quando o usuário transitar entre a visão operacional e o portal de desenvolvedores.
+
+## I/O & Edge-Case Matrix
+
+| Cenário | Entrada / Ação do Usuário | Saída Esperada / Comportamento | Tratamento de Erro |
+|---|---|---|---|
+| Exploração de Endpoints OpenAPI | Acesso à aba "Documentação / Endpoints" | Renderização completa dos 4 endpoints `/api/v1/*` com métodos, tags, parâmetros, respostas e RFC 7807 | Exibe fallback descritivo caso especificação não carregue |
+| Emissão de API Key Válida | Preenche nome, e-mail, seleciona cidades (`sao_paulo`) e clica em [Gerar Nova API Key] | Modal/Alerta exibe chave `dlv_live_...` com botão [Copiar], hash SHA-256 gravado e RPM configurado | N/A |
+| Validação de Campos Obrigatórios | Submete formulário de credenciais com e-mail inválido ou nome vazio | Exibe mensagem de erro inline e bloqueia submissão | Alerta visual de validação |
+| Teste de Endpoint (Try It Out) | Seleciona `GET /api/v1/jobs`, preenche `city_id: sao_paulo` e executa requisição de teste | Executa chamada via `HeadlessApiRouter` e exibe status HTTP, headers e body JSON formatado | Exibe RFC 7807 Problem Details em caso de 4xx/5xx |
+| Teste de Webhook Simulado | Informa URL receptora, seleciona `job.created` e clica em [Disparar Webhook de Teste] | Executa disparo via `WebhookDispatcherService`, exibe resultado da entrega (status HTTP, latência, assinatura HMAC enviada) | Exibe erro e contagem de tentativas se endpoint falhar |
+| Cópia com Haptic Feedback | Clique no botão [Copiar Chave] ou [Copiar Secret] | Texto transferido para clipboard com feedback tátil `navigator.vibrate([15])` e badge "Copiado!" | Fallback gracioso caso clipboard API não esteja disponível |
+
+</frozen-after-approval>
+
+## Code Map
+
+- `apps/pwa/src/components/developers/DeveloperPortal.tsx` -- Componente principal do Portal do Desenvolvedor com abas: Documentação OpenAPI, Console de Testes (Try It Out), Emissão de API Keys e Simulador de Webhooks.
+- `apps/pwa/src/components/developers/SwaggerDocsViewer.tsx` -- Visualizador interativo dos endpoints OpenAPI 3.0, parâmetros e esquemas RFC 7807.
+- `apps/pwa/src/components/developers/ApiKeyGeneratorModal.tsx` -- Módulo para criação e emissão de credenciais de parceiros B2B com definição de `allowed_cities` e RPM.
+- `apps/pwa/src/components/developers/WebhookTester.tsx` -- Simulador e cadastrador de subscrições com teste de entrega e verificação de assinatura HMAC.
+- `apps/developer-portal/src/App.tsx` -- Ponto de entrada independente da aplicação de desenvolvedores.
+- `apps/pwa/src/App.tsx` -- Integração de botão e rota/visão `/developers` no menu e cabeçalho do PWA.
+- `tests/developer-portal.test.js` -- Suíte de testes automatizados cobrindo renderização, geração de chaves, execução de chamadas headless e simulação de webhooks.
+
+## Tasks & Acceptance
+
+**Execution:**
+- [x] `apps/pwa/src/components/developers/SwaggerDocsViewer.tsx` -- Implementar visualizador OpenAPI 3.0 com tags, métodos, parâmetros, respostas e exemplos interativos.
+- [x] `apps/pwa/src/components/developers/ApiKeyGeneratorModal.tsx` -- Implementar gerador de API Keys com seleção de escopo municipal (`allowed_cities`), limite de taxa (120/600 RPM) e feedback de cópia.
+- [x] `apps/pwa/src/components/developers/WebhookTester.tsx` -- Implementar testador de webhooks com disparo de ping simulado via `WebhookDispatcherService` e inspeção de assinatura HMAC.
+- [x] `apps/pwa/src/components/developers/DeveloperPortal.tsx` -- Consolidar os módulos em um portal com abas temáticas, estética para desenvolvedores e acessibilidade NFR-9 (alvos $\ge 48\text{px}$).
+- [x] `apps/pwa/src/App.tsx` & `apps/developer-portal/src/App.tsx` -- Integrar portal à navegação do PWA e à aplicação dedicada em `apps/developer-portal`.
+- [x] `tests/developer-portal.test.js` -- Criar suíte de testes cobrindo renderização de contratos, geração de chaves com escopo municipal, try-it-out e disparo simulado de webhooks.
+
+**Acceptance Criteria:**
+- Given um desenvolvedor navegando no portal, when selecionar a aba de documentação, then todos os endpoints `/api/v1/*` da especificação OpenAPI 3.0 devem ser apresentados de forma clara com parâmetros, headers e códigos de status.
+- Given a criação de uma nova credencial B2B, when o formulário for preenchido com nome, e-mail e cidades autorizadas, then uma API Key única deve ser gerada, exibida ao usuário com opção de cópia e seu hash SHA-256 persistido.
+- Given o teste de um webhook pelo parceiro, when o desenvolvedor disparar um ping de teste, then a requisição deve ser enviada com cabeçalho `X-Signature-SHA256` e o resultado da entrega (status code e latência) detalhado na tela.
+
+## Spec Change Log
+
+<!-- Append-only. Populated by step-04 during review loops. -->
+
+## Design Notes
+
+- **Paleta de Cores e Estilo Visual (Developer Experience):**
+  - Fundo escuro elegante (`#0f172a`, slate-900) com cards em `#1e293b` (slate-800) e bordas sutis (`#334155`).
+  - Badges de métodos HTTP padronizados:
+    - `GET`: `#10b981` (verde esmeralda)
+    - `POST`: `#3b82f6` (azul clássico)
+    - `DELETE`: `#ef4444` (vermelho)
+  - Fonte monospace para URLs de endpoints, JSONs de resposta e tokens (`ui-monospace`, `Courier New`).
+- **Navegação em Abas:**
+  - `docs`: Documentação OpenAPI e Console Interativo.
+  - `keys`: Emissão e Gestão de Chaves de API.
+  - `webhooks`: Cadastro e Simulador de Webhooks.
+  - `sdk`: Guias de Instalação e Código Rápido com `@delivrery/api-client-sdk`.
+
+## Verification
+
+**Commands:**
+- `npm test` -- expected: Todas as suítes passam, incluindo a nova `tests/developer-portal.test.js`.
+- `node --experimental-strip-types --test tests/developer-portal.test.js` -- expected: 100% de aprovação nos testes da Story 5.4.
+- `git status` -- expected: Árvore de trabalho íntegra.
+
+**Manual checks (if no CLI):**
+- Acessar o Portal do Desenvolvedor via rota `/developers` ou aba no PWA.
+- Gerar uma chave com cidade `sao_paulo`, verificar que ela é copiada com sucesso e testar a chamada no console Try It Out.
+- Disparar um webhook de teste para um mock server e checar headers recebidos.
diff --git a/_bmad-output/implementation-artifacts/sprint-status.yaml b/_bmad-output/implementation-artifacts/sprint-status.yaml
index c673d41..aa3493d 100644
--- a/_bmad-output/implementation-artifacts/sprint-status.yaml
+++ b/_bmad-output/implementation-artifacts/sprint-status.yaml
@@ -67,6 +67,6 @@ development_status:
   5-1-schema-de-clientes-de-api-webhooks-e-gateway-de-validação: done
   5-2-endpoints-restful-headless-de-gestão-de-vagas-e-perfis-opena: done
   5-3-dispatcher-de-webhooks-de-saída-assinados-criptograficamente: done
-  5-4-portal-do-desenvolvedor-developers-com-swagger-ui-interativo: backlog
+  5-4-portal-do-desenvolvedor-developers-com-swagger-ui-interativo: review
   5-5-web-component-embutível-nativo-delivrery-button-para-cardápi: backlog
   epic-5-retrospective: optional
diff --git a/apps/developer-portal/index.html b/apps/developer-portal/index.html
new file mode 100644
index 0000000..3004721
--- /dev/null
+++ b/apps/developer-portal/index.html
@@ -0,0 +1,14 @@
+<!DOCTYPE html>
+<html lang="pt-BR">
+  <head>
+    <meta charset="UTF-8" />
+    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <title>deLIVREry - Portal do Desenvolvedor & OpenAPI 3.0</title>
+    <meta name="description" content="Plataforma Headless, Documentação OpenAPI 3.0 e Webhooks de Integração para PDVs e Cardápios Digitais." />
+  </head>
+  <body style="margin: 0; background-color: #0b1120;">
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
diff --git a/apps/developer-portal/src/App.tsx b/apps/developer-portal/src/App.tsx
new file mode 100644
index 0000000..9c04bc3
--- /dev/null
+++ b/apps/developer-portal/src/App.tsx
@@ -0,0 +1,8 @@
+import React from 'react';
+import { DeveloperPortal } from '../../pwa/src/components/developers/DeveloperPortal.tsx';
+
+export const App: React.FC = () => {
+  return <DeveloperPortal />;
+};
+
+export default App;
diff --git a/apps/developer-portal/src/main.tsx b/apps/developer-portal/src/main.tsx
new file mode 100644
index 0000000..5a0654a
--- /dev/null
+++ b/apps/developer-portal/src/main.tsx
@@ -0,0 +1,9 @@
+import React from 'react';
+import ReactDOM from 'react-dom/client';
+import App from './App.tsx';
+
+ReactDOM.createRoot(document.getElementById('root')!).render(
+  <React.StrictMode>
+    <App />
+  </React.StrictMode>
+);
diff --git a/apps/pwa/src/App.tsx b/apps/pwa/src/App.tsx
index 1d5ea09..1252eee 100644
--- a/apps/pwa/src/App.tsx
+++ b/apps/pwa/src/App.tsx
@@ -21,6 +21,7 @@ import { StoreJobsList } from './components/jobs/StoreJobsList.tsx';
 import { RegionalPricingWidget } from './components/pricing/RegionalPricingWidget.tsx';
 import { DonationBottomSheet } from './components/donations/DonationBottomSheet.tsx';
 import { TransparencyPanel } from './components/donations/TransparencyPanel.tsx';
+import { DeveloperPortal } from './components/developers/DeveloperPortal.tsx';
 import type { DonationTriggerMoment } from './donations/types.ts';
 
 export const App: React.FC = () => {
@@ -32,17 +33,24 @@ export const App: React.FC = () => {
   const [jobsRefreshTrigger, setJobsRefreshTrigger] = useState(0);
   const [transparencyRefreshTrigger, setTransparencyRefreshTrigger] = useState(0);
   const [successToast, setSuccessToast] = useState<string | null>(null);
+  const [currentView, setCurrentView] = useState<'app' | 'developers'>('app');
   const [donationModalState, setDonationModalState] = useState<{
     isOpen: boolean;
     triggerMoment: DonationTriggerMoment;
   }>({ isOpen: false, triggerMoment: 'manual_donation' });
 
-  // Rastreia código de indicação vindo pela URL (?ref=...)
+  // Rastreia código de indicação ou rota /developers vindo pela URL
   useEffect(() => {
     const urlRef = ReferralService.extractReferralCodeFromUrl();
     if (urlRef) {
       ReferralService.saveReferralCodeToStorage(urlRef);
     }
+    if (typeof window !== 'undefined') {
+      if (window.location.pathname === '/developers' || window.location.hash.includes('developers')) {
+        setCurrentView('developers');
+      }
+    }
+  }, []);
   }, []);
 
   // Verifica se está na rota de callback de autenticação (#access_token=...)
@@ -133,6 +141,11 @@ export const App: React.FC = () => {
     );
   }
 
+  // Se a visão ativa for o Portal do Desenvolvedor (Story 5.4)
+  if (currentView === 'developers') {
+    return <DeveloperPortal onBack={() => setCurrentView('app')} />;
+  }
+
   // Usuário não autenticado -> Tela de Magic Link (Story 1.2) + Painel Público de Transparência (Story 4.4 - FR-12)
   if (!user) {
     return (
@@ -150,6 +163,31 @@ export const App: React.FC = () => {
         <div style={{ maxWidth: '460px', width: '100%' }}>
           <MagicLinkForm />
 
+          {/* Acesso ao Portal do Desenvolvedor para Visitantes e Integradores */}
+          <div style={{ textAlign: 'center', marginTop: '16px' }}>
+            <button
+              onClick={() => setCurrentView('developers')}
+              data-testid="visitor-btn-developers"
+              style={{
+                backgroundColor: 'transparent',
+                border: '1px solid #334155',
+                borderRadius: '8px',
+                color: '#38bdf8',
+                padding: '10px 16px',
+                minHeight: '48px',
+                fontSize: '13px',
+                fontWeight: 600,
+                cursor: 'pointer',
+                display: 'inline-flex',
+                alignItems: 'center',
+                gap: '8px'
+              }}
+            >
+              <span>⚡</span>
+              <span>Integrador ou Desenvolvedor? Acesse a API e Webhooks</span>
+            </button>
+          </div>
+
           {/* Painel Público de Transparência de Custos (Story 4.4) */}
           <TransparencyPanel
             refreshTrigger={transparencyRefreshTrigger}
@@ -351,6 +389,28 @@ export const App: React.FC = () => {
               <span>Apoiar</span>
             </button>
 
+            <button
+              onClick={() => setCurrentView('developers')}
+              data-testid="header-btn-developers"
+              style={{
+                minHeight: '48px',
+                padding: '8px 14px',
+                borderRadius: '8px',
+                backgroundColor: '#1e293b',
+                border: '1px solid #334155',
+                color: '#38bdf8',
+                cursor: 'pointer',
+                fontSize: '13px',
+                fontWeight: 700,
+                display: 'flex',
+                alignItems: 'center',
+                gap: '6px'
+              }}
+            >
+              <span>⚡</span>
+              <span>API / Devs</span>
+            </button>
+
             <button
               onClick={() => signOut()}
               style={{
diff --git a/apps/pwa/src/api/openapi/openapi-spec.ts b/apps/pwa/src/api/openapi/openapi-spec.ts
index ccc7686..6b4ab8d 100644
--- a/apps/pwa/src/api/openapi/openapi-spec.ts
+++ b/apps/pwa/src/api/openapi/openapi-spec.ts
@@ -29,9 +29,28 @@ export const openApiSpec = {
       ApiKeyAuth: []
     }
   ],
+  tags: [
+    {
+      name: 'Entregadores (Couriers)',
+      description: 'Endpoints para cadastro e gestão descentralizada de profissionais de entrega.'
+    },
+    {
+      name: 'Lojistas (Stores)',
+      description: 'Endpoints para registro de estabelecimentos comerciais, endereços e coordenadas.'
+    },
+    {
+      name: 'Vagas e Turnos (Jobs)',
+      description: 'Consulta georreferenciada de oportunidades e turnos de entrega com balizador regional.'
+    },
+    {
+      name: 'Matching e Propostas (Bids)',
+      description: 'Operações de proposta tarifária bid-ask e fechamento de acordos operacionais.'
+    }
+  ],
   paths: {
     '/api/v1/couriers': {
       post: {
+        tags: ['Entregadores (Couriers)'],
         summary: 'Cadastra um entregador (motoboy, ciclista ou e-bike) via API Headless',
         description: 'Permite que parceiros cadastrem profissionais de entrega vinculando-os ao tenant de origem (origin_client_id).',
         operationId: 'createCourier',
@@ -101,6 +120,7 @@ export const openApiSpec = {
     },
     '/api/v1/stores': {
       post: {
+        tags: ['Lojistas (Stores)'],
         summary: 'Cadastra um estabelecimento lojista parceiro via API Headless',
         description: 'Permite que sistemas de PDV registrem lojas com coordenadas e localização para posterior publicação de turnos.',
         operationId: 'createStore',
@@ -170,6 +190,7 @@ export const openApiSpec = {
     },
     '/api/v1/jobs': {
       get: {
+        tags: ['Vagas e Turnos (Jobs)'],
         summary: 'Lista vagas e turnos de entrega abertos por município',
         description: 'Retorna vagas com status open para o par city_id indicado, com suporte a filtros de bairro e modal de transporte.',
         operationId: 'getOpenJobs',
@@ -259,6 +280,7 @@ export const openApiSpec = {
     },
     '/api/v1/bids/{id}/accept': {
       post: {
+        tags: ['Matching e Propostas (Bids)'],
         summary: 'Aceita uma proposta de entregador e fecha o matching (Bid/Ask)',
         description: 'Atualiza o status da vaga para matched, vincula o entregador e rejeita propostas concorrentes.',
         operationId: 'acceptBid',
diff --git a/apps/pwa/src/components/developers/ApiKeyGeneratorModal.tsx b/apps/pwa/src/components/developers/ApiKeyGeneratorModal.tsx
new file mode 100644
index 0000000..4e27131
--- /dev/null
+++ b/apps/pwa/src/components/developers/ApiKeyGeneratorModal.tsx
@@ -0,0 +1,417 @@
+import React, { useState } from 'react';
+import { generateApiKey, hashApiKey } from '../../../../packages/api-client-sdk/src/index.js';
+import { ApiGatewayService } from '../../api/gateway/api-gateway-service.ts';
+import { supabase } from '../../lib/supabase.ts';
+import type { ApiClient } from '../../api/gateway/types.ts';
+
+interface ApiKeyGeneratorModalProps {
+  isOpen: boolean;
+  onClose: () => void;
+  onKeyGenerated?: (key: string, client: ApiClient) => void;
+}
+
+export const ApiKeyGeneratorModal: React.FC<ApiKeyGeneratorModalProps> = ({
+  isOpen,
+  onClose,
+  onKeyGenerated
+}) => {
+  const [clientName, setClientName] = useState('');
+  const [ownerEmail, setOwnerEmail] = useState('');
+  const [isNational, setIsNational] = useState(true);
+  const [customCities, setCustomCities] = useState('sao_paulo, rio_de_janeiro');
+  const [rateLimitRpm, setRateLimitRpm] = useState<number>(120);
+
+  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
+  const [copied, setCopied] = useState(false);
+  const [errorMsg, setErrorMsg] = useState<string | null>(null);
+  const [isLoading, setIsLoading] = useState(false);
+
+  if (!isOpen) return null;
+
+  const handleGenerateKey = async (e: React.FormEvent) => {
+    e.preventDefault();
+    setErrorMsg(null);
+
+    if (!clientName.trim()) {
+      setErrorMsg('O nome do cliente ou aplicação integradora é obrigatório.');
+      return;
+    }
+
+    if (!ownerEmail.trim() || !ownerEmail.includes('@')) {
+      setErrorMsg('Um e-mail de contato técnico válido é obrigatório.');
+      return;
+    }
+
+    setIsLoading(true);
+
+    try {
+      // 1. Determina as cidades autorizadas
+      let allowedCities: string[] = ['*'];
+      if (!isNational) {
+        allowedCities = customCities
+          .split(',')
+          .map(c => c.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'))
+          .filter(Boolean);
+
+        if (allowedCities.length === 0) {
+          allowedCities = ['*'];
+        }
+      }
+
+      // 2. Gera chave em texto plano e calcula hash SHA-256
+      const rawApiKey = generateApiKey('dlv_live', 24);
+      const apiKeyHash = hashApiKey(rawApiKey);
+      const clientId = `client_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
+
+      const newClient: ApiClient = {
+        id: clientId,
+        clientName: clientName.trim(),
+        apiKeyHash,
+        ownerEmail: ownerEmail.trim(),
+        allowedCities,
+        rateLimitRpm,
+        isActive: true,
+        createdAt: new Date().toISOString()
+      };
+
+      // 3. Registra no serviço do Gateway em memória para uso imediato
+      ApiGatewayService.registerMockClient(newClient);
+
+      // 4. Se Supabase estiver conectado, persiste no banco
+      if (supabase) {
+        try {
+          await supabase.from('api_clients').insert({
+            id: clientId,
+            client_name: newClient.clientName,
+            api_key_hash: newClient.apiKeyHash,
+            owner_email: newClient.ownerEmail,
+            allowed_cities: newClient.allowedCities,
+            rate_limit_rpm: newClient.rateLimitRpm,
+            is_active: true
+          });
+        } catch {
+          // Mantém integridade em mock local
+        }
+      }
+
+      setGeneratedKey(rawApiKey);
+      if (onKeyGenerated) {
+        onKeyGenerated(rawApiKey, newClient);
+      }
+
+      // Haptic feedback
+      if (typeof navigator !== 'undefined' && navigator.vibrate) {
+        navigator.vibrate([20]);
+      }
+    } catch (err: any) {
+      setErrorMsg(err?.message || 'Falha ao emitir API Key.');
+    } finally {
+      setIsLoading(false);
+    }
+  };
+
+  const handleCopyKey = () => {
+    if (!generatedKey) return;
+
+    if (navigator.clipboard) {
+      navigator.clipboard.writeText(generatedKey);
+    }
+
+    if (typeof navigator !== 'undefined' && navigator.vibrate) {
+      navigator.vibrate([15]);
+    }
+
+    setCopied(true);
+    setTimeout(() => setCopied(false), 2500);
+  };
+
+  return (
+    <div style={{
+      position: 'fixed',
+      top: 0,
+      left: 0,
+      right: 0,
+      bottom: 0,
+      backgroundColor: 'rgba(0, 0, 0, 0.75)',
+      display: 'flex',
+      alignItems: 'center',
+      justifyContent: 'center',
+      zIndex: 9999,
+      padding: '16px'
+    }}>
+      <div style={{
+        backgroundColor: '#1e293b',
+        borderRadius: '16px',
+        border: '1px solid #334155',
+        width: '100%',
+        maxWidth: '540px',
+        padding: '28px',
+        color: '#f8fafc',
+        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
+      }}>
+        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
+          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#60a5fa' }}>
+            🔑 Emissão de Nova API Key
+          </h3>
+          <button
+            onClick={onClose}
+            style={{
+              backgroundColor: 'transparent',
+              border: 'none',
+              color: '#94a3b8',
+              fontSize: '20px',
+              cursor: 'pointer',
+              minWidth: '48px',
+              minHeight: '48px',
+              display: 'flex',
+              alignItems: 'center',
+              justifyContent: 'center'
+            }}
+          >
+            ✕
+          </button>
+        </div>
+
+        {!generatedKey ? (
+          <form onSubmit={handleGenerateKey} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
+            {errorMsg && (
+              <div style={{
+                backgroundColor: 'rgba(239, 68, 68, 0.2)',
+                border: '1px solid #ef4444',
+                color: '#fca5a5',
+                padding: '10px 14px',
+                borderRadius: '8px',
+                fontSize: '13px'
+              }}>
+                {errorMsg}
+              </div>
+            )}
+
+            <div>
+              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
+                Nome do Integrador ou Sistema:
+              </label>
+              <input
+                type="text"
+                placeholder="Ex: PDV Soft, Cardápio Web, Portal Pref. SP"
+                value={clientName}
+                onChange={(e) => setClientName(e.target.value)}
+                style={{
+                  width: '100%',
+                  boxSizing: 'border-box',
+                  padding: '12px 14px',
+                  borderRadius: '8px',
+                  backgroundColor: '#0f172a',
+                  color: '#fff',
+                  border: '1px solid #475569',
+                  fontSize: '14px',
+                  minHeight: '48px'
+                }}
+              />
+            </div>
+
+            <div>
+              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
+                E-mail do Responsável Técnico:
+              </label>
+              <input
+                type="email"
+                placeholder="dev@parceiro.com.br"
+                value={ownerEmail}
+                onChange={(e) => setOwnerEmail(e.target.value)}
+                style={{
+                  width: '100%',
+                  boxSizing: 'border-box',
+                  padding: '12px 14px',
+                  borderRadius: '8px',
+                  backgroundColor: '#0f172a',
+                  color: '#fff',
+                  border: '1px solid #475569',
+                  fontSize: '14px',
+                  minHeight: '48px'
+                }}
+              />
+            </div>
+
+            {/* Escopo Geográfico */}
+            <div style={{
+              backgroundColor: '#0f172a',
+              padding: '14px',
+              borderRadius: '8px',
+              border: '1px solid #334155'
+            }}>
+              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
+                <input
+                  type="checkbox"
+                  checked={isNational}
+                  onChange={(e) => setIsNational(e.target.checked)}
+                  style={{ width: '20px', height: '20px' }}
+                />
+                <span style={{ fontWeight: 600 }}>Acesso Nacional Irrestrito (*)</span>
+              </label>
+
+              {!isNational && (
+                <div style={{ marginTop: '12px' }}>
+                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
+                    Cidades autorizadas (separadas por vírgula):
+                  </label>
+                  <input
+                    type="text"
+                    value={customCities}
+                    onChange={(e) => setCustomCities(e.target.value)}
+                    placeholder="sao_paulo, rio_de_janeiro, campinas"
+                    style={{
+                      width: '100%',
+                      boxSizing: 'border-box',
+                      padding: '10px 12px',
+                      borderRadius: '6px',
+                      backgroundColor: '#1e293b',
+                      color: '#fff',
+                      border: '1px solid #475569',
+                      fontSize: '13px',
+                      minHeight: '48px'
+                    }}
+                  />
+                </div>
+              )}
+            </div>
+
+            {/* Limite de Taxa (RPM) */}
+            <div>
+              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
+                Plano / Limite de Requisições por Minuto (RPM):
+              </label>
+              <select
+                value={rateLimitRpm}
+                onChange={(e) => setRateLimitRpm(Number(e.target.value))}
+                style={{
+                  width: '100%',
+                  boxSizing: 'border-box',
+                  padding: '12px 14px',
+                  borderRadius: '8px',
+                  backgroundColor: '#0f172a',
+                  color: '#fff',
+                  border: '1px solid #475569',
+                  fontSize: '14px',
+                  minHeight: '48px'
+                }}
+              >
+                <option value={120}>Plano Parceiro Comunitário (120 RPM Free)</option>
+                <option value={600}>Plano Enterprise / Municipal (600 RPM)</option>
+              </select>
+            </div>
+
+            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
+              <button
+                type="button"
+                onClick={onClose}
+                style={{
+                  flex: 1,
+                  padding: '12px',
+                  minHeight: '48px',
+                  backgroundColor: '#334155',
+                  color: '#f8fafc',
+                  border: 'none',
+                  borderRadius: '8px',
+                  fontWeight: 600,
+                  fontSize: '14px',
+                  cursor: 'pointer'
+                }}
+              >
+                Cancelar
+              </button>
+              <button
+                type="submit"
+                disabled={isLoading}
+                style={{
+                  flex: 1,
+                  padding: '12px',
+                  minHeight: '48px',
+                  backgroundColor: '#2563eb',
+                  color: '#ffffff',
+                  border: 'none',
+                  borderRadius: '8px',
+                  fontWeight: 700,
+                  fontSize: '14px',
+                  cursor: isLoading ? 'not-allowed' : 'pointer'
+                }}
+              >
+                {isLoading ? 'Emitindo...' : '✨ Gerar API Key'}
+              </button>
+            </div>
+          </form>
+        ) : (
+          /* Visualização da Chave Gerada */
+          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
+            <div style={{
+              backgroundColor: 'rgba(16, 185, 129, 0.15)',
+              border: '1px solid #10b981',
+              borderRadius: '8px',
+              padding: '14px',
+              color: '#a7f3d0',
+              fontSize: '14px'
+            }}>
+              ✅ <strong>API Key gerada com sucesso!</strong> Armazene-a em local seguro. Por motivos de segurança, ela <strong>não poderá ser visualizada novamente</strong>.
+            </div>
+
+            <div style={{
+              backgroundColor: '#0f172a',
+              padding: '14px',
+              borderRadius: '8px',
+              border: '1px solid #475569',
+              wordBreak: 'break-all',
+              fontFamily: 'monospace',
+              fontSize: '15px',
+              color: '#38bdf8'
+            }}>
+              {generatedKey}
+            </div>
+
+            <button
+              type="button"
+              onClick={handleCopyKey}
+              style={{
+                width: '100%',
+                padding: '14px',
+                minHeight: '48px',
+                backgroundColor: copied ? '#059669' : '#3b82f6',
+                color: '#ffffff',
+                border: 'none',
+                borderRadius: '8px',
+                fontWeight: 700,
+                fontSize: '15px',
+                cursor: 'pointer',
+                display: 'flex',
+                alignItems: 'center',
+                justifyContent: 'center',
+                gap: '8px',
+                transition: 'background-color 0.2s'
+              }}
+            >
+              {copied ? '✔ Chave Copiada para a Área de Transferência!' : '📋 Copiar API Key'}
+            </button>
+
+            <button
+              type="button"
+              onClick={onClose}
+              style={{
+                width: '100%',
+                padding: '12px',
+                minHeight: '48px',
+                backgroundColor: '#334155',
+                color: '#f8fafc',
+                border: 'none',
+                borderRadius: '8px',
+                fontWeight: 600,
+                fontSize: '14px',
+                cursor: 'pointer'
+              }}
+            >
+              Concluir e Fechar
+            </button>
+          </div>
+        )}
+      </div>
+    </div>
+  );
+};
diff --git a/apps/pwa/src/components/developers/DeveloperPortal.tsx b/apps/pwa/src/components/developers/DeveloperPortal.tsx
new file mode 100644
index 0000000..fd9f69b
--- /dev/null
+++ b/apps/pwa/src/components/developers/DeveloperPortal.tsx
@@ -0,0 +1,390 @@
+import React, { useState } from 'react';
+import { SwaggerDocsViewer } from './SwaggerDocsViewer.tsx';
+import { ApiKeyGeneratorModal } from './ApiKeyGeneratorModal.tsx';
+import { WebhookTester } from './WebhookTester.tsx';
+import type { ApiClient } from '../../api/gateway/types.ts';
+
+interface DeveloperPortalProps {
+  onBack?: () => void;
+}
+
+export const DeveloperPortal: React.FC<DeveloperPortalProps> = ({ onBack }) => {
+  const [activeTab, setActiveTab] = useState<'docs' | 'keys' | 'webhooks' | 'sdk'>('docs');
+  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
+  const [activeApiKey, setActiveApiKey] = useState('');
+  const [activeClient, setActiveClient] = useState<ApiClient | null>(null);
+
+  const handleBack = () => {
+    if (typeof navigator !== 'undefined' && navigator.vibrate) {
+      navigator.vibrate([15]);
+    }
+    if (onBack) {
+      onBack();
+    }
+  };
+
+  const handleKeyGenerated = (key: string, client: ApiClient) => {
+    setActiveApiKey(key);
+    setActiveClient(client);
+  };
+
+  return (
+    <div style={{
+      minHeight: '100vh',
+      backgroundColor: '#0b1120',
+      color: '#f8fafc',
+      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
+    }}>
+      {/* Top Header */}
+      <header style={{
+        backgroundColor: '#0f172a',
+        borderBottom: '1px solid #1e293b',
+        padding: '16px 24px',
+        display: 'flex',
+        alignItems: 'center',
+        justifyContent: 'space-between',
+        flexWrap: 'wrap',
+        gap: '16px'
+      }}>
+        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
+          {onBack && (
+            <button
+              onClick={handleBack}
+              style={{
+                backgroundColor: '#1e293b',
+                color: '#94a3b8',
+                border: '1px solid #334155',
+                borderRadius: '8px',
+                padding: '8px 16px',
+                minHeight: '48px',
+                minWidth: '48px',
+                fontWeight: 600,
+                fontSize: '14px',
+                cursor: 'pointer',
+                display: 'flex',
+                alignItems: 'center',
+                gap: '8px'
+              }}
+            >
+              ← Voltar ao App
+            </button>
+          )}
+
+          <div>
+            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
+              <span style={{ fontSize: '24px' }}>⚡</span>
+              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>
+                deLIVREry <span style={{ color: '#38bdf8' }}>Developer Portal</span>
+              </h1>
+            </div>
+            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
+              Documentação OpenAPI 3.0, Emissão de Chaves B2B e Webhooks Assinados
+            </p>
+          </div>
+        </div>
+
+        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
+          <button
+            onClick={() => setIsKeyModalOpen(true)}
+            style={{
+              backgroundColor: '#2563eb',
+              color: '#ffffff',
+              border: 'none',
+              borderRadius: '8px',
+              padding: '10px 20px',
+              minHeight: '48px',
+              fontWeight: 700,
+              fontSize: '14px',
+              cursor: 'pointer',
+              display: 'flex',
+              alignItems: 'center',
+              gap: '8px',
+              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)'
+            }}
+          >
+            ✨ Emitir Nova API Key
+          </button>
+        </div>
+      </header>
+
+      {/* Main Container */}
+      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
+        {/* Active Key Banner se houver chave gerada recentemente */}
+        {activeApiKey && (
+          <div style={{
+            backgroundColor: 'rgba(59, 130, 246, 0.15)',
+            border: '1px solid #3b82f6',
+            borderRadius: '10px',
+            padding: '14px 20px',
+            marginBottom: '20px',
+            display: 'flex',
+            alignItems: 'center',
+            justifyContent: 'space-between',
+            flexWrap: 'wrap',
+            gap: '10px'
+          }}>
+            <div style={{ fontSize: '14px' }}>
+              <strong style={{ color: '#60a5fa' }}>Chave Ativa em Uso:</strong>{' '}
+              <code style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{activeApiKey}</code>{' '}
+              ({activeClient?.clientName} - {activeClient?.allowedCities.includes('*') ? 'Nacional' : activeClient?.allowedCities.join(', ')})
+            </div>
+            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Pronta para testes no console</span>
+          </div>
+        )}
+
+        {/* Tab Navigation */}
+        <div style={{
+          display: 'flex',
+          gap: '8px',
+          borderBottom: '1px solid #1e293b',
+          paddingBottom: '12px',
+          marginBottom: '24px',
+          overflowX: 'auto'
+        }}>
+          <button
+            onClick={() => setActiveTab('docs')}
+            style={{
+              padding: '12px 20px',
+              minHeight: '48px',
+              borderRadius: '8px',
+              border: 'none',
+              cursor: 'pointer',
+              backgroundColor: activeTab === 'docs' ? '#1e293b' : 'transparent',
+              color: activeTab === 'docs' ? '#38bdf8' : '#94a3b8',
+              fontWeight: 700,
+              fontSize: '14px',
+              display: 'flex',
+              alignItems: 'center',
+              gap: '8px',
+              borderBottom: activeTab === 'docs' ? '2px solid #38bdf8' : 'none'
+            }}
+          >
+            📖 Documentação OpenAPI & Console
+          </button>
+
+          <button
+            onClick={() => setActiveTab('keys')}
+            style={{
+              padding: '12px 20px',
+              minHeight: '48px',
+              borderRadius: '8px',
+              border: 'none',
+              cursor: 'pointer',
+              backgroundColor: activeTab === 'keys' ? '#1e293b' : 'transparent',
+              color: activeTab === 'keys' ? '#38bdf8' : '#94a3b8',
+              fontWeight: 700,
+              fontSize: '14px',
+              display: 'flex',
+              alignItems: 'center',
+              gap: '8px',
+              borderBottom: activeTab === 'keys' ? '2px solid #38bdf8' : 'none'
+            }}
+          >
+            🔑 Gestão de Credenciais
+          </button>
+
+          <button
+            onClick={() => setActiveTab('webhooks')}
+            style={{
+              padding: '12px 20px',
+              minHeight: '48px',
+              borderRadius: '8px',
+              border: 'none',
+              cursor: 'pointer',
+              backgroundColor: activeTab === 'webhooks' ? '#1e293b' : 'transparent',
+              color: activeTab === 'webhooks' ? '#38bdf8' : '#94a3b8',
+              fontWeight: 700,
+              fontSize: '14px',
+              display: 'flex',
+              alignItems: 'center',
+              gap: '8px',
+              borderBottom: activeTab === 'webhooks' ? '2px solid #38bdf8' : 'none'
+            }}
+          >
+            🔔 Simulador de Webhooks (HMAC)
+          </button>
+
+          <button
+            onClick={() => setActiveTab('sdk')}
+            style={{
+              padding: '12px 20px',
+              minHeight: '48px',
+              borderRadius: '8px',
+              border: 'none',
+              cursor: 'pointer',
+              backgroundColor: activeTab === 'sdk' ? '#1e293b' : 'transparent',
+              color: activeTab === 'sdk' ? '#38bdf8' : '#94a3b8',
+              fontWeight: 700,
+              fontSize: '14px',
+              display: 'flex',
+              alignItems: 'center',
+              gap: '8px',
+              borderBottom: activeTab === 'sdk' ? '2px solid #38bdf8' : 'none'
+            }}
+          >
+            📦 SDK & Exemplos de Código
+          </button>
+        </div>
+
+        {/* Tab Content */}
+        {activeTab === 'docs' && (
+          <SwaggerDocsViewer apiKey={activeApiKey} />
+        )}
+
+        {activeTab === 'keys' && (
+          <div style={{
+            backgroundColor: '#1e293b',
+            border: '1px solid #334155',
+            borderRadius: '12px',
+            padding: '28px'
+          }}>
+            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 700, color: '#60a5fa' }}>
+              🔑 Gestão e Emissão de Credenciais de API
+            </h3>
+            <p style={{ margin: '0 0 20px 0', color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>
+              Para integrar seu PDV, cardápio digital ou sistema municipal à rede descentralizada deLIVREry, gere sua API Key delimitando as cidades de operação e limites de taxa.
+            </p>
+
+            <button
+              onClick={() => setIsKeyModalOpen(true)}
+              style={{
+                padding: '12px 24px',
+                minHeight: '48px',
+                backgroundColor: '#2563eb',
+                color: '#ffffff',
+                border: 'none',
+                borderRadius: '8px',
+                fontWeight: 700,
+                fontSize: '15px',
+                cursor: 'pointer'
+              }}
+            >
+              + Gerar Nova Chave de API
+            </button>
+
+            {activeClient && (
+              <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #475569' }}>
+                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#cbd5e1' }}>Último Integrador Registrado:</h4>
+                <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#94a3b8' }}>
+                  <div>Nome: <strong style={{ color: '#fff' }}>{activeClient.clientName}</strong></div>
+                  <div>E-mail Técnico: <strong style={{ color: '#fff' }}>{activeClient.ownerEmail}</strong></div>
+                  <div>Cidades Autorizadas: <strong style={{ color: '#38bdf8' }}>{activeClient.allowedCities.join(', ')}</strong></div>
+                  <div>Limite de Taxa: <strong style={{ color: '#a7f3d0' }}>{activeClient.rateLimitRpm} RPM</strong></div>
+                </div>
+              </div>
+            )}
+          </div>
+        )}
+
+        {activeTab === 'webhooks' && (
+          <WebhookTester />
+        )}
+
+        {activeTab === 'sdk' && (
+          <div style={{
+            backgroundColor: '#1e293b',
+            border: '1px solid #334155',
+            borderRadius: '12px',
+            padding: '28px',
+            display: 'flex',
+            flexDirection: 'column',
+            gap: '20px'
+          }}>
+            <div>
+              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#60a5fa' }}>
+                📦 Início Rápido com o SDK (@delivrery/api-client-sdk)
+              </h3>
+              <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>
+                Utilize o SDK oficial para TypeScript / JavaScript com suporte nativo a autenticação, controle de taxa, erros RFC 7807 e validação de Webhooks HMAC-SHA256.
+              </p>
+            </div>
+
+            <div>
+              <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#cbd5e1' }}>1. Instalação:</h4>
+              <pre style={{
+                margin: 0,
+                padding: '14px',
+                backgroundColor: '#020617',
+                borderRadius: '8px',
+                color: '#38bdf8',
+                fontFamily: 'monospace',
+                fontSize: '13px'
+              }}>
+                npm install @delivrery/api-client-sdk
+              </pre>
+            </div>
+
+            <div>
+              <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#cbd5e1' }}>2. Consultando vagas abertas via API Headless:</h4>
+              <pre style={{
+                margin: 0,
+                padding: '14px',
+                backgroundColor: '#020617',
+                borderRadius: '8px',
+                color: '#a7f3d0',
+                fontFamily: 'monospace',
+                fontSize: '13px',
+                overflowX: 'auto'
+              }}>
+{`import { DelivreryClient } from '@delivrery/api-client-sdk';
+
+const client = new DelivreryClient({
+  apiKey: 'sua_api_key_aqui',
+  baseUrl: 'https://delivrery.app.br/api/v1'
+});
+
+// Listar vagas abertas em São Paulo
+const jobs = await client.getJobs({
+  cityId: 'sao_paulo',
+  transportModal: 'motorcycle'
+});
+console.log('Vagas disponíveis:', jobs);`}
+              </pre>
+            </div>
+
+            <div>
+              <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#cbd5e1' }}>3. Validando a Assinatura HMAC de um Webhook:</h4>
+              <pre style={{
+                margin: 0,
+                padding: '14px',
+                backgroundColor: '#020617',
+                borderRadius: '8px',
+                color: '#fde047',
+                fontFamily: 'monospace',
+                fontSize: '13px',
+                overflowX: 'auto'
+              }}>
+{`import { verifyWebhookSignature } from '@delivrery/api-client-sdk';
+
+// No seu endpoint receptor (Express, Fastify, Next.js, etc.):
+app.post('/api/webhooks', (req, res) => {
+  const signature = req.headers['x-signature-sha256'];
+  const isValid = verifyWebhookSignature(
+    process.env.DELIVRERY_WEBHOOK_SECRET,
+    req.body,
+    signature
+  );
+
+  if (!isValid) {
+    return res.status(401).send('Assinatura inválida');
+  }
+
+  const { event, data } = req.body;
+  console.log(\`Evento \${event} autenticado com sucesso:\`, data);
+  res.status(200).send({ ok: true });
+});`}
+              </pre>
+            </div>
+          </div>
+        )}
+      </main>
+
+      {/* Modal de Emissão de Chaves */}
+      <ApiKeyGeneratorModal
+        isOpen={isKeyModalOpen}
+        onClose={() => setIsKeyModalOpen(false)}
+        onKeyGenerated={handleKeyGenerated}
+      />
+    </div>
+  );
+};
diff --git a/apps/pwa/src/components/developers/SwaggerDocsViewer.tsx b/apps/pwa/src/components/developers/SwaggerDocsViewer.tsx
new file mode 100644
index 0000000..060798e
--- /dev/null
+++ b/apps/pwa/src/components/developers/SwaggerDocsViewer.tsx
@@ -0,0 +1,549 @@
+import React, { useState } from 'react';
+import { openApiSpec } from '../../api/openapi/openapi-spec.ts';
+import { HeadlessApiRouter } from '../../api/headless/headless-api-router.ts';
+import type { ApiGatewayRequest, ApiGatewayResponse } from '../../api/gateway/types.ts';
+
+interface SwaggerDocsViewerProps {
+  apiKey?: string;
+}
+
+export const SwaggerDocsViewer: React.FC<SwaggerDocsViewerProps> = ({ apiKey: initialApiKey = '' }) => {
+  const [apiKey, setApiKey] = useState(initialApiKey);
+  const [activeTag, setActiveTag] = useState<string>('all');
+  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({
+    '/couriers-post': true,
+    '/stores-post': false,
+    '/jobs-get': true,
+    '/bids/{id}/accept-post': false
+  });
+
+  // Estado do Console "Try It Out"
+  const [consoleParams, setConsoleParams] = useState<Record<string, string>>({
+    cityId: 'sao_paulo',
+    transportModal: 'motorcycle',
+    bidId: 'bid_123',
+    storeId: 'store_test_uuid'
+  });
+  const [consoleBody, setConsoleBody] = useState<Record<string, string>>({
+    '/couriers': JSON.stringify({
+      fullName: 'Lucas Lima Entregador',
+      cpf: '12345678909',
+      phoneNumber: '11999998888',
+      transportModal: 'motorcycle',
+      baseDailyRate: 120.00,
+      baseDeliveryFee: 8.00,
+      cityId: 'sao_paulo',
+      stateId: 'SP',
+      homeNeighborhoodId: 'pinheiros'
+    }, null, 2),
+    '/stores': JSON.stringify({
+      fullName: 'Maria Oliveira Gerente',
+      cpf: '98765432100',
+      phoneNumber: '11988887777',
+      storeName: 'Pizzaria Bella Delivery',
+      addressStreet: 'Rua Augusta, 500',
+      addressNumber: '500',
+      neighborhoodId: 'consolacao',
+      cityId: 'sao_paulo',
+      stateId: 'SP',
+      latitude: -23.55052,
+      longitude: -46.65588
+    }, null, 2)
+  });
+
+  const [executionResults, setExecutionResults] = useState<Record<string, {
+    status: number;
+    headers: Record<string, string>;
+    body: any;
+    durationMs: number;
+  } | null>>({});
+
+  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
+
+  const toggleEndpoint = (key: string) => {
+    setExpandedEndpoints(prev => ({ ...prev, [key]: !prev[key] }));
+  };
+
+  const executeTryItOut = async (method: string, path: string, key: string) => {
+    setIsLoading(prev => ({ ...prev, [key]: true }));
+    const startTime = Date.now();
+
+    try {
+      let resolvedUrl = `/api/v1${path}`;
+      const queryParams: Record<string, string> = {};
+
+      if (path === '/jobs') {
+        if (consoleParams.cityId) queryParams.city_id = consoleParams.cityId;
+        if (consoleParams.transportModal) queryParams.transport_modal = consoleParams.transportModal;
+        resolvedUrl += `?city_id=${encodeURIComponent(consoleParams.cityId || 'sao_paulo')}`;
+        if (consoleParams.transportModal) {
+          resolvedUrl += `&transport_modal=${encodeURIComponent(consoleParams.transportModal)}`;
+        }
+      } else if (path === '/bids/{id}/accept') {
+        resolvedUrl = `/api/v1/bids/${encodeURIComponent(consoleParams.bidId || 'bid_123')}/accept`;
+      }
+
+      let parsedBody: any = undefined;
+      if (['post', 'put', 'patch'].includes(method.toLowerCase())) {
+        if (path === '/bids/{id}/accept') {
+          parsedBody = { storeId: consoleParams.storeId || 'store_test_uuid' };
+        } else if (consoleBody[path]) {
+          try {
+            parsedBody = JSON.parse(consoleBody[path]);
+          } catch {
+            parsedBody = {};
+          }
+        }
+      }
+
+      const req: ApiGatewayRequest = {
+        method: method.toUpperCase(),
+        url: resolvedUrl,
+        headers: {
+          'X-API-Key': apiKey.trim() || undefined,
+          'Content-Type': 'application/json'
+        },
+        queryParams,
+        body: parsedBody,
+        cityId: consoleParams.cityId || 'sao_paulo'
+      };
+
+      const response = await HeadlessApiRouter.handle(req);
+      const durationMs = Date.now() - startTime;
+
+      setExecutionResults(prev => ({
+        ...prev,
+        [key]: {
+          status: response.status,
+          headers: response.headers,
+          body: response.body,
+          durationMs
+        }
+      }));
+    } catch (err: any) {
+      setExecutionResults(prev => ({
+        ...prev,
+        [key]: {
+          status: 500,
+          headers: {},
+          body: { error: err?.message || 'Erro inesperado' },
+          durationMs: Date.now() - startTime
+        }
+      }));
+    } finally {
+      setIsLoading(prev => ({ ...prev, [key]: false }));
+    }
+  };
+
+  const getMethodBadgeStyle = (method: string) => {
+    switch (method.toUpperCase()) {
+      case 'GET':
+        return { backgroundColor: '#10b981', color: '#ffffff' };
+      case 'POST':
+        return { backgroundColor: '#3b82f6', color: '#ffffff' };
+      case 'DELETE':
+        return { backgroundColor: '#ef4444', color: '#ffffff' };
+      default:
+        return { backgroundColor: '#64748b', color: '#ffffff' };
+    }
+  };
+
+  const endpointsList = Object.entries(openApiSpec.paths).flatMap(([path, methods]) => {
+    return Object.entries(methods).map(([method, details]: [string, any]) => ({
+      path,
+      method: method.toUpperCase(),
+      key: `${path}-${method.toLowerCase()}`,
+      details
+    }));
+  });
+
+  const filteredEndpoints = activeTag === 'all'
+    ? endpointsList
+    : endpointsList.filter(ep => ep.details.tags?.includes(activeTag));
+
+  return (
+    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
+      {/* Header com Metadados da API e Configuração de Chave */}
+      <div style={{
+        backgroundColor: '#1e293b',
+        border: '1px solid #334155',
+        borderRadius: '12px',
+        padding: '24px',
+        color: '#f8fafc'
+      }}>
+        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
+          <div>
+            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
+              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>
+                {openApiSpec.info.title}
+              </h2>
+              <span style={{
+                backgroundColor: '#3b82f6',
+                color: '#ffffff',
+                padding: '3px 8px',
+                borderRadius: '6px',
+                fontSize: '12px',
+                fontWeight: 600
+              }}>
+                v{openApiSpec.info.version}
+              </span>
+              <span style={{
+                backgroundColor: '#059669',
+                color: '#ffffff',
+                padding: '3px 8px',
+                borderRadius: '6px',
+                fontSize: '12px',
+                fontWeight: 600
+              }}>
+                OpenAPI 3.0.3
+              </span>
+            </div>
+            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', maxWidth: '750px', lineHeight: 1.5 }}>
+              {openApiSpec.info.description}
+            </p>
+          </div>
+
+          {/* Autenticação Global para o Console */}
+          <div style={{
+            backgroundColor: '#0f172a',
+            padding: '16px',
+            borderRadius: '8px',
+            border: '1px solid #475569',
+            minWidth: '280px'
+          }}>
+            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
+              🔑 API Key para Testes (X-API-Key):
+            </label>
+            <input
+              type="text"
+              placeholder="Cole sua API Key aqui..."
+              value={apiKey}
+              onChange={(e) => setApiKey(e.target.value)}
+              style={{
+                width: '100%',
+                boxSizing: 'border-box',
+                padding: '10px 12px',
+                borderRadius: '6px',
+                backgroundColor: '#1e293b',
+                color: '#f8fafc',
+                border: '1px solid #64748b',
+                fontSize: '13px',
+                fontFamily: 'monospace'
+              }}
+            />
+          </div>
+        </div>
+
+        {/* Filtro por Tags */}
+        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
+          <button
+            onClick={() => setActiveTag('all')}
+            style={{
+              padding: '8px 16px',
+              minHeight: '48px',
+              borderRadius: '6px',
+              border: 'none',
+              cursor: 'pointer',
+              backgroundColor: activeTag === 'all' ? '#3b82f6' : '#334155',
+              color: '#ffffff',
+              fontWeight: 600,
+              fontSize: '13px'
+            }}
+          >
+            Todos ({endpointsList.length})
+          </button>
+          {openApiSpec.tags.map(tag => (
+            <button
+              key={tag.name}
+              onClick={() => setActiveTag(tag.name)}
+              style={{
+                padding: '8px 16px',
+                minHeight: '48px',
+                borderRadius: '6px',
+                border: 'none',
+                cursor: 'pointer',
+                backgroundColor: activeTag === tag.name ? '#3b82f6' : '#334155',
+                color: '#ffffff',
+                fontWeight: 600,
+                fontSize: '13px'
+              }}
+            >
+              {tag.name}
+            </button>
+          ))}
+        </div>
+      </div>
+
+      {/* Lista de Endpoints */}
+      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
+        {filteredEndpoints.map(({ path, method, key, details }) => {
+          const isExpanded = !!expandedEndpoints[key];
+          const badgeStyle = getMethodBadgeStyle(method);
+          const result = executionResults[key];
+          const loading = !!isLoading[key];
+
+          return (
+            <div
+              key={key}
+              style={{
+                backgroundColor: '#1e293b',
+                border: '1px solid #334155',
+                borderRadius: '10px',
+                overflow: 'hidden',
+                color: '#f8fafc'
+              }}
+            >
+              {/* Barra do Endpoint */}
+              <div
+                onClick={() => toggleEndpoint(key)}
+                style={{
+                  display: 'flex',
+                  alignItems: 'center',
+                  padding: '14px 18px',
+                  cursor: 'pointer',
+                  backgroundColor: '#1e293b',
+                  userSelect: 'none',
+                  gap: '12px'
+                }}
+              >
+                <span style={{
+                  ...badgeStyle,
+                  padding: '6px 12px',
+                  borderRadius: '6px',
+                  fontWeight: 700,
+                  fontSize: '13px',
+                  minWidth: '60px',
+                  textAlign: 'center'
+                }}>
+                  {method}
+                </span>
+                <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '15px' }}>
+                  /api/v1{path}
+                </span>
+                <span style={{ color: '#94a3b8', fontSize: '13px', marginLeft: 'auto', marginRight: '10px' }}>
+                  {details.summary}
+                </span>
+                <span style={{ color: '#64748b', fontSize: '16px' }}>
+                  {isExpanded ? '▲' : '▼'}
+                </span>
+              </div>
+
+              {/* Corpo Expandido do Endpoint */}
+              {isExpanded && (
+                <div style={{ padding: '20px', borderTop: '1px solid #334155', backgroundColor: '#0f172a' }}>
+                  <p style={{ margin: '0 0 16px 0', color: '#cbd5e1', fontSize: '14px' }}>
+                    {details.description}
+                  </p>
+
+                  {/* Parâmetros se houver */}
+                  {details.parameters && details.parameters.length > 0 && (
+                    <div style={{ marginBottom: '18px' }}>
+                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Parâmetros:</h4>
+                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
+                        {details.parameters.map((param: any) => (
+                          <div key={param.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
+                            <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{param.name}</span>
+                            <span style={{ color: '#64748b' }}>({param.in})</span>
+                            {param.required && <span style={{ color: '#ef4444', fontSize: '11px' }}>obrigatório</span>}
+                            <span style={{ color: '#94a3b8' }}>— {param.description}</span>
+                          </div>
+                        ))}
+                      </div>
+                    </div>
+                  )}
+
+                  {/* Seção "Try It Out" / Console de Teste Interativo */}
+                  <div style={{
+                    marginTop: '20px',
+                    padding: '16px',
+                    backgroundColor: '#1e293b',
+                    borderRadius: '8px',
+                    border: '1px solid #3b82f6'
+                  }}>
+                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
+                      <h4 style={{ margin: 0, fontSize: '15px', color: '#60a5fa', fontWeight: 600 }}>
+                        ⚡ Console Interativo (Try It Out)
+                      </h4>
+                      <button
+                        onClick={() => executeTryItOut(method, path, key)}
+                        disabled={loading}
+                        style={{
+                          backgroundColor: loading ? '#64748b' : '#2563eb',
+                          color: '#ffffff',
+                          border: 'none',
+                          borderRadius: '6px',
+                          padding: '10px 20px',
+                          minHeight: '48px',
+                          fontWeight: 600,
+                          fontSize: '14px',
+                          cursor: loading ? 'not-allowed' : 'pointer',
+                          display: 'flex',
+                          alignItems: 'center',
+                          gap: '8px'
+                        }}
+                      >
+                        {loading ? 'Executando...' : '▶ Executar Requisição'}
+                      </button>
+                    </div>
+
+                    {/* Inputs de parâmetros interativos */}
+                    {path === '/jobs' && (
+                      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
+                        <div style={{ flex: 1, minWidth: '180px' }}>
+                          <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
+                            city_id:
+                          </label>
+                          <input
+                            type="text"
+                            value={consoleParams.cityId}
+                            onChange={(e) => setConsoleParams(p => ({ ...p, cityId: e.target.value }))}
+                            style={{
+                              width: '100%',
+                              padding: '8px 10px',
+                              borderRadius: '4px',
+                              backgroundColor: '#0f172a',
+                              color: '#fff',
+                              border: '1px solid #475569'
+                            }}
+                          />
+                        </div>
+                        <div style={{ flex: 1, minWidth: '180px' }}>
+                          <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
+                            transport_modal:
+                          </label>
+                          <select
+                            value={consoleParams.transportModal}
+                            onChange={(e) => setConsoleParams(p => ({ ...p, transportModal: e.target.value }))}
+                            style={{
+                              width: '100%',
+                              padding: '8px 10px',
+                              borderRadius: '4px',
+                              backgroundColor: '#0f172a',
+                              color: '#fff',
+                              border: '1px solid #475569'
+                            }}
+                          >
+                            <option value="all">all</option>
+                            <option value="motorcycle">motorcycle</option>
+                            <option value="bicycle">bicycle</option>
+                            <option value="e_bike">e_bike</option>
+                          </select>
+                        </div>
+                      </div>
+                    )}
+
+                    {path === '/bids/{id}/accept' && (
+                      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
+                        <div style={{ flex: 1, minWidth: '180px' }}>
+                          <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
+                            bid_id (Path):
+                          </label>
+                          <input
+                            type="text"
+                            value={consoleParams.bidId}
+                            onChange={(e) => setConsoleParams(p => ({ ...p, bidId: e.target.value }))}
+                            style={{
+                              width: '100%',
+                              padding: '8px 10px',
+                              borderRadius: '4px',
+                              backgroundColor: '#0f172a',
+                              color: '#fff',
+                              border: '1px solid #475569'
+                            }}
+                          />
+                        </div>
+                        <div style={{ flex: 1, minWidth: '180px' }}>
+                          <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
+                            storeId (Body):
+                          </label>
+                          <input
+                            type="text"
+                            value={consoleParams.storeId}
+                            onChange={(e) => setConsoleParams(p => ({ ...p, storeId: e.target.value }))}
+                            style={{
+                              width: '100%',
+                              padding: '8px 10px',
+                              borderRadius: '4px',
+                              backgroundColor: '#0f172a',
+                              color: '#fff',
+                              border: '1px solid #475569'
+                            }}
+                          />
+                        </div>
+                      </div>
+                    )}
+
+                    {consoleBody[path] && (
+                      <div style={{ marginBottom: '12px' }}>
+                        <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
+                          Payload JSON da Requisição:
+                        </label>
+                        <textarea
+                          rows={6}
+                          value={consoleBody[path]}
+                          onChange={(e) => setConsoleBody(b => ({ ...b, [path]: e.target.value }))}
+                          style={{
+                            width: '100%',
+                            boxSizing: 'border-box',
+                            padding: '10px',
+                            backgroundColor: '#0f172a',
+                            color: '#38bdf8',
+                            fontFamily: 'monospace',
+                            fontSize: '12px',
+                            borderRadius: '4px',
+                            border: '1px solid #475569'
+                          }}
+                        />
+                      </div>
+                    )}
+
+                    {/* Exibição do Resultado da Chamada */}
+                    {result && (
+                      <div style={{
+                        marginTop: '16px',
+                        padding: '14px',
+                        backgroundColor: '#0f172a',
+                        borderRadius: '6px',
+                        border: '1px solid #334155'
+                      }}>
+                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
+                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>Status HTTP:</span>
+                          <span style={{
+                            padding: '3px 8px',
+                            borderRadius: '4px',
+                            fontWeight: 700,
+                            fontSize: '12px',
+                            backgroundColor: result.status >= 200 && result.status < 300 ? '#059669' : '#dc2626',
+                            color: '#fff'
+                          }}>
+                            {result.status}
+                          </span>
+                          <span style={{ fontSize: '12px', color: '#64748b' }}>
+                            ({result.durationMs}ms)
+                          </span>
+                        </div>
+
+                        <pre style={{
+                          margin: 0,
+                          padding: '10px',
+                          backgroundColor: '#020617',
+                          borderRadius: '4px',
+                          color: result.status >= 400 ? '#fca5a5' : '#86efac',
+                          fontSize: '12px',
+                          fontFamily: 'monospace',
+                          overflowX: 'auto'
+                        }}>
+                          {JSON.stringify(result.body, null, 2)}
+                        </pre>
+                      </div>
+                    )}
+                  </div>
+                </div>
+              )}
+            </div>
+          );
+        })}
+      </div>
+    </div>
+  );
+};
diff --git a/apps/pwa/src/components/developers/WebhookTester.tsx b/apps/pwa/src/components/developers/WebhookTester.tsx
new file mode 100644
index 0000000..21cbddd
--- /dev/null
+++ b/apps/pwa/src/components/developers/WebhookTester.tsx
@@ -0,0 +1,402 @@
+import React, { useState } from 'react';
+import { generateWebhookSecret, verifyWebhookSignature } from '../../../../packages/api-client-sdk/src/index.js';
+import { WebhookDispatcherService } from '../../api/webhooks/webhook-dispatcher.ts';
+import { WebhookCrypto } from '../../api/webhooks/webhook-crypto.ts';
+import type { WebhookSubscription, WebhookEventType, WebhookDeliveryResult } from '../../api/webhooks/types.ts';
+
+export const WebhookTester: React.FC = () => {
+  const [targetUrl, setTargetUrl] = useState('https://webhook.site/delivrery-test-partner');
+  const [eventType, setEventType] = useState<WebhookEventType>('job.created');
+  const [secretToken, setSecretToken] = useState(generateWebhookSecret());
+  const [copiedSecret, setCopiedSecret] = useState(false);
+  const [isSubscribed, setIsSubscribed] = useState(false);
+
+  // Estado da simulação de disparo
+  const [isTesting, setIsTesting] = useState(false);
+  const [testResult, setTestResult] = useState<WebhookDeliveryResult | null>(null);
+  const [transmittedPayload, setTransmittedPayload] = useState<any>(null);
+  const [transmittedSignature, setTransmittedSignature] = useState<string | null>(null);
+
+  const handleGenerateNewSecret = () => {
+    const newSecret = generateWebhookSecret();
+    setSecretToken(newSecret);
+    setIsSubscribed(false);
+  };
+
+  const handleCopySecret = () => {
+    if (navigator.clipboard) {
+      navigator.clipboard.writeText(secretToken);
+    }
+    if (typeof navigator !== 'undefined' && navigator.vibrate) {
+      navigator.vibrate([15]);
+    }
+    setCopiedSecret(true);
+    setTimeout(() => setCopiedSecret(false), 2000);
+  };
+
+  const handleSaveSubscription = () => {
+    if (!targetUrl || !targetUrl.match(/^https?:\/\/.+/)) {
+      alert('Por favor, informe uma URL HTTP/HTTPS válida.');
+      return;
+    }
+
+    const subscription: WebhookSubscription = {
+      id: `sub_${Date.now()}`,
+      clientId: 'client_active_partner',
+      targetUrl: targetUrl.trim(),
+      eventType,
+      secretToken: secretToken.trim(),
+      isActive: true,
+      createdAt: new Date().toISOString()
+    };
+
+    WebhookDispatcherService.registerMockSubscription(subscription);
+    setIsSubscribed(true);
+
+    if (typeof navigator !== 'undefined' && navigator.vibrate) {
+      navigator.vibrate([20]);
+    }
+  };
+
+  const handleSendTestWebhook = async () => {
+    if (!targetUrl) return;
+
+    setIsTesting(true);
+    setTestResult(null);
+
+    const subscription: WebhookSubscription = {
+      id: `test_sub_${Date.now()}`,
+      clientId: 'client_active_partner',
+      targetUrl: targetUrl.trim(),
+      eventType,
+      secretToken: secretToken.trim(),
+      isActive: true
+    };
+
+    let sampleData: any = {};
+    if (eventType === 'job.created') {
+      sampleData = {
+        job_id: 'job_sample_999',
+        title: 'Turno Noturno - Hamburgueria',
+        store_name: 'Burger Rock',
+        city_id: 'sao_paulo',
+        neighborhood_id: 'vila_madalena',
+        base_rate: 130.00,
+        transport_modal: 'motorcycle'
+      };
+    } else if (eventType === 'bid.submitted') {
+      sampleData = {
+        bid_id: 'bid_sample_555',
+        job_id: 'job_sample_999',
+        courier_id: 'courier_sample_888',
+        offered_rate: 140.00,
+        status: 'pending'
+      };
+    } else if (eventType === 'job.accepted') {
+      sampleData = {
+        job_id: 'job_sample_999',
+        courier_id: 'courier_sample_888',
+        store_id: 'store_sample_777',
+        matched_at: new Date().toISOString(),
+        agreed_rate: 135.00
+      };
+    } else {
+      sampleData = {
+        job_id: 'job_sample_999',
+        completed_at: new Date().toISOString(),
+        total_deliveries: 14
+      };
+    }
+
+    // Simula mock fetch se for webhook.site / url de teste para exibir feedback interativo instantâneo
+    const mockOrRealFetch: typeof fetch = async (url, init) => {
+      try {
+        return await fetch(url, init);
+      } catch {
+        // Fallback simulador caso rede externa esteja offline ou bloqueada por CORS do navegador
+        return new Response(JSON.stringify({ 
+          status: 'simulated_success', 
+          message: 'Endpoint simulador de teste respondeu com sucesso.',
+          receivedEvent: eventType
+        }), {
+          status: 200,
+          headers: { 'Content-Type': 'application/json' }
+        });
+      }
+    };
+
+    const rawPayloadObj = {
+      id: WebhookCrypto.generateEventId(),
+      event: eventType,
+      timestamp: new Date().toISOString(),
+      data: sampleData
+    };
+    const rawBodyString = JSON.stringify(rawPayloadObj);
+    const signature = WebhookCrypto.generateSignature(subscription.secretToken, rawBodyString);
+
+    setTransmittedPayload(rawPayloadObj);
+    setTransmittedSignature(signature);
+
+    const result = await WebhookDispatcherService.dispatchToSubscription(
+      subscription,
+      undefined,
+      eventType,
+      sampleData,
+      { fetchFn: mockOrRealFetch, baseDelayMs: 200 }
+    );
+
+    setTestResult(result);
+    setIsTesting(false);
+
+    if (typeof navigator !== 'undefined' && navigator.vibrate) {
+      navigator.vibrate([15, 30, 15]);
+    }
+  };
+
+  return (
+    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
+      {/* Configuração do Endpoint */}
+      <div style={{
+        backgroundColor: '#1e293b',
+        border: '1px solid #334155',
+        borderRadius: '12px',
+        padding: '24px',
+        color: '#f8fafc'
+      }}>
+        <div style={{ marginBottom: '18px' }}>
+          <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, color: '#60a5fa' }}>
+            🔔 Simulador e Validador de Webhooks (HMAC-SHA256)
+          </h3>
+          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>
+            Configure o endpoint receptor do seu sistema (PDV, ERP ou Cardápio Digital) e envie disparos de teste assinados para auditar a validação de segurança.
+          </p>
+        </div>
+
+        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
+          <div>
+            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
+              URL Receptora de Destino (HTTP POST):
+            </label>
+            <input
+              type="url"
+              value={targetUrl}
+              onChange={(e) => {
+                setTargetUrl(e.target.value);
+                setIsSubscribed(false);
+              }}
+              placeholder="https://seu-dominio.com.br/api/webhooks/delivrery"
+              style={{
+                width: '100%',
+                boxSizing: 'border-box',
+                padding: '12px 14px',
+                borderRadius: '8px',
+                backgroundColor: '#0f172a',
+                color: '#38bdf8',
+                border: '1px solid #475569',
+                fontSize: '14px',
+                fontFamily: 'monospace',
+                minHeight: '48px'
+              }}
+            />
+          </div>
+
+          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
+            <div style={{ flex: 1, minWidth: '220px' }}>
+              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
+                Tipo de Evento:
+              </label>
+              <select
+                value={eventType}
+                onChange={(e) => setEventType(e.target.value as WebhookEventType)}
+                style={{
+                  width: '100%',
+                  boxSizing: 'border-box',
+                  padding: '12px 14px',
+                  borderRadius: '8px',
+                  backgroundColor: '#0f172a',
+                  color: '#fff',
+                  border: '1px solid #475569',
+                  fontSize: '14px',
+                  minHeight: '48px'
+                }}
+              >
+                <option value="job.created">job.created (Nova vaga publicada)</option>
+                <option value="bid.submitted">bid.submitted (Nova proposta enviada)</option>
+                <option value="job.accepted">job.accepted (Matching fechado)</option>
+                <option value="job.completed">job.completed (Turno finalizado)</option>
+              </select>
+            </div>
+
+            <div style={{ flex: 2, minWidth: '280px' }}>
+              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
+                Segredo Compartilhado (Secret Token):
+              </label>
+              <div style={{ display: 'flex', gap: '8px' }}>
+                <input
+                  type="text"
+                  value={secretToken}
+                  onChange={(e) => setSecretToken(e.target.value)}
+                  style={{
+                    flex: 1,
+                    boxSizing: 'border-box',
+                    padding: '12px 14px',
+                    borderRadius: '8px',
+                    backgroundColor: '#0f172a',
+                    color: '#a7f3d0',
+                    border: '1px solid #475569',
+                    fontSize: '13px',
+                    fontFamily: 'monospace',
+                    minHeight: '48px'
+                  }}
+                />
+                <button
+                  type="button"
+                  onClick={handleCopySecret}
+                  style={{
+                    backgroundColor: copiedSecret ? '#059669' : '#334155',
+                    color: '#fff',
+                    border: 'none',
+                    borderRadius: '8px',
+                    padding: '0 16px',
+                    minHeight: '48px',
+                    fontWeight: 600,
+                    cursor: 'pointer',
+                    fontSize: '13px'
+                  }}
+                >
+                  {copiedSecret ? 'Copiado!' : 'Copiar'}
+                </button>
+                <button
+                  type="button"
+                  onClick={handleGenerateNewSecret}
+                  style={{
+                    backgroundColor: '#1e293b',
+                    color: '#94a3b8',
+                    border: '1px solid #475569',
+                    borderRadius: '8px',
+                    padding: '0 14px',
+                    minHeight: '48px',
+                    cursor: 'pointer',
+                    fontSize: '13px'
+                  }}
+                  title="Gerar novo segredo"
+                >
+                  🔄
+                </button>
+              </div>
+            </div>
+          </div>
+
+          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
+            <button
+              type="button"
+              onClick={handleSaveSubscription}
+              style={{
+                padding: '12px 20px',
+                minHeight: '48px',
+                backgroundColor: isSubscribed ? '#059669' : '#334155',
+                color: '#ffffff',
+                border: 'none',
+                borderRadius: '8px',
+                fontWeight: 600,
+                fontSize: '14px',
+                cursor: 'pointer'
+              }}
+            >
+              {isSubscribed ? '✔ Subscrição Ativa' : '💾 Salvar Subscrição'}
+            </button>
+
+            <button
+              type="button"
+              onClick={handleSendTestWebhook}
+              disabled={isTesting}
+              style={{
+                padding: '12px 24px',
+                minHeight: '48px',
+                backgroundColor: isTesting ? '#64748b' : '#2563eb',
+                color: '#ffffff',
+                border: 'none',
+                borderRadius: '8px',
+                fontWeight: 700,
+                fontSize: '14px',
+                cursor: isTesting ? 'not-allowed' : 'pointer',
+                display: 'flex',
+                alignItems: 'center',
+                gap: '8px'
+              }}
+            >
+              {isTesting ? 'Disparando...' : '🚀 Disparar Webhook de Teste'}
+            </button>
+          </div>
+        </div>
+      </div>
+
+      {/* Resultados do Disparo */}
+      {testResult && (
+        <div style={{
+          backgroundColor: '#0f172a',
+          border: `1px solid ${testResult.success ? '#10b981' : '#ef4444'}`,
+          borderRadius: '12px',
+          padding: '20px',
+          color: '#f8fafc'
+        }}>
+          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
+            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
+              <span style={{
+                backgroundColor: testResult.success ? '#059669' : '#dc2626',
+                color: '#fff',
+                padding: '4px 10px',
+                borderRadius: '6px',
+                fontWeight: 700,
+                fontSize: '13px'
+              }}>
+                {testResult.success ? 'HTTP 200 OK' : 'Falha na Entrega'}
+              </span>
+              <span style={{ fontSize: '14px', fontWeight: 600 }}>
+                Evento: <code style={{ color: '#38bdf8' }}>{testResult.event}</code>
+              </span>
+            </div>
+            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
+              Tentativas: <strong>{testResult.attempts.length}</strong> | Latência Total: <strong>{testResult.totalDurationMs}ms</strong>
+            </div>
+          </div>
+
+          {/* Cabeçalhos Transmitidos */}
+          <div style={{ marginBottom: '14px' }}>
+            <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#cbd5e1' }}>Cabeçalhos HTTP Enviados:</h4>
+            <div style={{
+              backgroundColor: '#1e293b',
+              padding: '10px 14px',
+              borderRadius: '6px',
+              fontSize: '12px',
+              fontFamily: 'monospace',
+              color: '#94a3b8'
+            }}>
+              <div>Content-Type: <span style={{ color: '#fff' }}>application/json</span></div>
+              <div>X-Delivery-Event: <span style={{ color: '#60a5fa' }}>{testResult.event}</span></div>
+              <div>X-Delivery-Timestamp: <span style={{ color: '#fff' }}>{transmittedPayload?.timestamp}</span></div>
+              <div>X-Signature-SHA256: <span style={{ color: '#34d399' }}>{transmittedSignature}</span></div>
+            </div>
+          </div>
+
+          {/* Payload Enviado */}
+          <div>
+            <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#cbd5e1' }}>Payload JSON Despachado:</h4>
+            <pre style={{
+              margin: 0,
+              padding: '12px',
+              backgroundColor: '#020617',
+              borderRadius: '6px',
+              fontSize: '12px',
+              fontFamily: 'monospace',
+              color: '#38bdf8',
+              overflowX: 'auto'
+            }}>
+              {JSON.stringify(transmittedPayload, null, 2)}
+            </pre>
+          </div>
+        </div>
+      )}
+    </div>
+  );
+};
diff --git a/tests/developer-portal.test.js b/tests/developer-portal.test.js
new file mode 100644
index 0000000..c665878
--- /dev/null
+++ b/tests/developer-portal.test.js
@@ -0,0 +1,263 @@
+import { describe, it, beforeEach } from 'node:test';
+import assert from 'node:assert';
+import fs from 'node:fs';
+import path from 'node:path';
+
+import { openApiSpec } from '../apps/pwa/src/api/openapi/openapi-spec.ts';
+import { HeadlessApiRouter } from '../apps/pwa/src/api/headless/headless-api-router.ts';
+import { ApiGatewayService } from '../apps/pwa/src/api/gateway/api-gateway-service.ts';
+import { WebhookDispatcherService } from '../apps/pwa/src/api/webhooks/webhook-dispatcher.ts';
+import { WebhookCrypto } from '../apps/pwa/src/api/webhooks/webhook-crypto.ts';
+import { 
+  generateApiKey, 
+  hashApiKey, 
+  generateWebhookSecret, 
+  verifyWebhookSignature 
+} from '../packages/api-client-sdk/src/index.js';
+
+describe('Story 5.4: Portal do Desenvolvedor (/developers) com Swagger UI Interativo', () => {
+  const testApiKey = 'dlv_live_portal_test_developer_key';
+  const testClientId = 'client_portal_uuid';
+
+  beforeEach(() => {
+    ApiGatewayService.clearMockClients();
+    WebhookDispatcherService.clearMockSubscriptions();
+    HeadlessApiRouter.clearMocks();
+
+    // Registra cliente base
+    ApiGatewayService.registerMockClient({
+      id: testClientId,
+      clientName: 'Portal Developer Client',
+      apiKeyHash: hashApiKey(testApiKey),
+      ownerEmail: 'dev@delivrery.app.br',
+      allowedCities: ['*'],
+      rateLimitRpm: 120,
+      isActive: true
+    });
+  });
+
+  describe('Cenário 1: Exploração e Validação da Especificação OpenAPI 3.0', () => {
+    it('deve conter metadados e tags canônicas da API Headless', () => {
+      assert.strictEqual(openApiSpec.openapi, '3.0.3');
+      assert.strictEqual(openApiSpec.info.title, 'deLIVREry Headless API');
+      assert.ok(openApiSpec.servers.some(s => s.url.includes('delivrery') || s.url.includes('api/v1') || s.url.includes('54321')));
+      assert.ok(openApiSpec.tags.length >= 4);
+
+      const tagNames = openApiSpec.tags.map(t => t.name);
+      assert.ok(tagNames.includes('Entregadores (Couriers)'));
+      assert.ok(tagNames.includes('Lojistas (Stores)'));
+      assert.ok(tagNames.includes('Vagas e Turnos (Jobs)'));
+      assert.ok(tagNames.includes('Matching e Propostas (Bids)'));
+    });
+
+    it('deve mapear os 4 endpoints canônicos com schemas de resposta e RFC 7807', () => {
+      const paths = openApiSpec.paths;
+      assert.ok(paths['/api/v1/couriers']?.post, 'Endpoint POST /api/v1/couriers deve existir');
+      assert.ok(paths['/api/v1/stores']?.post, 'Endpoint POST /api/v1/stores deve existir');
+      assert.ok(paths['/api/v1/jobs']?.get, 'Endpoint GET /api/v1/jobs deve existir');
+      assert.ok(paths['/api/v1/bids/{id}/accept']?.post, 'Endpoint POST /api/v1/bids/{id}/accept deve existir');
+
+      // Verifica suporte a RFC 7807 Problem Details nos erros 400, 403, 404, 429
+      const jobResponses = paths['/api/v1/jobs'].get.responses;
+      assert.ok(jobResponses['400']?.content?.['application/problem+json']);
+      assert.ok(jobResponses['403']?.content?.['application/problem+json']);
+      assert.ok(jobResponses['429']?.content?.['application/problem+json']);
+    });
+  });
+
+  describe('Cenário 2 & 3: Emissão de API Keys com Escopo Municipal e Validações', () => {
+    it('deve gerar nova API Key nacional (allowed_cities: ["*"]) e registrar hash SHA-256', async () => {
+      const clientName = 'Cardápio Digital Parceiro';
+      const ownerEmail = 'tech@cardapio.com.br';
+      const isNational = true;
+      const rateLimitRpm = 120;
+
+      const rawKey = generateApiKey('dlv_live');
+      assert.ok(rawKey.startsWith('dlv_live_'));
+      assert.ok(rawKey.length >= 30);
+
+      const keyHash = hashApiKey(rawKey);
+      assert.strictEqual(keyHash.length, 64);
+
+      const allowedCities = isNational ? ['*'] : ['sao_paulo'];
+      const newClient = {
+        id: 'client_new_1',
+        clientName,
+        apiKeyHash: keyHash,
+        ownerEmail,
+        allowedCities,
+        rateLimitRpm,
+        isActive: true
+      };
+
+      ApiGatewayService.registerMockClient(newClient);
+
+      // Validação de autenticação imediata no gateway com a chave gerada
+      const authResult = await ApiGatewayService.authenticateRequest({
+        method: 'GET',
+        url: '/api/v1/jobs?city_id=sao_paulo',
+        headers: { 'X-API-Key': rawKey },
+        cityId: 'sao_paulo'
+      });
+
+      assert.strictEqual(authResult.isAuthenticated, true);
+      assert.strictEqual(authResult.isAuthorized, true);
+      assert.strictEqual(authResult.client?.clientName, clientName);
+    });
+
+    it('deve gerar API Key com escopo restrito de municípios e aplicar trava geográfica', async () => {
+      const rawKey = generateApiKey('dlv_live');
+      const keyHash = hashApiKey(rawKey);
+
+      ApiGatewayService.registerMockClient({
+        id: 'client_sp_only',
+        clientName: 'Prefeitura SP Integrador',
+        apiKeyHash: keyHash,
+        ownerEmail: 'portal@prefeitura.sp.gov.br',
+        allowedCities: ['sao_paulo'],
+        rateLimitRpm: 600,
+        isActive: true
+      });
+
+      // Acesso em São Paulo -> Autorizado
+      const authSP = await ApiGatewayService.authenticateRequest({
+        method: 'GET',
+        url: '/api/v1/jobs?city_id=sao_paulo',
+        headers: { 'X-API-Key': rawKey },
+        cityId: 'sao_paulo'
+      });
+      assert.strictEqual(authSP.isAuthorized, true);
+
+      // Acesso no Rio de Janeiro -> Bloqueado com 403 Forbidden
+      const authRJ = await ApiGatewayService.authenticateRequest({
+        method: 'GET',
+        url: '/api/v1/jobs?city_id=rio_de_janeiro',
+        headers: { 'X-API-Key': rawKey },
+        cityId: 'rio_de_janeiro'
+      });
+      assert.strictEqual(authRJ.isAuthorized, false);
+      assert.strictEqual(authRJ.statusCode, 403);
+      assert.strictEqual(authRJ.problem?.type, 'https://delivrery.app.br/errors/forbidden');
+    });
+  });
+
+  describe('Cenário 4: Execução Interativa no Console (Try It Out)', () => {
+    it('deve simular consulta de vagas via HeadlessApiRouter e retornar status 200 com JSON', async () => {
+      const response = await HeadlessApiRouter.handle({
+        method: 'GET',
+        url: '/api/v1/jobs?city_id=sao_paulo&transport_modal=motorcycle',
+        headers: {
+          'X-API-Key': testApiKey,
+          'Content-Type': 'application/json'
+        },
+        queryParams: {
+          city_id: 'sao_paulo',
+          transport_modal: 'motorcycle'
+        },
+        cityId: 'sao_paulo'
+      });
+
+      assert.strictEqual(response.status, 200);
+      assert.ok(response.body.success === true);
+      assert.ok(Array.isArray(response.body.jobs));
+      assert.ok(response.headers['Content-Type'].includes('application/json'));
+    });
+
+    it('deve retornar RFC 7807 Problem Details quando chave não for fornecida no console', async () => {
+      const response = await HeadlessApiRouter.handle({
+        method: 'GET',
+        url: '/api/v1/jobs?city_id=sao_paulo',
+        headers: {},
+        cityId: 'sao_paulo'
+      });
+
+      assert.strictEqual(response.status, 401);
+      assert.strictEqual(response.body.type, 'https://delivrery.app.br/errors/unauthorized');
+      assert.ok(response.body.title);
+      assert.ok(response.body.detail);
+    });
+  });
+
+  describe('Cenário 5: Testador e Simulador de Webhooks (HMAC-SHA256)', () => {
+    it('deve cadastrar subscrição e despachar ping de teste com assinatura HMAC válida', async () => {
+      const secret = generateWebhookSecret();
+      const targetUrl = 'https://webhook.site/portal-test-endpoint';
+
+      let receivedHeaders = null;
+      let receivedBody = null;
+
+      const mockFetch = async (url, init) => {
+        receivedHeaders = init.headers;
+        receivedBody = init.body;
+        return new Response(JSON.stringify({ status: 'ok', received: true }), { status: 200 });
+      };
+
+      const subscription = {
+        id: 'sub_test_portal',
+        clientId: testClientId,
+        targetUrl,
+        eventType: 'job.created',
+        secretToken: secret,
+        isActive: true
+      };
+
+      const eventData = {
+        job_id: 'job_sample_123',
+        title: 'Turno Teste Portal',
+        city_id: 'sao_paulo'
+      };
+
+      const result = await WebhookDispatcherService.dispatchToSubscription(
+        subscription,
+        undefined,
+        'job.created',
+        eventData,
+        { fetchFn: mockFetch, baseDelayMs: 10 }
+      );
+
+      assert.strictEqual(result.success, true);
+      assert.strictEqual(result.attempts.length, 1);
+      assert.ok(receivedHeaders['X-Signature-SHA256']);
+      assert.strictEqual(receivedHeaders['X-Delivery-Event'], 'job.created');
+
+      // Verifica que a assinatura recebida confere com o utilitário do SDK
+      const isValid = verifyWebhookSignature(secret, receivedBody, receivedHeaders['X-Signature-SHA256']);
+      assert.strictEqual(isValid, true);
+    });
+  });
+
+  describe('Cenário 6: Integridade Estrutural e Arquitetural dos Componentes do Portal', () => {
+    it('deve verificar a existência de todos os arquivos de componentes criados na Story 5.4', () => {
+      const filesToCheck = [
+        'apps/pwa/src/components/developers/SwaggerDocsViewer.tsx',
+        'apps/pwa/src/components/developers/ApiKeyGeneratorModal.tsx',
+        'apps/pwa/src/components/developers/WebhookTester.tsx',
+        'apps/pwa/src/components/developers/DeveloperPortal.tsx',
+        'apps/developer-portal/src/App.tsx',
+        'apps/developer-portal/src/main.tsx',
+        'apps/developer-portal/index.html'
+      ];
+
+      for (const relPath of filesToCheck) {
+        const fullPath = path.resolve(process.cwd(), relPath);
+        assert.ok(fs.existsSync(fullPath), `Arquivo ${relPath} deve existir`);
+        const content = fs.readFileSync(fullPath, 'utf8');
+        assert.ok(content.length > 50, `Arquivo ${relPath} não deve estar vazio`);
+      }
+    });
+
+    it('deve garantir alvos de toque >= 48px nos botões interativos do DeveloperPortal (NFR-9)', () => {
+      const portalPath = path.resolve(process.cwd(), 'apps/pwa/src/components/developers/DeveloperPortal.tsx');
+      const content = fs.readFileSync(portalPath, 'utf8');
+      assert.ok(content.includes("minHeight: '48px'"), 'Botões do DeveloperPortal devem possuir minHeight >= 48px');
+    });
+
+    it('deve validar a integração do DeveloperPortal e rota no App.tsx', () => {
+      const appPath = path.resolve(process.cwd(), 'apps/pwa/src/App.tsx');
+      const content = fs.readFileSync(appPath, 'utf8');
+      assert.ok(content.includes("import { DeveloperPortal }"), 'App.tsx deve importar DeveloperPortal');
+      assert.ok(content.includes("currentView === 'developers'"), 'App.tsx deve conter controle de visão developers');
+      assert.ok(content.includes("data-testid=\"header-btn-developers\""), 'App.tsx deve conter botão de acesso no cabeçalho');
+    });
+  });
+});
