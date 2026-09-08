import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { WebhookDispatcherService } from '../apps/pwa/src/api/webhooks/webhook-dispatcher.ts';
import { WebhookCrypto } from '../apps/pwa/src/api/webhooks/webhook-crypto.ts';
import { 
  DelivreryClient, 
  generateWebhookSignature, 
  verifyWebhookSignature,
  generateWebhookSecret 
} from '../packages/api-client-sdk/src/index.js';

describe('Story 5.3: Dispatcher de Webhooks de Saída Assinados Criptograficamente (HMAC-SHA256)', () => {
  const testSecret = 'whsec_test_secret_key_1234567890123456';
  const testSubscriptionId = 'sub-uuid-1234-5678';
  const testTargetUrl = 'https://webhook.site/partner-endpoint';

  beforeEach(() => {
    WebhookDispatcherService.clearMockSubscriptions();
  });

  describe('Algoritmo Criptográfico HMAC-SHA256 (FR-17)', () => {
    it('deve gerar e verificar assinatura HMAC-SHA256 com sucesso', () => {
      const payload = {
        id: 'evt_012345',
        event: 'job.created',
        timestamp: '2026-09-08T18:00:00.000Z',
        data: { jobId: 'job-1', title: 'Entrega Noturna' }
      };

      const signature = WebhookCrypto.generateSignature(testSecret, payload);
      assert.strictEqual(typeof signature, 'string');
      assert.strictEqual(signature.length, 64); // SHA-256 em hex tem 64 caracteres

      // Validação positiva
      const isValid = WebhookCrypto.verifySignature(testSecret, payload, signature);
      assert.strictEqual(isValid, true);

      // Validação positiva com prefixo 'sha256='
      const isValidWithPrefix = WebhookCrypto.verifySignature(testSecret, payload, `sha256=${signature}`);
      assert.strictEqual(isValidWithPrefix, true);
    });

    it('deve rejeitar assinaturas quando o payload for adulterado', () => {
      const payloadOriginal = { event: 'job.created', jobId: 'job-1' };
      const payloadAdulterado = { event: 'job.created', jobId: 'job-999' };

      const signature = WebhookCrypto.generateSignature(testSecret, payloadOriginal);
      const isValid = WebhookCrypto.verifySignature(testSecret, payloadAdulterado, signature);
      assert.strictEqual(isValid, false);
    });

    it('deve rejeitar assinaturas quando o segredo for incorreto', () => {
      const payload = { event: 'job.created', jobId: 'job-1' };
      const wrongSecret = 'whsec_wrong_secret_key_abcdefghijklmnop';

      const signature = WebhookCrypto.generateSignature(testSecret, payload);
      const isValid = WebhookCrypto.verifySignature(wrongSecret, payload, signature);
      assert.strictEqual(isValid, false);
    });

    it('deve validar utilitários correspondentes exportados no SDK client', () => {
      const payload = { event: 'bid.submitted', bidId: 'bid-100', amount: 35.00 };
      const sdkSignature = generateWebhookSignature(testSecret, payload);
      assert.strictEqual(sdkSignature.length, 64);

      const isValid = verifyWebhookSignature(testSecret, payload, sdkSignature);
      assert.strictEqual(isValid, true);

      const client = new DelivreryClient();
      assert.strictEqual(client.verifyWebhook(testSecret, payload, sdkSignature), true);
      assert.strictEqual(client.verifyWebhook(testSecret, payload, 'invalid_sig'), false);

      const randomSecret = generateWebhookSecret();
      assert.ok(randomSecret.startsWith('whsec_'));
      assert.ok(randomSecret.length >= 32);
    });
  });

  describe('Cálculo de Backoff Exponencial (NFR-6, NFR-10)', () => {
    it('deve calcular corretamente os intervalos de backoff exponencial', () => {
      const baseDelay = 1000;
      assert.strictEqual(WebhookDispatcherService.calculateBackoff(1, baseDelay), 0);    // Tentativa 1: Imediata (0ms)
      assert.strictEqual(WebhookDispatcherService.calculateBackoff(2, baseDelay), 1000); // Tentativa 2: 1 * baseDelay (1000ms)
      assert.strictEqual(WebhookDispatcherService.calculateBackoff(3, baseDelay), 2000); // Tentativa 3: 2 * baseDelay (2000ms)
      assert.strictEqual(WebhookDispatcherService.calculateBackoff(4, baseDelay), 4000); // Tentativa 4: 4 * baseDelay (4000ms)
    });
  });

  describe('Matriz de I/O & Resiliência do Dispatcher (WebhookDispatcherService)', () => {
    it('Cenário 1: Despacho com Sucesso (200 OK) na primeira tentativa', async () => {
      let interceptedHeaders;
      let interceptedBody;

      const mockFetch = async (url, init) => {
        interceptedHeaders = init?.headers;
        interceptedBody = init?.body;
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const subscription = {
        id: testSubscriptionId,
        clientId: 'client-1',
        targetUrl: testTargetUrl,
        eventType: 'job.created',
        secretToken: testSecret,
        isActive: true
      };

      const client = {
        id: 'client-1',
        clientName: 'PDV Express',
        apiKeyHash: 'hash-abc',
        ownerEmail: 'pdv@express.com',
        allowedCities: ['sao_paulo'],
        rateLimitRpm: 120,
        isActive: true
      };

      const eventData = {
        job_id: 'job-101',
        title: 'Entrega Farmácia',
        city_id: 'sao_paulo'
      };

      const result = await WebhookDispatcherService.dispatchToSubscription(
        subscription,
        client,
        'job.created',
        eventData,
        { fetchFn: mockFetch, baseDelayMs: 10 }
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.attempts.length, 1);
      assert.strictEqual(result.finalStatusCode, 200);

      // Verificação dos headers de segurança obrigatórios (FR-17)
      const headers = interceptedHeaders;
      assert.strictEqual(headers['Content-Type'], 'application/json');
      assert.strictEqual(headers['X-Delivery-Event'], 'job.created');
      assert.ok(headers['X-Delivery-Timestamp'], 'X-Delivery-Timestamp deve estar presente');
      assert.ok(headers['X-Signature-SHA256'], 'X-Signature-SHA256 deve estar presente');

      // Verificação da assinatura transmitida
      const parsedBody = JSON.parse(interceptedBody);
      assert.strictEqual(parsedBody.event, 'job.created');
      assert.strictEqual(parsedBody.data.job_id, 'job-101');
      assert.strictEqual(
        WebhookCrypto.verifySignature(testSecret, interceptedBody, headers['X-Signature-SHA256']),
        true
      );
    });

    it('Cenário 2: Falha Temporária (500 Server Error) com recuperação na 2ª tentativa', async () => {
      let callCount = 0;

      const mockFetch = async () => {
        callCount++;
        if (callCount === 1) {
          // 1ª tentativa falha com 500
          return new Response('Internal Server Error', { status: 500 });
        }
        // 2ª tentativa responde 200 OK
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      };

      const subscription = {
        id: testSubscriptionId,
        clientId: 'client-1',
        targetUrl: testTargetUrl,
        eventType: 'job.accepted',
        secretToken: testSecret,
        isActive: true
      };

      const result = await WebhookDispatcherService.dispatchToSubscription(
        subscription,
        undefined,
        'job.accepted',
        { job_id: 'job-102', courier_id: 'courier-55' },
        { fetchFn: mockFetch, baseDelayMs: 10, maxAttempts: 3 }
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.attempts.length, 2);
      assert.strictEqual(result.attempts[0].statusCode, 500);
      assert.strictEqual(result.attempts[1].statusCode, 200);
      assert.strictEqual(result.finalStatusCode, 200);
    });

    it('Cenário 3: Falha Permanente por 4xx do Parceiro (HTTP 404) aborta retentativas imediatamente', async () => {
      let callCount = 0;

      const mockFetch = async () => {
        callCount++;
        return new Response('Not Found', { status: 404 });
      };

      const subscription = {
        id: testSubscriptionId,
        clientId: 'client-1',
        targetUrl: testTargetUrl,
        eventType: 'bid.submitted',
        secretToken: testSecret,
        isActive: true
      };

      const result = await WebhookDispatcherService.dispatchToSubscription(
        subscription,
        undefined,
        'bid.submitted',
        { bid_id: 'bid-99' },
        { fetchFn: mockFetch, baseDelayMs: 10, maxAttempts: 3 }
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.attempts.length, 1, 'Não deve re-tentar após erro 4xx');
      assert.strictEqual(result.finalStatusCode, 404);
      assert.ok(result.error?.includes('404'));
      assert.strictEqual(callCount, 1);
    });

    it('Cenário 4: Filtragem de Escopo Municipal bloqueia despacho fora de allowed_cities', async () => {
      let fetchCalled = false;
      const mockFetch = async () => {
        fetchCalled = true;
        return new Response('OK', { status: 200 });
      };

      const subscription = {
        id: testSubscriptionId,
        clientId: 'client-sp-only',
        targetUrl: testTargetUrl,
        eventType: 'job.created',
        secretToken: testSecret,
        isActive: true
      };

      const client = {
        id: 'client-sp-only',
        clientName: 'Parceiro SP',
        apiKeyHash: 'hash-xyz',
        ownerEmail: 'sp@parceiro.com',
        allowedCities: ['sao_paulo'], // Apenas São Paulo
        rateLimitRpm: 120,
        isActive: true
      };

      // Vaga criada em Campinas (fora de São Paulo)
      const eventData = {
        job_id: 'job-campinas-1',
        city_id: 'campinas'
      };

      const result = await WebhookDispatcherService.dispatchToSubscription(
        subscription,
        client,
        'job.created',
        eventData,
        { fetchFn: mockFetch }
      );

      assert.strictEqual(result.skipped, true);
      assert.strictEqual(result.success, false);
      assert.strictEqual(fetchCalled, false, 'Fetch não deve ser chamado para cidade não autorizada');
      assert.ok(result.skipReason?.includes('campinas'));
    });

    it('Cenário 5: Subscrição inativa é ignorada sem efetuar requisições', async () => {
      let fetchCalled = false;
      const mockFetch = async () => {
        fetchCalled = true;
        return new Response('OK', { status: 200 });
      };

      const subscription = {
        id: 'sub-inactive',
        clientId: 'client-1',
        targetUrl: testTargetUrl,
        eventType: 'job.completed',
        secretToken: testSecret,
        isActive: false // Subscrição desativada
      };

      const result = await WebhookDispatcherService.dispatchToSubscription(
        subscription,
        undefined,
        'job.completed',
        { job_id: 'job-done' },
        { fetchFn: mockFetch }
      );

      assert.strictEqual(result.skipped, true);
      assert.strictEqual(result.skipReason, 'Subscrição inativa');
      assert.strictEqual(fetchCalled, false);
    });

    it('Cenário 6: Esgotamento de Tentativas (3 falhas consecutivas de rede / 5xx)', async () => {
      let callCount = 0;

      const mockFetch = async () => {
        callCount++;
        throw new Error('Connection refused by peer');
      };

      const subscription = {
        id: testSubscriptionId,
        clientId: 'client-1',
        targetUrl: testTargetUrl,
        eventType: 'job.created',
        secretToken: testSecret,
        isActive: true
      };

      const result = await WebhookDispatcherService.dispatchToSubscription(
        subscription,
        undefined,
        'job.created',
        { job_id: 'job-fail' },
        { fetchFn: mockFetch, baseDelayMs: 10, maxAttempts: 3 }
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.attempts.length, 3);
      assert.strictEqual(callCount, 3);
      assert.ok(result.error?.includes('Connection refused'));
    });

    it('deve realizar despacho broadcast para múltiplas subscrições ativas via dispatch()', async () => {
      const dispatchedUrls = [];

      const mockFetch = async (url) => {
        dispatchedUrls.push(url.toString());
        return new Response('OK', { status: 200 });
      };

      WebhookDispatcherService.registerMockSubscription({
        id: 'sub-1',
        clientId: 'client-1',
        targetUrl: 'https://partner1.com/hook',
        eventType: 'job.created',
        secretToken: testSecret,
        isActive: true
      });

      WebhookDispatcherService.registerMockSubscription({
        id: 'sub-2',
        clientId: 'client-2',
        targetUrl: 'https://partner2.com/hook',
        eventType: 'job.created',
        secretToken: testSecret,
        isActive: true
      });

      // Subscrição para outro evento (não deve receber)
      WebhookDispatcherService.registerMockSubscription({
        id: 'sub-3',
        clientId: 'client-3',
        targetUrl: 'https://partner3.com/hook',
        eventType: 'job.completed',
        secretToken: testSecret,
        isActive: true
      });

      const results = await WebhookDispatcherService.dispatch(
        'job.created',
        { job_id: 'job-multi-1' },
        { fetchFn: mockFetch, baseDelayMs: 5 }
      );

      assert.strictEqual(results.length, 2);
      assert.ok(results.every(r => r.success === true));
      assert.deepStrictEqual(dispatchedUrls.sort(), [
        'https://partner1.com/hook',
        'https://partner2.com/hook'
      ].sort());
    });
  });
});
