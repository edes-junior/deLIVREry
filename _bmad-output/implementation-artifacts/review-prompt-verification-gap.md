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

diff --git a/_bmad-output/implementation-artifacts/diff_output.patch b/_bmad-output/implementation-artifacts/diff_output.patch
index c2f2e62..3fcf66e 100644
Binary files a/_bmad-output/implementation-artifacts/diff_output.patch and b/_bmad-output/implementation-artifacts/diff_output.patch differ
diff --git a/_bmad-output/implementation-artifacts/spec-5-3-dispatcher-de-webhooks-de-saida-assinados-criptograficamente.md b/_bmad-output/implementation-artifacts/spec-5-3-dispatcher-de-webhooks-de-saida-assinados-criptograficamente.md
new file mode 100644
index 0000000..2f43c3f
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/spec-5-3-dispatcher-de-webhooks-de-saida-assinados-criptograficamente.md
@@ -0,0 +1,109 @@
+---
+title: 'Story 5.3: Dispatcher de Webhooks de Saída Assinados Criptograficamente (HMAC-SHA256)'
+type: 'feature'
+created: '2026-09-08'
+status: 'in-review'
+baseline_commit: '3882daf27bc88db257c66dc64972f778d91c28c8'
+review_loop_iteration: 0
+context: []
+---
+
+<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
+
+## Intent
+
+**Problem:** Plataformas integradas e parceiros comerciais (PDVs, cardápios digitais, portais municipais) não recebem notificações em tempo real quando ocorrem eventos operacionais de entrega (`job.created`, `bid.submitted`, `job.accepted`, `job.completed`), e o deLIVREry não possui infraestrutura de despacho com garantia de autenticidade (HMAC) e resiliência a falhas de rede.
+
+**Approach:** Desenvolver o serviço de despacho de webhooks de saída assíncrono (`WebhookDispatcherService`) com cálculo de assinatura criptográfica HMAC-SHA256, injeção de headers de segurança (`X-Signature-SHA256`, `X-Delivery-Event`, `X-Delivery-Timestamp`), filtragem por escopo municipal (`allowed_cities`) e mecanismo de retentativas automáticas (até 3 tentativas) com backoff exponencial para códigos 5xx ou falhas de rede.
+
+## Boundaries & Constraints
+
+**Always:**
+- O payload deve ser transmitido via `HTTP POST` com cabeçalho `Content-Type: application/json`.
+- A assinatura HMAC-SHA256 deve ser gerada utilizando o `secret_token` da subscrição sobre o corpo exato da requisição serializada e transmitida no cabeçalho `X-Signature-SHA256`.
+- Cabeçalhos `X-Delivery-Event` (tipo do evento) e `X-Delivery-Timestamp` (timestamp ISO UTC do despacho) são obrigatórios em toda entrega.
+- Caso o parceiro possua escopo restrito em `allowed_cities` (diferente de `{"*"}`), o evento só pode ser despachado se o município do evento constar em suas cidades autorizadas.
+- Falhas temporárias (respostas HTTP >= 500 ou falhas de conexão/timeout) acionam política de retentativa de até 3 tentativas com backoff exponencial (1x, 2x, 4x o delay base).
+- Erros de cliente parceiro (HTTP 4xx como 400 ou 404) são considerados falhas permanentes e não devem ser re-tentados.
+- O despacho deve ser não-bloqueante para os fluxos síncronos da API e PWA.
+
+**Ask First:**
+- Expansão da lista de eventos canônicos suportados além de `job.created`, `bid.submitted`, `job.accepted`, `job.completed`.
+- Alteração no número padrão de tentativas máximas (3 tentativas) ou timeouts de conexão.
+
+**Never:**
+- Nunca trafegar nem expor o `secret_token` no corpo do payload JSON ou em headers de log abertos.
+- Nunca despachar webhooks para subscrições inativas (`is_active = false`) ou parceiros desativados (`api_clients.is_active = false`).
+- Nunca bloquear a conclusão da transação principal de cadastro ou aceite de proposta aguardando o retorno HTTP do endpoint externo do parceiro.
+
+## I/O & Edge-Case Matrix
+
+| Cenário | Entrada / Evento | Saída Esperada / Comportamento | Tratamento de Erro |
+|---|---|---|---|
+| Despacho com Sucesso (200 OK) | Evento `job.created` com payload da vaga em `sao_paulo` para subscrição ativa | HTTP POST com `X-Signature-SHA256` correto, headers de evento e timestamp, status `success: true`, 1 tentativa | N/A |
+| Falha Temporária (500 Server Error) | Servidor do parceiro responde HTTP 500 na 1ª tentativa | Retentativa com backoff exponencial (tentativas 2 e 3). Se responder 200 na 2ª tentativa, registra sucesso | Backoff exponencial (1s, 2s, 4s) |
+| Falha Permanente por 4xx do Parceiro | Endpoint do parceiro retorna HTTP 404 Not Found ou 400 | Não repete requisições desnecessárias; encerra com status de falha permanente | Aborta imediatamente novas tentativas |
+| Filtragem de Escopo Municipal | Vaga criada em `campinas`, mas cliente possui `allowed_cities: ['sao_paulo']` | O webhook é ignorado e nenhum HTTP POST é disparado para essa subscrição | Filtrado antes do disparo |
+| Verificação Criptográfica HMAC | Payload JSON serializado com segredo conhecido | Digest hexadecimal SHA-256 gerado é matematicamente idêntico ao calculado pelo receptor | Erro se chave for inválida ou corpo modificado |
+| Esgotamento de Tentativas (3 falhas 5xx/Timeout) | Endpoint do parceiro inoperante nas 3 tentativas consecutivas | Registra log de entrega com `success: false`, `attempts: 3`, armazenando último erro | Finaliza registrando auditoria de falha |
+
+</frozen-after-approval>
+
+## Code Map
+
+- `apps/pwa/src/api/webhooks/types.ts` -- Definição de interfaces TypeScript para eventos (`WebhookEvent`), subscrições, payloads, headers e log de entrega (`WebhookDeliveryResult`).
+- `apps/pwa/src/api/webhooks/webhook-crypto.ts` -- Algoritmo de cálculo e verificação de assinatura criptográfica HMAC-SHA256 compatível com Node.js e navegadores.
+- `apps/pwa/src/api/webhooks/webhook-dispatcher.ts` -- Serviço de orquestração de despacho de webhooks, consulta de subscrições ativas, filtragem de cidades e ciclo de retentativas com backoff.
+- `packages/api-client-sdk/src/index.js` -- Exportação do utilitário `verifyWebhookSignature` para clientes do SDK auditarem payloads recebidos.
+- `tests/webhook-dispatcher.test.js` -- Suíte de testes automatizados cobrindo cálculo HMAC, headers, ciclo de retentativas 5xx, corte em 4xx e isolamento geográfico.
+
+## Tasks & Acceptance
+
+**Execution:**
+- [x] `apps/pwa/src/api/webhooks/types.ts` -- Criar contratos de tipagem para eventos de webhook, subscrições, payloads e resultados de despacho.
+- [x] `apps/pwa/src/api/webhooks/webhook-crypto.ts` -- Implementar funções `generateWebhookSignature` e `verifyWebhookSignature` com algoritmo HMAC-SHA256.
+- [x] `apps/pwa/src/api/webhooks/webhook-dispatcher.ts` -- Implementar `WebhookDispatcherService` com disparo HTTP assíncrono, checagem de escopo municipal, backoff exponencial e registro de tentativas.
+- [x] `packages/api-client-sdk/src/index.js` -- Adicionar método `verifyWebhookSignature` no SDK cliente para facilidade de integração de desenvolvedores terceiros.
+- [x] `tests/webhook-dispatcher.test.js` -- Implementar suíte de testes com mocks HTTP cobrindo todos os cenários da matriz de I/O, segurança HMAC e retentativas.
+
+**Acceptance Criteria:**
+- Given um evento disparado (`job.created`, `bid.submitted`, `job.accepted`, `job.completed`), when houver subscrições ativas para o evento com escopo municipal compatível, then o webhook deve ser despachado via HTTP POST contendo os cabeçalhos `X-Signature-SHA256`, `X-Delivery-Event` e `X-Delivery-Timestamp`.
+- Given um endpoint receptor respondendo com erro 5xx ou falha de rede, when a política de resiliência for executada, then o dispatcher deve re-tentar até 3 vezes com backoff exponencial antes de declarar falha.
+- Given um endpoint receptor respondendo com erro 4xx, when a resposta for recebida, then o dispatcher não deve executar retentativas, encerrando imediatamente como falha permanente.
+
+## Spec Change Log
+
+<!-- Append-only. Populated by step-04 during review loops. -->
+
+## Design Notes
+
+- **Formato Canônico do Payload de Webhook:**
+  ```json
+  {
+    "id": "evt_01J7K...",
+    "event": "job.created",
+    "timestamp": "2026-09-08T18:00:00.000Z",
+    "data": { ... }
+  }
+  ```
+- **Cabeçalhos HTTP Obrigatórios:**
+  - `Content-Type`: `application/json`
+  - `X-Delivery-Event`: `job.created` (ou outro evento canônico)
+  - `X-Delivery-Timestamp`: Timestamp em formato ISO 8601 UTC
+  - `X-Signature-SHA256`: Hash hexadecimal calculado como `HMAC-SHA256(secret_token, raw_json_body)`
+- **Política de Retentativas e Backoff:**
+  - Tentativa 1: Imediata.
+  - Tentativa 2: Após $1 \times \text{baseDelayMs}$ (ex: 1000ms ou configurável para testes).
+  - Tentativa 3: Após $2 \times \text{baseDelayMs}$ (ex: 2000ms).
+  - Status final registrado com array de detalhes de cada tentativa (`attempts: [{ attemptNumber, statusCode, durationMs, error }]`).
+
+## Verification
+
+**Commands:**
+- `npm test` -- expected: Todas as suítes passam, incluindo a nova `tests/webhook-dispatcher.test.js`.
+- `node --experimental-strip-types --test tests/webhook-dispatcher.test.js` -- expected: 100% de aprovação nos testes da Story 5.3.
+- `git status` -- expected: Árvore de trabalho íntegra.
+
+**Manual checks (if no CLI):**
+- Validar assinatura gerada comparando com utilitário padrão `crypto.createHmac` do Node.
+- Simular servidor receptor falhando nas primeiras 2 tentativas e sucedendo na 3ª.
diff --git a/_bmad-output/implementation-artifacts/sprint-status.yaml b/_bmad-output/implementation-artifacts/sprint-status.yaml
index da3344e..52354b9 100644
--- a/_bmad-output/implementation-artifacts/sprint-status.yaml
+++ b/_bmad-output/implementation-artifacts/sprint-status.yaml
@@ -66,7 +66,7 @@ development_status:
   epic-5: in-progress
   5-1-schema-de-clientes-de-api-webhooks-e-gateway-de-validação: done
   5-2-endpoints-restful-headless-de-gestão-de-vagas-e-perfis-opena: done
