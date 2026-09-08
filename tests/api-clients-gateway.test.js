import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ApiGatewayService } from '../apps/pwa/src/api/gateway/api-gateway-service.ts';
import { 
  DelivreryClient, 
  hashApiKey, 
  generateApiKey, 
  generateWebhookSecret 
} from '../packages/api-client-sdk/src/index.js';

describe('Story 5.1: Schema de Clientes de API, Webhooks e Gateway de Validação (FR-3, FR-16, FR-17, NFR-5)', () => {
  beforeEach(() => {
    ApiGatewayService.clearMockClients();
  });

  describe('Matriz de I/O & Edge Cases do API Gateway', () => {
    it('Cenário 1: Autenticação Válida (Nacional) com allowed_cities=["*"]', async () => {
      const rawKey = 'dlv_live_abc123national';
      const keyHash = hashApiKey(rawKey);

      ApiGatewayService.registerMockClient({
        id: 'client-1111-uuid',
        clientName: 'Portal Municipal Nacional',
        apiKeyHash: keyHash,
        ownerEmail: 'tech@prefeitura.gov.br',
        allowedCities: ['*'],
        rateLimitRpm: 600,
        isActive: true
      });

      const response = await ApiGatewayService.handleGatewayRequest(
        {
          method: 'GET',
          url: '/api/v1/jobs?city_id=rio_de_janeiro',
          headers: {
            'x-api-key': rawKey
          },
          queryParams: {
            city_id: 'rio_de_janeiro'
          }
        },
        async (client) => {
          return {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { message: 'sucesso', clientId: client.id, rpm: client.rateLimitRpm }
          };
        }
      );

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers['X-RateLimit-Limit'], '600');
      assert.strictEqual(response.body.message, 'sucesso');
      assert.strictEqual(response.body.clientId, 'client-1111-uuid');
    });

    it('Cenário 2: Autenticação Válida (Cidade Permitida) com escopo regional', async () => {
      const rawKey = 'dlv_live_xyz789regional';
      const keyHash = hashApiKey(rawKey);

      ApiGatewayService.registerMockClient({
        id: 'client-2222-uuid',
        clientName: 'Cardápio Digital SP',
        apiKeyHash: keyHash,
        ownerEmail: 'integracao@cardapio.com',
        allowedCities: ['sao_paulo', 'santos'],
        rateLimitRpm: 120,
        isActive: true
      });

      const response = await ApiGatewayService.handleGatewayRequest(
        {
          method: 'POST',
          url: '/api/v1/jobs',
          headers: {
            'X-API-Key': rawKey
          },
          body: {
            city_id: 'São Paulo' // Testa normalização com acento e maiúsculas
          }
        },
        async (client) => {
          return {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
            body: { created: true, clientName: client.clientName }
          };
        }
      );

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.headers['X-RateLimit-Limit'], '120');
      assert.strictEqual(response.body.created, true);
      assert.strictEqual(response.body.clientName, 'Cardápio Digital SP');
    });

    it('Cenário 3: Chave Ausente - Rejeição com HTTP 401 e Problem Details RFC 7807', async () => {
      const response = await ApiGatewayService.handleGatewayRequest(
        {
          method: 'GET',
          url: '/api/v1/jobs?city_id=curitiba',
          headers: {}
        },
        async () => {
          return { status: 200, headers: {}, body: {} };
        }
      );

      assert.strictEqual(response.status, 401);
      assert.ok(response.headers['Content-Type'].includes('application/problem+json'));
      assert.strictEqual(response.body.status, 401);
      assert.strictEqual(response.body.title, 'Não Autorizado');
      assert.ok(response.body.detail.includes('X-API-Key ausente ou inválido'));
      assert.strictEqual(response.body.instance, '/api/v1/jobs?city_id=curitiba');
    });

    it('Cenário 4: Chave Inválida ou Revogada (is_active=false) - Rejeição com HTTP 401 RFC 7807', async () => {
      // 4a: Chave inexistente
      const respInvalid = await ApiGatewayService.handleGatewayRequest(
        {
          method: 'GET',
          url: '/api/v1/jobs',
          headers: { 'X-API-Key': 'dlv_invalid_key_999' }
        },
        async () => ({ status: 200, headers: {}, body: {} })
      );

      assert.strictEqual(respInvalid.status, 401);
      assert.strictEqual(respInvalid.body.status, 401);
      assert.ok(respInvalid.body.detail.includes('inválida, revogada ou inativa'));

      // 4b: Cliente revogado/inativo
      const rawRevoked = 'dlv_live_revoked_client';
      ApiGatewayService.registerMockClient({
        id: 'client-revoked',
        clientName: 'Parceiro Desativado',
        apiKeyHash: hashApiKey(rawRevoked),
        ownerEmail: 'blocked@parceiro.com',
        allowedCities: ['*'],
        rateLimitRpm: 120,
        isActive: false
      });

      const respRevoked = await ApiGatewayService.handleGatewayRequest(
        {
          method: 'GET',
          url: '/api/v1/jobs',
          headers: { 'X-API-Key': rawRevoked }
        },
        async () => ({ status: 200, headers: {}, body: {} })
      );

      assert.strictEqual(respRevoked.status, 401);
      assert.strictEqual(respRevoked.body.status, 401);
      assert.ok(respRevoked.body.detail.includes('inválida, revogada ou inativa'));
    });

    it('Cenário 5: Escopo Geográfico Não Autorizado - Rejeição com HTTP 403 RFC 7807', async () => {
      const rawKey = 'dlv_live_curitiba_only';
      ApiGatewayService.registerMockClient({
        id: 'client-curitiba-only',
        clientName: 'Parceiro Curitiba',
        apiKeyHash: hashApiKey(rawKey),
        ownerEmail: 'cwb@parceiro.com',
        allowedCities: ['curitiba'],
        rateLimitRpm: 120,
        isActive: true
      });

      const response = await ApiGatewayService.handleGatewayRequest(
        {
          method: 'GET',
          url: '/api/v1/jobs?city_id=sao_paulo',
          headers: { 'X-API-Key': rawKey },
          queryParams: { city_id: 'sao_paulo' }
        },
        async () => ({ status: 200, headers: {}, body: {} })
      );

      assert.strictEqual(response.status, 403);
      assert.ok(response.headers['Content-Type'].includes('application/problem+json'));
      assert.strictEqual(response.body.status, 403);
      assert.strictEqual(response.body.title, 'Acesso Não Autorizado para Município');
      assert.ok(response.body.detail.includes('sao_paulo'));
    });

    it('Cenário 6: Subscrição de Webhook Válida e Registro', () => {
      const validSub = {
        clientId: 'client-1111-uuid',
        targetUrl: 'https://api.parceiro.com/webhooks/delivrery',
        eventType: 'job.created',
        secretToken: 'whsec_test_secret_token_1234567890',
        isActive: true
      };

      const result = ApiGatewayService.validateWebhookSubscription(validSub);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('Cenário 7: Evento de Webhook Inválido ou URL Malformatada - Rejeição de Validação', () => {
      const invalidSub = {
        clientId: 'client-1111-uuid',
        targetUrl: 'invalid-not-a-url',
        eventType: 'invalid.event.type',
        secretToken: 'short'
      };

      const result = ApiGatewayService.validateWebhookSubscription(invalidSub);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('target_url')));
      assert.ok(result.errors.some(e => e.includes('event_type')));
      assert.ok(result.errors.some(e => e.includes('secret_token')));
    });
  });

  describe('Utilitários Criptográficos e Suporte no SDK', () => {
    it('deve calcular hash SHA-256 idempotente e consistente', () => {
      const key = 'dlv_live_mysecretkey123';
      const hash1 = hashApiKey(key);
      const hash2 = ApiGatewayService.hashApiKey(key);

      assert.strictEqual(hash1.length, 64);
      assert.strictEqual(hash1, hash2);
      assert.strictEqual(/^[0-9a-f]{64}$/.test(hash1), true);
    });

    it('deve gerar credenciais seguras com formato padronizado', () => {
      const liveKey = generateApiKey('dlv_live', 24);
      const testKey = generateApiKey('dlv_test', 24);
      const webhookSecret = generateWebhookSecret(32);

      assert.ok(liveKey.startsWith('dlv_live_'));
      assert.ok(testKey.startsWith('dlv_test_'));
      assert.ok(webhookSecret.startsWith('whsec_'));
      assert.ok(liveKey.length >= 40);
      assert.ok(webhookSecret.length >= 40);
    });

    it('deve configurar DelivreryClient com X-API-Key e despachar nos headers', async () => {
      let capturedHeaders = null;
      const mockFetch = async (url, options) => {
        capturedHeaders = options.headers;
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok' })
        };
      };

      const client = new DelivreryClient({
        apiKey: 'dlv_live_client_test_key',
        fetch: mockFetch
      });

      await client.getPricingStats({
        city_id: 'rio_de_janeiro',
        neighborhood_id: 'copacabana'
      });

      assert.ok(capturedHeaders);
      assert.strictEqual(capturedHeaders['X-API-Key'], 'dlv_live_client_test_key');
      assert.strictEqual(capturedHeaders['Authorization'], 'Bearer dlv_live_client_test_key');
    });

    it('deve suportar preflight CORS (OPTIONS) com status 204 no gateway', async () => {
      const response = await ApiGatewayService.handleGatewayRequest(
        {
          method: 'OPTIONS',
          url: '/api/v1/jobs'
        },
        async () => ({ status: 200, headers: {}, body: {} })
      );

      assert.strictEqual(response.status, 204);
      assert.strictEqual(response.headers['Access-Control-Allow-Origin'], '*');
      assert.ok(response.headers['Access-Control-Allow-Headers'].includes('X-API-Key'));
      assert.strictEqual(response.body, null);
    });

    it('deve extrair API Key de instância de Headers (Web API) e Authorization Bearer', () => {
      const headersMap = new Map();
      headersMap.set('x-api-key', 'dlv_live_headers_map_key');
      const mockWebHeaders = {
        get: (key) => headersMap.get(key.toLowerCase()) || null
      };

      const extracted = ApiGatewayService.extractApiKey(mockWebHeaders);
      assert.strictEqual(extracted, 'dlv_live_headers_map_key');

      // Teste com Bearer em mock Headers
      const bearerMap = new Map();
      bearerMap.set('authorization', 'Bearer dlv_test_bearer_token_123');
      const mockBearerHeaders = {
        get: (key) => bearerMap.get(key.toLowerCase()) || null
      };

      const extractedBearer = ApiGatewayService.extractApiKey(mockBearerHeaders);
      assert.strictEqual(extractedBearer, 'dlv_test_bearer_token_123');
    });

    it('deve extrair city_id a partir de payload JSON stringificado no body', () => {
      const reqWithStringBody = {
        method: 'POST',
        url: '/api/v1/jobs',
        body: JSON.stringify({ city_id: 'porto_alegre', title: 'Entrega Expressa' })
      };

      const city = ApiGatewayService.extractCityId(reqWithStringBody);
      assert.strictEqual(city, 'porto_alegre');
    });
  });

  describe('Integridade da Migration DDL e Políticas RLS (20260908130000)', () => {
    it('deve verificar a existência e consistência do arquivo SQL de migration', () => {
      const migrationPath = resolve(
        process.cwd(),
        'supabase/migrations/20260908130000_api_clients_and_webhooks_schema.sql'
      );

      assert.strictEqual(existsSync(migrationPath), true, 'O arquivo de migration DDL deve existir.');
      const sql = readFileSync(migrationPath, 'utf8');

      // Tabelas
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.api_clients'), 'Deve criar api_clients');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.webhooks_subscriptions'), 'Deve criar webhooks_subscriptions');

      // Colunas em tabelas existentes
      assert.ok(sql.includes('ALTER TABLE public.users'), 'Deve alterar users para adicionar origin_client_id');
      assert.ok(sql.includes('ALTER TABLE public.job_posts'), 'Deve alterar job_posts para adicionar origin_client_id');

      // Constraints
      assert.ok(sql.includes('check_api_clients_key_hash_len'), 'Deve validar 64 caracteres do hash');
      assert.ok(sql.includes('check_webhook_event_type'), 'Deve validar os 4 eventos canônicos de webhook');
      assert.ok(sql.includes('check_api_clients_rate_limit_positive'), 'Deve validar rate_limit > 0');

      // RLS (NFR-5)
      assert.ok(sql.includes('ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY'), 'RLS ativo em api_clients');
      assert.ok(sql.includes('ALTER TABLE public.webhooks_subscriptions ENABLE ROW LEVEL SECURITY'), 'RLS ativo em webhooks_subscriptions');
      assert.ok(sql.includes('api_clients_service_role_all'), 'Policy para service_role em api_clients');
      assert.ok(sql.includes('webhooks_subscriptions_service_role_all'), 'Policy para service_role em webhooks_subscriptions');

      // Função utilitária de banco
      assert.ok(sql.includes('FUNCTION public.validate_api_client_access'), 'Função de validação de gateway no banco');
    });
  });
});
