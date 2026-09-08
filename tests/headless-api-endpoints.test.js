import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { HeadlessApiRouter } from '../apps/pwa/src/api/headless/headless-api-router.ts';
import { ApiGatewayService } from '../apps/pwa/src/api/gateway/api-gateway-service.ts';
import { RateLimiterService } from '../apps/pwa/src/api/gateway/rate-limiter.ts';
import { openApiSpec } from '../apps/pwa/src/api/openapi/openapi-spec.ts';
import { DelivreryClient, hashApiKey } from '../packages/api-client-sdk/src/index.js';

describe('Story 5.2: Endpoints RESTful Headless de Gestão de Vagas e Perfis (FR-16, NFR-5, NFR-7)', () => {
  const testApiKey = 'dlv_live_headless_test_partner';
  const testClientId = 'client-headless-uuid';

  beforeEach(() => {
    ApiGatewayService.clearMockClients();
    RateLimiterService.clearLimits();
    HeadlessApiRouter.clearMocks();

    // Registra tenant parceiro autorizado para testes
    ApiGatewayService.registerMockClient({
      id: testClientId,
      clientName: 'Parceiro PDV Integrador',
      apiKeyHash: hashApiKey(testApiKey),
      ownerEmail: 'pdv@parceiro.com.br',
      allowedCities: ['sao_paulo', 'rio_de_janeiro'],
      rateLimitRpm: 120,
      isActive: true
    });
  });

  describe('Matriz de I/O & Edge Cases dos Endpoints Headless', () => {
    it('Cenário 1: Cadastro de Entregador Válido (POST /api/v1/couriers)', async () => {
      const response = await HeadlessApiRouter.handle({
        method: 'POST',
        url: '/api/v1/couriers',
        headers: { 'X-API-Key': testApiKey },
        body: {
          fullName: 'Carlos da Silva Motoboy',
          cpf: '12345678909', // CPF válido no validador
          phoneNumber: '11987654321',
          transportModal: 'motorcycle',
          baseDailyRate: 100.00,
          baseDeliveryFee: 7.50,
          cityId: 'sao_paulo',
          stateId: 'SP',
          homeNeighborhoodId: 'pinheiros'
        }
      });

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.body.success, true);
      assert.ok(response.body.courier);
      assert.strictEqual(response.body.courier.fullName, 'Carlos da Silva Motoboy');
      assert.strictEqual(response.body.courier.transportModal, 'motorcycle');
      assert.strictEqual(response.body.courier.originClientId, testClientId);
      assert.ok(response.body.courier.referralCode.startsWith('LIVRE-'));
      assert.strictEqual(response.headers['X-RateLimit-Limit'], '120');
      assert.strictEqual(response.headers['X-RateLimit-Remaining'], '119');
    });

    it('Cenário 2: Cadastro de Lojista Válido (POST /api/v1/stores)', async () => {
      const response = await HeadlessApiRouter.handle({
        method: 'POST',
        url: '/api/v1/stores',
        headers: { 'X-API-Key': testApiKey },
        body: {
          storeName: 'Pizzaria Napolitana Headless',
          fullName: 'Giovanni Rossi',
          cpf: '12345678909',
          phoneNumber: '11988887777',
          addressStreet: 'Rua Augusta',
          addressNumber: '1500',
          cityId: 'sao_paulo',
          stateId: 'SP',
          neighborhoodId: 'consolacao'
        }
      });

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.body.success, true);
      assert.ok(response.body.store);
      assert.strictEqual(response.body.store.storeName, 'Pizzaria Napolitana Headless');
      assert.strictEqual(response.body.store.reputationScore, 5.00);
      assert.strictEqual(response.body.store.originClientId, testClientId);
    });

    it('Cenário 3: Listagem de Vagas por Cidade (GET /api/v1/jobs?city_id=...)', async () => {
      HeadlessApiRouter.setMockJobs([
        {
          id: 'job-1',
          store_id: 'store-1',
          city_id: 'sao_paulo',
          neighborhood_id: 'pinheiros',
          shift_start_time: '2026-09-08T18:00:00Z',
          shift_end_time: '2026-09-08T23:00:00Z',
          offered_daily_rate: 90.00,
          offered_delivery_fee: 6.00,
          accepted_modals: ['motorcycle', 'bicycle'],
          status: 'open'
        },
        {
          id: 'job-2',
          store_id: 'store-2',
          city_id: 'sao_paulo',
          neighborhood_id: 'moema',
          accepted_modals: ['motorcycle'],
          status: 'open'
        },
        {
          id: 'job-other-city',
          store_id: 'store-3',
          city_id: 'rio_de_janeiro',
          status: 'open'
        }
      ]);

      const response = await HeadlessApiRouter.handle({
        method: 'GET',
        url: '/api/v1/jobs?city_id=sao_paulo&transport_modal=bicycle',
        headers: { 'X-API-Key': testApiKey },
        queryParams: {
          city_id: 'sao_paulo',
          transport_modal: 'bicycle'
        }
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.cityId, 'sao_paulo');
      assert.strictEqual(response.body.total, 1);
      assert.strictEqual(response.body.jobs[0].id, 'job-1');
    });

    it('Cenário 4: Aceite de Proposta / Matching (POST /api/v1/bids/:id/accept)', async () => {
      HeadlessApiRouter.setMockJobs([
        {
          id: 'job-matching-1',
          store_id: 'store-matching-1',
          status: 'open'
        }
      ]);

      HeadlessApiRouter.setMockBids([
        {
          id: 'bid-winning-1',
          job_id: 'job-matching-1',
          courier_id: 'courier-winner-1',
          bid_daily_rate: 95.00,
          bid_delivery_fee: 7.00,
          status: 'pending'
        },
        {
          id: 'bid-concurrent-2',
          job_id: 'job-matching-1',
          courier_id: 'courier-loser-2',
          bid_daily_rate: 110.00,
          status: 'pending'
        }
      ]);

      const response = await HeadlessApiRouter.handle({
        method: 'POST',
        url: '/api/v1/bids/bid-winning-1/accept',
        headers: { 'X-API-Key': testApiKey },
        body: {
          store_id: 'store-matching-1',
          job_id: 'job-matching-1',
          courier_id: 'courier-winner-1'
        }
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.jobId, 'job-matching-1');
      assert.strictEqual(response.body.bidId, 'bid-winning-1');
      assert.strictEqual(response.body.status, 'matched');
    });

    it('Cenário 5: Rate Limit Excedido (HTTP 429 com Retry-After e RFC 7807)', async () => {
      // Simula cliente com limite baixo para teste
      ApiGatewayService.registerMockClient({
        id: 'client-low-limit',
        clientName: 'Cliente Teste Limite',
        apiKeyHash: hashApiKey('dlv_live_low_limit'),
        ownerEmail: 'test@rate.com',
        allowedCities: ['*'],
        rateLimitRpm: 3,
        isActive: true
      });

      const sendReq = () => HeadlessApiRouter.handle({
        method: 'GET',
        url: '/api/v1/jobs?city_id=sao_paulo',
        headers: { 'X-API-Key': 'dlv_live_low_limit' },
        queryParams: { city_id: 'sao_paulo' }
      });

      // Requisições 1, 2, 3 permitidas
      const r1 = await sendReq();
      const r2 = await sendReq();
      const r3 = await sendReq();
      assert.strictEqual(r1.status, 200);
      assert.strictEqual(r2.status, 200);
      assert.strictEqual(r3.status, 200);

      // Requisição 4 deve ser bloqueada com 429
      const r4 = await sendReq();
      assert.strictEqual(r4.status, 429);
      assert.ok(r4.headers['Content-Type'].includes('application/problem+json'));
      assert.ok(r4.headers['Retry-After']);
      assert.strictEqual(r4.body.status, 429);
      assert.strictEqual(r4.body.title, 'Limite de Requisições Excedido');
      assert.ok(r4.body.detail.includes('3 requisições por minuto'));
    });

    it('Cenário 6: Dados Inválidos - Rejeição HTTP 400 com RFC 7807 Problem Details', async () => {
      const response = await HeadlessApiRouter.handle({
        method: 'POST',
        url: '/api/v1/couriers',
        headers: { 'X-API-Key': testApiKey },
        body: {
          fullName: '',
          cpf: '00000000000', // CPF falso com repetidos
          phoneNumber: 'invalid'
        }
      });

      assert.strictEqual(response.status, 400);
      assert.ok(response.headers['Content-Type'].includes('application/problem+json'));
      assert.strictEqual(response.body.status, 400);
      assert.strictEqual(response.body.title, 'Dados Cadastrais Inválidos');
      assert.ok(Array.isArray(response.body.invalidParams));
      assert.ok(response.body.invalidParams.some(p => p.name === 'fullName'));
      assert.ok(response.body.invalidParams.some(p => p.name === 'cpf'));
      assert.ok(response.body.invalidParams.some(p => p.name === 'phoneNumber'));
    });

    it('Cenário 7: Recurso Não Encontrado (HTTP 404 Not Found RFC 7807)', async () => {
      // 7a: Rota desconhecida
      const rUnknown = await HeadlessApiRouter.handle({
        method: 'GET',
        url: '/api/v1/unknown-resource',
        headers: { 'X-API-Key': testApiKey }
      });

      assert.strictEqual(rUnknown.status, 404);
      assert.ok(rUnknown.headers['Content-Type'].includes('application/problem+json'));
      assert.strictEqual(rUnknown.body.status, 404);

      // 7b: Proposta inexistente no matching
      HeadlessApiRouter.setMockBids([
        { id: 'bid-real', job_id: 'job-real' }
      ]);

      const rMissingBid = await HeadlessApiRouter.handle({
        method: 'POST',
        url: '/api/v1/bids/bid-ghost/accept',
        headers: { 'X-API-Key': testApiKey },
        body: { store_id: 'store-1', job_id: 'job-ghost' }
      });

      assert.strictEqual(rMissingBid.status, 404);
      assert.ok(rMissingBid.body.detail.includes('bid-ghost'));
    });
  });

  describe('Conformidade com a Especificação OpenAPI 3.0', () => {
    it('deve conter estrutura válida de OpenAPI 3.0.3 com todos os endpoints headless documentados', () => {
      assert.strictEqual(openApiSpec.openapi, '3.0.3');
      assert.strictEqual(openApiSpec.info.title, 'deLIVREry Headless API');

      // Rotas obrigatórias do PRD e FR-16
      assert.ok(openApiSpec.paths['/api/v1/couriers']);
      assert.ok(openApiSpec.paths['/api/v1/stores']);
      assert.ok(openApiSpec.paths['/api/v1/jobs']);
      assert.ok(openApiSpec.paths['/api/v1/bids/{id}/accept']);

      // Schemas fundamentais
      assert.ok(openApiSpec.components.schemas.ProblemDetails);
      assert.ok(openApiSpec.components.schemas.CourierRegistrationInput);
      assert.ok(openApiSpec.components.schemas.StoreRegistrationInput);
      assert.ok(openApiSpec.components.securitySchemes.ApiKeyAuth);
    });
  });

  describe('Integração com o SDK (@delivrery/api-client-sdk)', () => {
    it('deve interagir com os métodos de conveniência do DelivreryClient', async () => {
      const mockFetch = async (url, options) => {
        const u = new URL(url);
        const req = {
          method: options.method,
          url: u.pathname + u.search,
          headers: options.headers,
          body: options.body,
          queryParams: Object.fromEntries(u.searchParams.entries())
        };
        const res = await HeadlessApiRouter.handle(req);
        return {
          ok: res.status < 400,
          status: res.status,
          headers: res.headers,
          json: async () => res.body
        };
      };

      const client = new DelivreryClient({
        baseUrl: 'http://localhost:54321/api/v1',
        apiKey: testApiKey,
        fetch: mockFetch
      });

      // 1. Cadastro de entregador
      const courierRes = await client.createCourier({
        fullName: 'Lucas Oliveira',
        cpf: '12345678909',
        phoneNumber: '11999998888',
        transportModal: 'bicycle',
        baseDailyRate: 80.00,
        baseDeliveryFee: 5.00,
        cityId: 'sao_paulo'
      });
      assert.strictEqual(courierRes.success, true);
      assert.strictEqual(courierRes.courier.transportModal, 'bicycle');

      // 2. Listagem de vagas
      HeadlessApiRouter.setMockJobs([
        { id: 'job-sdk', city_id: 'sao_paulo', status: 'open' }
      ]);
      const jobsRes = await client.getJobs({ city_id: 'sao_paulo' });
      assert.strictEqual(jobsRes.success, true);
      assert.strictEqual(jobsRes.total, 1);

      // 3. Aceite de proposta
      HeadlessApiRouter.setMockJobs([{ id: 'job-sdk-match', status: 'open' }]);
      HeadlessApiRouter.setMockBids([{ id: 'bid-sdk-match', job_id: 'job-sdk-match' }]);
      const acceptRes = await client.acceptBid('bid-sdk-match', {
        store_id: 'store-1',
        job_id: 'job-sdk-match'
      });
      assert.strictEqual(acceptRes.success, true);
      assert.strictEqual(acceptRes.status, 'matched');
    });
  });
});