-  5-3-dispatcher-de-webhooks-de-saída-assinados-criptograficamente: backlog
+  5-3-dispatcher-de-webhooks-de-saída-assinados-criptograficamente: review
   5-4-portal-do-desenvolvedor-developers-com-swagger-ui-interativo: backlog
   5-5-web-component-embutível-nativo-delivrery-button-para-cardápi: backlog
   epic-5-retrospective: optional
diff --git a/apps/pwa/src/api/webhooks/types.ts b/apps/pwa/src/api/webhooks/types.ts
new file mode 100644
index 0000000..dcae9bd
--- /dev/null
+++ b/apps/pwa/src/api/webhooks/types.ts
@@ -0,0 +1,55 @@
+/**
+ * Contratos de tipos para o Dispatcher de Webhooks de Saída
+ * Em conformidade com FR-17, NFR-6 e NFR-10 (HMAC-SHA256 e resiliência).
+ */
+
+import type { WebhookEventType, WebhookSubscription, ApiClient } from '../gateway/types.ts';
+
+export type { WebhookEventType, WebhookSubscription, ApiClient };
+
+/**
+ * Estrutura padronizada de payload transmitido nos webhooks
+ */
+export interface WebhookPayload<T = any> {
+  id: string;             // ex: evt_01J7K...
+  event: WebhookEventType;
+  timestamp: string;      // ISO 8601 UTC
+  data: T;
+}
+
+/**
+ * Registro de uma tentativa individual de entrega HTTP
+ */
+export interface WebhookDeliveryAttempt {
+  attemptNumber: number;
+  statusCode?: number;
+  durationMs: number;
+  error?: string;
+  timestamp: string;
+}
+
+/**
+ * Resultado consolidado do ciclo de entrega do webhook
+ */
+export interface WebhookDeliveryResult {
+  subscriptionId: string;
+  targetUrl: string;
+  event: WebhookEventType;
+  success: boolean;
+  attempts: WebhookDeliveryAttempt[];
+  totalDurationMs: number;
+  finalStatusCode?: number;
+  error?: string;
+  skipped?: boolean;
+  skipReason?: string;
+}
+
+/**
+ * Opções de configuração do despachante de webhooks
+ */
+export interface WebhookDispatcherOptions {
+  maxAttempts?: number;   // Padrão: 3 tentativas
+  baseDelayMs?: number;   // Padrão: 1000ms (ajustável em testes)
+  timeoutMs?: number;     // Padrão: 5000ms
+  fetchFn?: typeof fetch; // Injeção de dependência para testes unitários
+}
diff --git a/apps/pwa/src/api/webhooks/webhook-crypto.ts b/apps/pwa/src/api/webhooks/webhook-crypto.ts
new file mode 100644
index 0000000..c4d9f30
--- /dev/null
+++ b/apps/pwa/src/api/webhooks/webhook-crypto.ts
@@ -0,0 +1,67 @@
+import { createHmac, timingSafeEqual } from 'node:crypto';
+
+/**
+ * Utilitários criptográficos para Webhooks de Saída e Validação de Assinaturas (FR-17)
+ */
+export class WebhookCrypto {
+  /**
+   * Gera a assinatura HMAC-SHA256 em formato hexadecimal para um determinado payload e secret.
+   *
+   * @param secretToken Segredo compartilhado da subscrição de webhook
+   * @param rawBody Corpo cru da requisição (string) ou objeto serializável
+   * @returns Assinatura HMAC-SHA256 em formato hexadecimal
+   */
+  public static generateSignature(secretToken: string, rawBody: string | object): string {
+    if (!secretToken || typeof secretToken !== 'string') {
+      throw new Error('secretToken é obrigatório para gerar assinatura de webhook.');
+    }
+
+    const payloadString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
+    return createHmac('sha256', secretToken.trim())
+      .update(payloadString, 'utf8')
+      .digest('hex');
+  }
+
+  /**
+   * Valida a assinatura de um webhook recebido de forma segura contra ataques de timing.
+   *
+   * @param secretToken Segredo compartilhado configurado na subscrição
+   * @param rawBody Corpo cru da requisição recebida
+   * @param signatureHeader Valor recebido no cabeçalho X-Signature-SHA256 (com ou sem prefixo 'sha256=')
+   * @returns boolean indicando se a assinatura confere
+   */
+  public static verifySignature(
+    secretToken: string, 
+    rawBody: string | object, 
+    signatureHeader: string
+  ): boolean {
+    if (!secretToken || !signatureHeader) {
+      return false;
+    }
+
+    try {
+      const cleanSignature = signatureHeader.replace(/^sha256=/i, '').trim();
+      const expectedSignature = this.generateSignature(secretToken, rawBody);
+
+      if (cleanSignature.length !== expectedSignature.length) {
+        return false;
+      }
+
+      const bufExpected = Buffer.from(expectedSignature, 'utf8');
+      const bufReceived = Buffer.from(cleanSignature, 'utf8');
+
+      return timingSafeEqual(bufExpected, bufReceived);
+    } catch {
+      return false;
+    }
+  }
+
+  /**
+   * Gera um identificador único para o evento de webhook
+   */
+  public static generateEventId(): string {
+    const timestamp = Date.now().toString(36);
+    const random = Math.random().toString(36).substring(2, 8);
+    return `evt_${timestamp}${random}`;
+  }
+}
diff --git a/apps/pwa/src/api/webhooks/webhook-dispatcher.ts b/apps/pwa/src/api/webhooks/webhook-dispatcher.ts
new file mode 100644
index 0000000..5560965
--- /dev/null
+++ b/apps/pwa/src/api/webhooks/webhook-dispatcher.ts
@@ -0,0 +1,307 @@
+import { WebhookCrypto } from './webhook-crypto.ts';
+import { ApiGatewayService } from '../gateway/api-gateway-service.ts';
+import { supabase } from '../../lib/supabase.ts';
+import type {
+  WebhookEventType,
+  WebhookSubscription,
+  ApiClient,
+  WebhookPayload,
+  WebhookDeliveryResult,
+  WebhookDeliveryAttempt,
+  WebhookDispatcherOptions
+} from './types.ts';
+
+export class WebhookDispatcherService {
+  private static mockSubscriptions: Map<string, { subscription: WebhookSubscription; client?: ApiClient }> = new Map();
+
+  /**
+   * Registra uma subscrição em memória (útil para testes unitários e desenvolvimento local)
+   */
+  public static registerMockSubscription(subscription: WebhookSubscription, client?: ApiClient): void {
+    this.mockSubscriptions.set(subscription.id, { subscription, client });
+  }
+
+  /**
+   * Limpa as subscrições em memória
+   */
+  public static clearMockSubscriptions(): void {
+    this.mockSubscriptions.clear();
+  }
+
+  /**
+   * Retorna as subscrições em memória ativas
+   */
+  public static getMockSubscriptions(): WebhookSubscription[] {
+    return Array.from(this.mockSubscriptions.values()).map(item => item.subscription);
+  }
+
+  /**
+   * Calcula o tempo de espera do backoff exponencial para uma determinada tentativa
+   * Tentativa 1: 0ms (imediata)
+   * Tentativa 2: 1 * baseDelayMs
+   * Tentativa 3: 2 * baseDelayMs
+   */
+  public static calculateBackoff(attempt: number, baseDelayMs: number): number {
+    if (attempt <= 1) return 0;
+    return baseDelayMs * Math.pow(2, attempt - 2);
+  }
+
+  private static sleep(ms: number): Promise<void> {
+    if (ms <= 0) return Promise.resolve();
+    return new Promise(resolve => setTimeout(resolve, ms));
+  }
+
+  /**
+   * Despacha um evento operacional para todos os parceiros com subscrições ativas e compatíveis
+   */
+  public static async dispatch(
+    event: WebhookEventType,
+    data: any,
+    options: WebhookDispatcherOptions = {}
+  ): Promise<WebhookDeliveryResult[]> {
+    const subscriptions = await this.findActiveSubscriptions(event);
+    const results: WebhookDeliveryResult[] = [];
+
+    for (const item of subscriptions) {
+      const result = await this.dispatchToSubscription(item.subscription, item.client, event, data, options);
+      results.push(result);
+    }
+
+    return results;
+  }
+
+  /**
+   * Realiza a entrega HTTP para uma subscrição específica com controle de retentativas
+   */
+  public static async dispatchToSubscription(
+    subscription: WebhookSubscription,
+    client: ApiClient | undefined,
+    event: WebhookEventType,
+    data: any,
+    options: WebhookDispatcherOptions = {}
+  ): Promise<WebhookDeliveryResult> {
+    const maxAttempts = options.maxAttempts ?? 3;
+    const baseDelayMs = options.baseDelayMs ?? 1000;
+    const timeoutMs = options.timeoutMs ?? 5000;
+    const fetchFn = options.fetchFn ?? globalThis.fetch;
+
+    // 1. Verificação de subscrição ativa
+    if (!subscription.isActive) {
+      return {
+        subscriptionId: subscription.id,
+        targetUrl: subscription.targetUrl,
+        event,
+        success: false,
+        skipped: true,
+        skipReason: 'Subscrição inativa',
+        attempts: [],
+        totalDurationMs: 0
+      };
+    }
+
+    // 2. Verificação de Escopo Municipal (FR-3, FR-17)
+    const eventCityId = data?.city_id || data?.cityId || data?.city;
+    if (client && client.allowedCities && eventCityId) {
+      const hasCityAccess = ApiGatewayService.validateCityAccess(client.allowedCities, eventCityId);
+      if (!hasCityAccess) {
+        return {
+          subscriptionId: subscription.id,
+          targetUrl: subscription.targetUrl,
+          event,
+          success: false,
+          skipped: true,
+          skipReason: `Cidade '${eventCityId}' não autorizada no escopo do cliente (${client.allowedCities.join(', ')})`,
+          attempts: [],
+          totalDurationMs: 0
+        };
+      }
+    }
+
+    // 3. Montagem do Payload Padronizado
+    const eventId = WebhookCrypto.generateEventId();
+    const timestamp = new Date().toISOString();
+    const payload: WebhookPayload = {
+      id: eventId,
+      event,
+      timestamp,
+      data
+    };
+
+    const rawBody = JSON.stringify(payload);
+    const signature = WebhookCrypto.generateSignature(subscription.secretToken, rawBody);
+
+    const headers: Record<string, string> = {
+      'Content-Type': 'application/json',
+      'X-Delivery-Event': event,
+      'X-Delivery-Timestamp': timestamp,
+      'X-Signature-SHA256': signature
+    };
+
+    const attempts: WebhookDeliveryAttempt[] = [];
+    const startTimeOverall = Date.now();
+    let success = false;
+    let finalStatusCode: number | undefined;
+    let lastError: string | undefined;
+
+    // 4. Ciclo de Retentativas com Backoff Exponencial
+    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
+      if (attempt > 1) {
+        const backoffMs = this.calculateBackoff(attempt, baseDelayMs);
+        await this.sleep(backoffMs);
+      }
+
+      const attemptStart = Date.now();
+      let attemptStatusCode: number | undefined;
+      let attemptError: string | undefined;
+
+      try {
+        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
+        const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
+
+        const response = await fetchFn(subscription.targetUrl, {
+          method: 'POST',
+          headers,
+          body: rawBody,
+          signal: controller?.signal
+        });
+
+        if (timeoutId) clearTimeout(timeoutId);
+
+        attemptStatusCode = response.status;
+        finalStatusCode = response.status;
+
+        // Sucesso HTTP 2xx
+        if (response.ok) {
+          success = true;
+          attempts.push({
+            attemptNumber: attempt,
+            statusCode: attemptStatusCode,
+            durationMs: Date.now() - attemptStart,
+            timestamp: new Date().toISOString()
+          });
+          break; // Sucesso: encerra ciclo de retentativas
+        }
+
+        // Falha permanente por 4xx do cliente parceiro (ex: 400 Bad Request, 404 Not Found)
+        if (response.status >= 400 && response.status < 500) {
+          attemptError = `Erro permanente do parceiro: HTTP ${response.status}`;
+          lastError = attemptError;
+          attempts.push({
+            attemptNumber: attempt,
+            statusCode: attemptStatusCode,
+            durationMs: Date.now() - attemptStart,
+            error: attemptError,
+            timestamp: new Date().toISOString()
+          });
+          break; // Aborta imediatamente sem re-tentar
+        }
+
+        // Erro HTTP 5xx (Server Error do receptor)
+        attemptError = `Erro no servidor receptor: HTTP ${response.status}`;
+        lastError = attemptError;
+      } catch (err: any) {
+        attemptError = err?.message || 'Falha de conexão / timeout';
+        lastError = attemptError;
+      }
+
+      attempts.push({
+        attemptNumber: attempt,
+        statusCode: attemptStatusCode,
+        durationMs: Date.now() - attemptStart,
+        error: attemptError,
+        timestamp: new Date().toISOString()
+      });
+
+      if (attempt === maxAttempts) {
+        break;
+      }
+    }
+
+    return {
+      subscriptionId: subscription.id,
+      targetUrl: subscription.targetUrl,
+      event,
+      success,
+      attempts,
+      totalDurationMs: Date.now() - startTimeOverall,
+      finalStatusCode,
+      error: lastError
+    };
+  }
+
+  /**
+   * Busca subscrições ativas para o evento a partir da memória ou do banco Supabase
+   */
+  private static async findActiveSubscriptions(
+    event: WebhookEventType
+  ): Promise<Array<{ subscription: WebhookSubscription; client?: ApiClient }>> {
+    const results: Array<{ subscription: WebhookSubscription; client?: ApiClient }> = [];
+
+    // 1. Busca das subscrições em memória
+    for (const item of this.mockSubscriptions.values()) {
+      if (item.subscription.isActive && item.subscription.eventType === event) {
+        results.push(item);
+      }
+    }
+
+    // 2. Se não houver em memória, consulta o Supabase se configurado
+    if (results.length === 0 && supabase) {
+      try {
+        const { data, error } = await supabase
+          .from('webhooks_subscriptions')
+          .select(`
+            id,
+            client_id,
+            target_url,
+            event_type,
+            secret_token,
+            is_active,
+            created_at,
+            api_clients (
+              id,
+              client_name,
+              api_key_hash,
+              owner_email,
+              allowed_cities,
+              rate_limit_rpm,
+              is_active
+            )
+          `)
+          .eq('is_active', true)
+          .eq('event_type', event);
+
+        if (!error && data) {
+          for (const row of data as any[]) {
+            const clientData = row.api_clients;
+            const client: ApiClient | undefined = clientData ? {
+              id: clientData.id,
+              clientName: clientData.client_name,
+              apiKeyHash: clientData.api_key_hash,
+              ownerEmail: clientData.owner_email,
+              allowedCities: clientData.allowed_cities || ['*'],
+              rateLimitRpm: clientData.rate_limit_rpm || 120,
+              isActive: clientData.is_active ?? true
+            } : undefined;
+
+            results.push({
+              subscription: {
+                id: row.id,
+                clientId: row.client_id,
+                targetUrl: row.target_url,
+                eventType: row.event_type as WebhookEventType,
+                secretToken: row.secret_token,
+                isActive: row.is_active,
+                createdAt: row.created_at
+              },
+              client
+            });
+          }
+        }
+      } catch {
+        // Fallback seguro em caso de indisponibilidade momentânea do DB
+      }
+    }
+
+    return results;
+  }
+}
diff --git a/packages/api-client-sdk/src/index.js b/packages/api-client-sdk/src/index.js
index 3bb65e3..823fd69 100644
--- a/packages/api-client-sdk/src/index.js
+++ b/packages/api-client-sdk/src/index.js
@@ -3,7 +3,7 @@
  * Neutral client SDK for interacting with deLIVREry Headless API
  */
 
