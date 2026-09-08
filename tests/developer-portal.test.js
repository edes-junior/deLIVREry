import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import { openApiSpec } from '../apps/pwa/src/api/openapi/openapi-spec.ts';
import { HeadlessApiRouter } from '../apps/pwa/src/api/headless/headless-api-router.ts';
import { ApiGatewayService } from '../apps/pwa/src/api/gateway/api-gateway-service.ts';
import { WebhookDispatcherService } from '../apps/pwa/src/api/webhooks/webhook-dispatcher.ts';
import { WebhookCrypto } from '../apps/pwa/src/api/webhooks/webhook-crypto.ts';
import { 
  generateApiKey, 
  hashApiKey, 
  generateWebhookSecret, 
  verifyWebhookSignature 
} from '../packages/api-client-sdk/src/index.js';

describe('Story 5.4: Portal do Desenvolvedor (/developers) com Swagger UI Interativo', () => {
  const testApiKey = 'dlv_live_portal_test_developer_key';
  const testClientId = 'client_portal_uuid';

  beforeEach(() => {
    ApiGatewayService.clearMockClients();
    WebhookDispatcherService.clearMockSubscriptions();
    HeadlessApiRouter.clearMocks();

    // Registra cliente base
    ApiGatewayService.registerMockClient({
      id: testClientId,
      clientName: 'Portal Developer Client',
      apiKeyHash: hashApiKey(testApiKey),
      ownerEmail: 'dev@delivrery.app.br',
      allowedCities: ['*'],
      rateLimitRpm: 120,
      isActive: true
    });
  });

  describe('Cenário 1: Exploração e Validação da Especificação OpenAPI 3.0', () => {
    it('deve conter metadados e tags canônicas da API Headless', () => {
      assert.strictEqual(openApiSpec.openapi, '3.0.3');
      assert.strictEqual(openApiSpec.info.title, 'deLIVREry Headless API');
      assert.ok(openApiSpec.servers.some(s => s.url.includes('delivrery') || s.url.includes('api/v1') || s.url.includes('54321')));
      assert.ok(openApiSpec.tags.length >= 4);

      const tagNames = openApiSpec.tags.map(t => t.name);
      assert.ok(tagNames.includes('Entregadores (Couriers)'));
      assert.ok(tagNames.includes('Lojistas (Stores)'));
      assert.ok(tagNames.includes('Vagas e Turnos (Jobs)'));
      assert.ok(tagNames.includes('Matching e Propostas (Bids)'));
    });

    it('deve mapear os 4 endpoints canônicos com schemas de resposta e RFC 7807', () => {
      const paths = openApiSpec.paths;
      assert.ok(paths['/api/v1/couriers']?.post, 'Endpoint POST /api/v1/couriers deve existir');
      assert.ok(paths['/api/v1/stores']?.post, 'Endpoint POST /api/v1/stores deve existir');
      assert.ok(paths['/api/v1/jobs']?.get, 'Endpoint GET /api/v1/jobs deve existir');
      assert.ok(paths['/api/v1/bids/{id}/accept']?.post, 'Endpoint POST /api/v1/bids/{id}/accept deve existir');

      // Verifica suporte a RFC 7807 Problem Details nos erros 400, 403, 404, 429
      const jobResponses = paths['/api/v1/jobs'].get.responses;
      assert.ok(jobResponses['400']?.content?.['application/problem+json']);
      assert.ok(jobResponses['403']?.content?.['application/problem+json']);
      assert.ok(jobResponses['429']?.content?.['application/problem+json']);
    });
  });

  describe('Cenário 2 & 3: Emissão de API Keys com Escopo Municipal e Validações', () => {
    it('deve gerar nova API Key nacional (allowed_cities: ["*"]) e registrar hash SHA-256', async () => {
      const clientName = 'Cardápio Digital Parceiro';
      const ownerEmail = 'tech@cardapio.com.br';
      const isNational = true;
      const rateLimitRpm = 120;

      const rawKey = generateApiKey('dlv_live');
      assert.ok(rawKey.startsWith('dlv_live_'));
      assert.ok(rawKey.length >= 30);

      const keyHash = hashApiKey(rawKey);
      assert.strictEqual(keyHash.length, 64);

      const allowedCities = isNational ? ['*'] : ['sao_paulo'];
      const newClient = {
        id: 'client_new_1',
        clientName,
        apiKeyHash: keyHash,
        ownerEmail,
        allowedCities,
        rateLimitRpm,
        isActive: true
      };

      ApiGatewayService.registerMockClient(newClient);

      // Validação de autenticação imediata no gateway com a chave gerada
      const authResult = await ApiGatewayService.authenticateRequest({
        method: 'GET',
        url: '/api/v1/jobs?city_id=sao_paulo',
        headers: { 'X-API-Key': rawKey },
        cityId: 'sao_paulo'
      });

      assert.strictEqual(authResult.isAuthenticated, true);
      assert.strictEqual(authResult.isAuthorized, true);
      assert.strictEqual(authResult.client?.clientName, clientName);
    });

    it('deve gerar API Key com escopo restrito de municípios e aplicar trava geográfica', async () => {
      const rawKey = generateApiKey('dlv_live');
      const keyHash = hashApiKey(rawKey);

      ApiGatewayService.registerMockClient({
        id: 'client_sp_only',
        clientName: 'Prefeitura SP Integrador',
        apiKeyHash: keyHash,
        ownerEmail: 'portal@prefeitura.sp.gov.br',
        allowedCities: ['sao_paulo'],
        rateLimitRpm: 600,
        isActive: true
      });

      // Acesso em São Paulo -> Autorizado
      const authSP = await ApiGatewayService.authenticateRequest({
        method: 'GET',
        url: '/api/v1/jobs?city_id=sao_paulo',
        headers: { 'X-API-Key': rawKey },
        cityId: 'sao_paulo'
      });
      assert.strictEqual(authSP.isAuthorized, true);

      // Acesso no Rio de Janeiro -> Bloqueado com 403 Forbidden
      const authRJ = await ApiGatewayService.authenticateRequest({
        method: 'GET',
        url: '/api/v1/jobs?city_id=rio_de_janeiro',
        headers: { 'X-API-Key': rawKey },
        cityId: 'rio_de_janeiro'
      });
      assert.strictEqual(authRJ.isAuthorized, false);
      assert.strictEqual(authRJ.statusCode, 403);
      assert.strictEqual(authRJ.problem?.type, 'https://delivrery.app.br/errors/forbidden');
    });
  });

  describe('Cenário 4: Execução Interativa no Console (Try It Out)', () => {
    it('deve simular consulta de vagas via HeadlessApiRouter e retornar status 200 com JSON', async () => {
      const response = await HeadlessApiRouter.handle({
        method: 'GET',
        url: '/api/v1/jobs?city_id=sao_paulo&transport_modal=motorcycle',
        headers: {
          'X-API-Key': testApiKey,
          'Content-Type': 'application/json'
        },
        queryParams: {
          city_id: 'sao_paulo',
          transport_modal: 'motorcycle'
        },
        cityId: 'sao_paulo'
      });

      assert.strictEqual(response.status, 200);
      assert.ok(response.body.success === true);
      assert.ok(Array.isArray(response.body.jobs));
      assert.ok(response.headers['Content-Type'].includes('application/json'));
    });

    it('deve retornar RFC 7807 Problem Details quando chave não for fornecida no console', async () => {
      const response = await HeadlessApiRouter.handle({
        method: 'GET',
        url: '/api/v1/jobs?city_id=sao_paulo',
        headers: {},
        cityId: 'sao_paulo'
      });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.type, 'https://delivrery.app.br/errors/unauthorized');
      assert.ok(response.body.title);
      assert.ok(response.body.detail);
    });
  });

  describe('Cenário 5: Testador e Simulador de Webhooks (HMAC-SHA256)', () => {
    it('deve cadastrar subscrição e despachar ping de teste com assinatura HMAC válida', async () => {
      const secret = generateWebhookSecret();
      const targetUrl = 'https://webhook.site/portal-test-endpoint';

      let receivedHeaders = null;
      let receivedBody = null;

      const mockFetch = async (url, init) => {
        receivedHeaders = init.headers;
        receivedBody = init.body;
        return new Response(JSON.stringify({ status: 'ok', received: true }), { status: 200 });
      };

      const subscription = {
        id: 'sub_test_portal',
        clientId: testClientId,
        targetUrl,
        eventType: 'job.created',
        secretToken: secret,
        isActive: true
      };

      const eventData = {
        job_id: 'job_sample_123',
        title: 'Turno Teste Portal',
        city_id: 'sao_paulo'
      };

      const result = await WebhookDispatcherService.dispatchToSubscription(
        subscription,
        undefined,
        'job.created',
        eventData,
        { fetchFn: mockFetch, baseDelayMs: 10 }
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.attempts.length, 1);
      assert.ok(receivedHeaders['X-Signature-SHA256']);
      assert.strictEqual(receivedHeaders['X-Delivery-Event'], 'job.created');

      // Verifica que a assinatura recebida confere com o utilitário do SDK
      const isValid = verifyWebhookSignature(secret, receivedBody, receivedHeaders['X-Signature-SHA256']);
      assert.strictEqual(isValid, true);
    });
  });

  describe('Cenário 6: Integridade Estrutural e Arquitetural dos Componentes do Portal', () => {
    it('deve verificar a existência de todos os arquivos de componentes criados na Story 5.4', () => {
      const filesToCheck = [
        'apps/pwa/src/components/developers/SwaggerDocsViewer.tsx',
        'apps/pwa/src/components/developers/ApiKeyGeneratorModal.tsx',
        'apps/pwa/src/components/developers/WebhookTester.tsx',
        'apps/pwa/src/components/developers/DeveloperPortal.tsx',
        'apps/developer-portal/src/App.tsx',
        'apps/developer-portal/src/main.tsx',
        'apps/developer-portal/index.html'
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.resolve(process.cwd(), relPath);
        assert.ok(fs.existsSync(fullPath), `Arquivo ${relPath} deve existir`);
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(content.length > 50, `Arquivo ${relPath} não deve estar vazio`);
      }
    });

    it('deve garantir alvos de toque >= 48px nos botões interativos do DeveloperPortal (NFR-9)', () => {
      const portalPath = path.resolve(process.cwd(), 'apps/pwa/src/components/developers/DeveloperPortal.tsx');
      const content = fs.readFileSync(portalPath, 'utf8');
      assert.ok(content.includes("minHeight: '48px'"), 'Botões do DeveloperPortal devem possuir minHeight >= 48px');
    });

    it('deve validar a integração do DeveloperPortal e rota no App.tsx', () => {
      const appPath = path.resolve(process.cwd(), 'apps/pwa/src/App.tsx');
      const content = fs.readFileSync(appPath, 'utf8');
      assert.ok(content.includes("import { DeveloperPortal }"), 'App.tsx deve importar DeveloperPortal');
      assert.ok(content.includes("currentView === 'developers'"), 'App.tsx deve conter controle de visão developers');
      assert.ok(content.includes("data-testid=\"header-btn-developers\""), 'App.tsx deve conter botão de acesso no cabeçalho');
    });
  });
});