-import { createHash, randomBytes } from 'node:crypto';
+import { createHash, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
 
 export class DelivreryClient {
   constructor(config = {}) {
@@ -162,6 +162,13 @@ export class DelivreryClient {
       brCodePayload: generatePixBrcode({ key, recipientName, city })
     };
   }
+
+  /**
+   * Valida a assinatura HMAC-SHA256 de um webhook recebido
+   */
+  verifyWebhook(secretToken, rawBody, signatureHeader) {
+    return verifyWebhookSignature(secretToken, rawBody, signatureHeader);
+  }
 }
 
 /**
@@ -185,6 +192,41 @@ export function generateWebhookSecret(byteLength = 32) {
   return `whsec_${entropy}`;
 }
 
+/**
+ * Gera assinatura HMAC-SHA256 para eventos de webhook
+ */
+export function generateWebhookSignature(secretToken, rawBody) {
+  if (!secretToken || typeof secretToken !== 'string') {
+    throw new Error('secretToken é obrigatório para gerar assinatura de webhook.');
+  }
+  const payloadString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
+  return createHmac('sha256', secretToken.trim())
+    .update(payloadString, 'utf8')
+    .digest('hex');
+}
+
+/**
+ * Valida a assinatura de um webhook recebido de forma segura contra timing attacks
+ */
+export function verifyWebhookSignature(secretToken, rawBody, signatureHeader) {
+  if (!secretToken || !signatureHeader) {
+    return false;
+  }
+  try {
+    const cleanSignature = signatureHeader.replace(/^sha256=/i, '').trim();
+    const expectedSignature = generateWebhookSignature(secretToken, rawBody);
+    if (cleanSignature.length !== expectedSignature.length) {
+      return false;
+    }
+    const bufExpected = Buffer.from(expectedSignature, 'utf8');
+    const bufReceived = Buffer.from(cleanSignature, 'utf8');
+    return timingSafeEqual(bufExpected, bufReceived);
+  } catch {
+    return false;
+  }
+}
+
+
 /**
  * Funções utilitárias de BR Code PIX no padrão EMVCo / BACEN
  */
diff --git a/tests/webhook-dispatcher.test.js b/tests/webhook-dispatcher.test.js
new file mode 100644
index 0000000..1e8240e
--- /dev/null
+++ b/tests/webhook-dispatcher.test.js
@@ -0,0 +1,382 @@
+import { describe, it, beforeEach } from 'node:test';
+import assert from 'node:assert';
+import { WebhookDispatcherService } from '../apps/pwa/src/api/webhooks/webhook-dispatcher.ts';
+import { WebhookCrypto } from '../apps/pwa/src/api/webhooks/webhook-crypto.ts';
+import { 
+  DelivreryClient, 
+  generateWebhookSignature, 
+  verifyWebhookSignature,
+  generateWebhookSecret 
+} from '../packages/api-client-sdk/src/index.js';
+
+describe('Story 5.3: Dispatcher de Webhooks de Saída Assinados Criptograficamente (HMAC-SHA256)', () => {
+  const testSecret = 'whsec_test_secret_key_1234567890123456';
+  const testSubscriptionId = 'sub-uuid-1234-5678';
+  const testTargetUrl = 'https://webhook.site/partner-endpoint';
+
+  beforeEach(() => {
+    WebhookDispatcherService.clearMockSubscriptions();
+  });
+
+  describe('Algoritmo Criptográfico HMAC-SHA256 (FR-17)', () => {
+    it('deve gerar e verificar assinatura HMAC-SHA256 com sucesso', () => {
+      const payload = {
+        id: 'evt_012345',
+        event: 'job.created',
+        timestamp: '2026-09-08T18:00:00.000Z',
+        data: { jobId: 'job-1', title: 'Entrega Noturna' }
+      };
+
+      const signature = WebhookCrypto.generateSignature(testSecret, payload);
+      assert.strictEqual(typeof signature, 'string');
+      assert.strictEqual(signature.length, 64); // SHA-256 em hex tem 64 caracteres
+
+      // Validação positiva
+      const isValid = WebhookCrypto.verifySignature(testSecret, payload, signature);
+      assert.strictEqual(isValid, true);
+
+      // Validação positiva com prefixo 'sha256='
+      const isValidWithPrefix = WebhookCrypto.verifySignature(testSecret, payload, `sha256=${signature}`);
+      assert.strictEqual(isValidWithPrefix, true);
+    });
+
+    it('deve rejeitar assinaturas quando o payload for adulterado', () => {
+      const payloadOriginal = { event: 'job.created', jobId: 'job-1' };
+      const payloadAdulterado = { event: 'job.created', jobId: 'job-999' };
+
+      const signature = WebhookCrypto.generateSignature(testSecret, payloadOriginal);
+      const isValid = WebhookCrypto.verifySignature(testSecret, payloadAdulterado, signature);
+      assert.strictEqual(isValid, false);
+    });
+
+    it('deve rejeitar assinaturas quando o segredo for incorreto', () => {
+      const payload = { event: 'job.created', jobId: 'job-1' };
+      const wrongSecret = 'whsec_wrong_secret_key_abcdefghijklmnop';
+
+      const signature = WebhookCrypto.generateSignature(testSecret, payload);
+      const isValid = WebhookCrypto.verifySignature(wrongSecret, payload, signature);
+      assert.strictEqual(isValid, false);
+    });
+
+    it('deve validar utilitários correspondentes exportados no SDK client', () => {
+      const payload = { event: 'bid.submitted', bidId: 'bid-100', amount: 35.00 };
+      const sdkSignature = generateWebhookSignature(testSecret, payload);
+      assert.strictEqual(sdkSignature.length, 64);
+
+      const isValid = verifyWebhookSignature(testSecret, payload, sdkSignature);
+      assert.strictEqual(isValid, true);
+
+      const client = new DelivreryClient();
+      assert.strictEqual(client.verifyWebhook(testSecret, payload, sdkSignature), true);
+      assert.strictEqual(client.verifyWebhook(testSecret, payload, 'invalid_sig'), false);
+
+      const randomSecret = generateWebhookSecret();
+      assert.ok(randomSecret.startsWith('whsec_'));
+      assert.ok(randomSecret.length >= 32);
+    });
+  });
+
+  describe('Cálculo de Backoff Exponencial (NFR-6, NFR-10)', () => {
+    it('deve calcular corretamente os intervalos de backoff exponencial', () => {
+      const baseDelay = 1000;
+      assert.strictEqual(WebhookDispatcherService.calculateBackoff(1, baseDelay), 0);    // Tentativa 1: Imediata (0ms)
+      assert.strictEqual(WebhookDispatcherService.calculateBackoff(2, baseDelay), 1000); // Tentativa 2: 1 * baseDelay (1000ms)
+      assert.strictEqual(WebhookDispatcherService.calculateBackoff(3, baseDelay), 2000); // Tentativa 3: 2 * baseDelay (2000ms)
+      assert.strictEqual(WebhookDispatcherService.calculateBackoff(4, baseDelay), 4000); // Tentativa 4: 4 * baseDelay (4000ms)
+    });
+  });
+
+  describe('Matriz de I/O & Resiliência do Dispatcher (WebhookDispatcherService)', () => {
+    it('Cenário 1: Despacho com Sucesso (200 OK) na primeira tentativa', async () => {
+      let interceptedHeaders;
+      let interceptedBody;
+
+      const mockFetch = async (url, init) => {
+        interceptedHeaders = init?.headers;
+        interceptedBody = init?.body;
+        return new Response(JSON.stringify({ received: true }), {
+          status: 200,
+          headers: { 'Content-Type': 'application/json' }
+        });
+      };
+
+      const subscription = {
+        id: testSubscriptionId,
+        clientId: 'client-1',
+        targetUrl: testTargetUrl,
+        eventType: 'job.created',
+        secretToken: testSecret,
+        isActive: true
+      };
+
+      const client = {
+        id: 'client-1',
+        clientName: 'PDV Express',
+        apiKeyHash: 'hash-abc',
+        ownerEmail: 'pdv@express.com',
+        allowedCities: ['sao_paulo'],
+        rateLimitRpm: 120,
+        isActive: true
+      };
+
+      const eventData = {
+        job_id: 'job-101',
+        title: 'Entrega Farmácia',
+        city_id: 'sao_paulo'
+      };
+
+      const result = await WebhookDispatcherService.dispatchToSubscription(
+        subscription,
+        client,
+        'job.created',
+        eventData,
+        { fetchFn: mockFetch, baseDelayMs: 10 }
+      );
+
+      assert.strictEqual(result.success, true);
+      assert.strictEqual(result.attempts.length, 1);
+      assert.strictEqual(result.finalStatusCode, 200);
+
+      // Verificação dos headers de segurança obrigatórios (FR-17)
+      const headers = interceptedHeaders;
+      assert.strictEqual(headers['Content-Type'], 'application/json');
+      assert.strictEqual(headers['X-Delivery-Event'], 'job.created');
+      assert.ok(headers['X-Delivery-Timestamp'], 'X-Delivery-Timestamp deve estar presente');
+      assert.ok(headers['X-Signature-SHA256'], 'X-Signature-SHA256 deve estar presente');
+
+      // Verificação da assinatura transmitida
+      const parsedBody = JSON.parse(interceptedBody);
+      assert.strictEqual(parsedBody.event, 'job.created');
+      assert.strictEqual(parsedBody.data.job_id, 'job-101');
+      assert.strictEqual(
+        WebhookCrypto.verifySignature(testSecret, interceptedBody, headers['X-Signature-SHA256']),
+        true
+      );
+    });
+
+    it('Cenário 2: Falha Temporária (500 Server Error) com recuperação na 2ª tentativa', async () => {
+      let callCount = 0;
+
+      const mockFetch = async () => {
+        callCount++;
+        if (callCount === 1) {
+          // 1ª tentativa falha com 500
+          return new Response('Internal Server Error', { status: 500 });
+        }
+        // 2ª tentativa responde 200 OK
+        return new Response(JSON.stringify({ ok: true }), { status: 200 });
+      };
+
+      const subscription = {
+        id: testSubscriptionId,
+        clientId: 'client-1',
+        targetUrl: testTargetUrl,
+        eventType: 'job.accepted',
+        secretToken: testSecret,
+        isActive: true
+      };
+
+      const result = await WebhookDispatcherService.dispatchToSubscription(
+        subscription,
+        undefined,
+        'job.accepted',
+        { job_id: 'job-102', courier_id: 'courier-55' },
+        { fetchFn: mockFetch, baseDelayMs: 10, maxAttempts: 3 }
+      );
+
+      assert.strictEqual(result.success, true);
+      assert.strictEqual(result.attempts.length, 2);
+      assert.strictEqual(result.attempts[0].statusCode, 500);
+      assert.strictEqual(result.attempts[1].statusCode, 200);
+      assert.strictEqual(result.finalStatusCode, 200);
+    });
+
+    it('Cenário 3: Falha Permanente por 4xx do Parceiro (HTTP 404) aborta retentativas imediatamente', async () => {
+      let callCount = 0;
+
+      const mockFetch = async () => {
+        callCount++;
+        return new Response('Not Found', { status: 404 });
+      };
+
+      const subscription = {
+        id: testSubscriptionId,
+        clientId: 'client-1',
+        targetUrl: testTargetUrl,
+        eventType: 'bid.submitted',
+        secretToken: testSecret,
+        isActive: true
+      };
+
+      const result = await WebhookDispatcherService.dispatchToSubscription(
+        subscription,
+        undefined,
+        'bid.submitted',
+        { bid_id: 'bid-99' },
+        { fetchFn: mockFetch, baseDelayMs: 10, maxAttempts: 3 }
+      );
+
+      assert.strictEqual(result.success, false);
+      assert.strictEqual(result.attempts.length, 1, 'Não deve re-tentar após erro 4xx');
+      assert.strictEqual(result.finalStatusCode, 404);
+      assert.ok(result.error?.includes('404'));
+      assert.strictEqual(callCount, 1);
+    });
+
+    it('Cenário 4: Filtragem de Escopo Municipal bloqueia despacho fora de allowed_cities', async () => {
+      let fetchCalled = false;
+      const mockFetch = async () => {
+        fetchCalled = true;
+        return new Response('OK', { status: 200 });
+      };
+
+      const subscription = {
+        id: testSubscriptionId,
+        clientId: 'client-sp-only',
+        targetUrl: testTargetUrl,
+        eventType: 'job.created',
+        secretToken: testSecret,
+        isActive: true
+      };
+
+      const client = {
+        id: 'client-sp-only',
+        clientName: 'Parceiro SP',
+        apiKeyHash: 'hash-xyz',
+        ownerEmail: 'sp@parceiro.com',
+        allowedCities: ['sao_paulo'], // Apenas São Paulo
+        rateLimitRpm: 120,
+        isActive: true
+      };
+
+      // Vaga criada em Campinas (fora de São Paulo)
+      const eventData = {
+        job_id: 'job-campinas-1',
+        city_id: 'campinas'
+      };
+
+      const result = await WebhookDispatcherService.dispatchToSubscription(
+        subscription,
+        client,
+        'job.created',
+        eventData,
+        { fetchFn: mockFetch }
+      );
+
+      assert.strictEqual(result.skipped, true);
+      assert.strictEqual(result.success, false);
+      assert.strictEqual(fetchCalled, false, 'Fetch não deve ser chamado para cidade não autorizada');
+      assert.ok(result.skipReason?.includes('campinas'));
+    });
+
+    it('Cenário 5: Subscrição inativa é ignorada sem efetuar requisições', async () => {
+      let fetchCalled = false;
+      const mockFetch = async () => {
+        fetchCalled = true;
+        return new Response('OK', { status: 200 });
+      };
+
+      const subscription = {
+        id: 'sub-inactive',
+        clientId: 'client-1',
+        targetUrl: testTargetUrl,
+        eventType: 'job.completed',
+        secretToken: testSecret,
+        isActive: false // Subscrição desativada
+      };
+
+      const result = await WebhookDispatcherService.dispatchToSubscription(
+        subscription,
+        undefined,
+        'job.completed',
+        { job_id: 'job-done' },
+        { fetchFn: mockFetch }
+      );
+
+      assert.strictEqual(result.skipped, true);
+      assert.strictEqual(result.skipReason, 'Subscrição inativa');
+      assert.strictEqual(fetchCalled, false);
+    });
+
+    it('Cenário 6: Esgotamento de Tentativas (3 falhas consecutivas de rede / 5xx)', async () => {
+      let callCount = 0;
+
+      const mockFetch = async () => {
+        callCount++;
+        throw new Error('Connection refused by peer');
+      };
+
+      const subscription = {
+        id: testSubscriptionId,
+        clientId: 'client-1',
+        targetUrl: testTargetUrl,
+        eventType: 'job.created',
+        secretToken: testSecret,
+        isActive: true
+      };
+
+      const result = await WebhookDispatcherService.dispatchToSubscription(
+        subscription,
+        undefined,
+        'job.created',
+        { job_id: 'job-fail' },
+        { fetchFn: mockFetch, baseDelayMs: 10, maxAttempts: 3 }
+      );
+
+      assert.strictEqual(result.success, false);
+      assert.strictEqual(result.attempts.length, 3);
+      assert.strictEqual(callCount, 3);
+      assert.ok(result.error?.includes('Connection refused'));
+    });
+
+    it('deve realizar despacho broadcast para múltiplas subscrições ativas via dispatch()', async () => {
+      const dispatchedUrls = [];
+
+      const mockFetch = async (url) => {
+        dispatchedUrls.push(url.toString());
+        return new Response('OK', { status: 200 });
+      };
+
+      WebhookDispatcherService.registerMockSubscription({
+        id: 'sub-1',
+        clientId: 'client-1',
+        targetUrl: 'https://partner1.com/hook',
+        eventType: 'job.created',
+        secretToken: testSecret,
+        isActive: true
+      });
+
+      WebhookDispatcherService.registerMockSubscription({
+        id: 'sub-2',
+        clientId: 'client-2',
+        targetUrl: 'https://partner2.com/hook',
+        eventType: 'job.created',
+        secretToken: testSecret,
+        isActive: true
+      });
+
+      // Subscrição para outro evento (não deve receber)
+      WebhookDispatcherService.registerMockSubscription({
+        id: 'sub-3',
+        clientId: 'client-3',
+        targetUrl: 'https://partner3.com/hook',
+        eventType: 'job.completed',
+        secretToken: testSecret,
+        isActive: true
+      });
+
+      const results = await WebhookDispatcherService.dispatch(
+        'job.created',
+        { job_id: 'job-multi-1' },
+        { fetchFn: mockFetch, baseDelayMs: 5 }
+      );
+
+      assert.strictEqual(results.length, 2);
+      assert.ok(results.every(r => r.success === true));
+      assert.deepStrictEqual(dispatchedUrls.sort(), [
+        'https://partner1.com/hook',
+        'https://partner2.com/hook'
+      ].sort());
+    });
+  });
+});
