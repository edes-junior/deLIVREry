import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PricingService } from '../apps/pwa/src/pricing/pricing-service.ts';
import { handler as edgeFunctionHandler } from '../supabase/functions/pricing-stats/index.ts';
import { DelivreryClient } from '../packages/api-client-sdk/src/index.js';

describe('Story 3.2: Endpoint de Analytics de Preços e Resposta HTTP (FR-7, NFR-3)', () => {
  beforeEach(() => {
    PricingService.clearCache();
  });

  it('deve responder a requisições de preflight CORS (OPTIONS) com status 204 e headers permitidos', async () => {
    const response = await PricingService.handlePricingStatsRequest({
      method: 'OPTIONS',
      url: '/api/v1/analytics/pricing-stats'
    });

    assert.strictEqual(response.status, 204);
    assert.strictEqual(response.headers['Access-Control-Allow-Origin'], '*');
    assert.ok(response.headers['Access-Control-Allow-Methods'].includes('GET'));
    assert.ok(response.headers['Access-Control-Allow-Methods'].includes('OPTIONS'));
    assert.strictEqual(response.body, null);
  });

  it('deve rejeitar métodos HTTP não suportados (POST, PUT, DELETE) com RFC 7807 (405 Method Not Allowed)', async () => {
    const response = await PricingService.handlePricingStatsRequest({
      method: 'POST',
      url: '/api/v1/analytics/pricing-stats'
    });

    assert.strictEqual(response.status, 405);
    assert.ok(response.headers['Content-Type'].includes('application/problem+json'));
    assert.strictEqual(response.headers['Allow'], 'GET, OPTIONS');
    assert.strictEqual(response.body.status, 405);
    assert.strictEqual(response.body.title, 'Método Não Permitido');
    assert.ok(response.body.detail.includes('POST'));
    assert.ok(response.body.type.includes('method-not-allowed'));
  });

  it('deve rejeitar requisição sem parâmetros obrigatórios (city_id, neighborhood_id) com RFC 7807 (400 Bad Request)', async () => {
    const response = await PricingService.handlePricingStatsRequest({
      method: 'GET',
      url: '/api/v1/analytics/pricing-stats',
      queryParams: {
        state_id: 'RJ'
      }
    });

    assert.strictEqual(response.status, 400);
    assert.ok(response.headers['Content-Type'].includes('application/problem+json'));
    assert.strictEqual(response.body.status, 400);
    assert.strictEqual(response.body.title, 'Parâmetros Obrigatórios Ausentes');
    assert.ok(Array.isArray(response.body.invalidParams));
    assert.strictEqual(response.body.invalidParams.length, 2);
    assert.ok(response.body.invalidParams.some(p => p.name === 'city_id'));
    assert.ok(response.body.invalidParams.some(p => p.name === 'neighborhood_id'));
  });

  it('deve processar requisição GET válida com cabeçalhos de cache HTTP e tempo de resposta < 100ms (NFR-3)', async () => {
    PricingService.setMockMetrics({
      stateId: 'RJ',
      cityId: 'rio-de-janeiro',
      neighborhoodId: 'copacabana',
      isConsolidated: true,
      sampleSize: 15,
      medianDailyRate: 120,
      medianDeliveryFee: 8
    });

    const startTime = performance.now();

    const response = await PricingService.handlePricingStatsRequest({
      method: 'GET',
      url: '/api/v1/analytics/pricing-stats',
      queryParams: {
        city_id: 'rio-de-janeiro',
        neighborhood_id: 'copacabana',
        state_id: 'RJ',
        transport_modal: 'all'
      }
    });

    const duration = performance.now() - startTime;

    assert.strictEqual(response.status, 200);
    assert.ok(response.headers['Content-Type'].includes('application/json'));
    assert.strictEqual(response.headers['Cache-Control'], 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    assert.ok(response.headers['ETag'], 'Deve conter ETag para validação condicional');
    assert.strictEqual(response.headers['Access-Control-Allow-Origin'], '*');

    // NFR-3 Latência < 100ms
    assert.ok(duration < 100, `Tempo de resposta deve ser < 100ms. Obtido: ${duration.toFixed(2)}ms`);

    // Estrutura do corpo de resposta
    assert.ok(response.body.data);
    assert.strictEqual(response.body.data.cityId, 'rio-de-janeiro');
    assert.strictEqual(response.body.data.neighborhoodId, 'copacabana');
    assert.strictEqual(response.body.data.stateId, 'RJ');
    assert.ok(response.body.data.suggestedPricing);
    assert.ok(response.body.serverTime);
  });

  it('deve servir requisições repetidas a partir do cache em memória com flag cached: true', async () => {
    const params = {
      method: 'GET',
      url: '/api/v1/analytics/pricing-stats',
      queryParams: {
        city_id: 'rio-de-janeiro',
        neighborhood_id: 'ipanema',
        state_id: 'RJ'
      }
    };

    // Primeira chamada (popula cache)
    const firstResponse = await PricingService.handlePricingStatsRequest(params);
    assert.strictEqual(firstResponse.status, 200);

    // Segunda chamada imediata (deve acusar cache hit)
    const secondResponse = await PricingService.handlePricingStatsRequest(params);
    assert.strictEqual(secondResponse.status, 200);
    assert.strictEqual(secondResponse.body.cached, true, 'Segunda requisição deve vir do cache em memória');
  });

  it('deve calcular recomendação de preços de mercado ("Sugerir Preço de Mercado") conforme consolidação', () => {
    // Cenário 1: Bairro com amostra consolidada (>= 10 turnos)
    const consolidated = {
      stateId: 'RJ',
      cityId: 'rio-de-janeiro',
      neighborhoodId: 'copacabana',
      transportModal: 'all',
      sampleSize: 25,
      windowDays: 14,
      isConsolidated: true,
      q1DailyRate: 110,
      medianDailyRate: 130,
      q3DailyRate: 150,
      iqrDailyRate: 40,
      minDailyRate: 90,
      maxDailyRate: 180,
      q1DeliveryFee: 6,
      medianDeliveryFee: 9,
      q3DeliveryFee: 11,
      iqrDeliveryFee: 5,
      minDeliveryFee: 5,
      maxDeliveryFee: 15,
      outliersExpunged: 2
    };

    const suggestedHigh = PricingService.calculateSuggestedPricing(consolidated);
    assert.strictEqual(suggestedHigh.source, 'neighborhood');
    assert.strictEqual(suggestedHigh.confidence, 'high');
    assert.strictEqual(suggestedHigh.suggestedDailyRate, 130);
    assert.strictEqual(suggestedHigh.suggestedDeliveryFee, 9);

    // Cenário 2: Bairro novo em consolidação com dados municipais
    const fallbackCity = {
      ...consolidated,
      sampleSize: 4,
      isConsolidated: false,
      medianDailyRate: 115,
      medianDeliveryFee: 7.5
    };

    const suggestedMedium = PricingService.calculateSuggestedPricing(fallbackCity);
    assert.strictEqual(suggestedMedium.source, 'city');
    assert.strictEqual(suggestedMedium.confidence, 'medium');
    assert.strictEqual(suggestedMedium.suggestedDailyRate, 115);
    assert.strictEqual(suggestedMedium.suggestedDeliveryFee, 7.5);

    // Cenário 3: Região zerada sem nenhuma transação prévia
    const emptyMetrics = {
      ...consolidated,
      sampleSize: 0,
      isConsolidated: false,
      medianDailyRate: 0,
      medianDeliveryFee: 0
    };

    const suggestedDefault = PricingService.calculateSuggestedPricing(emptyMetrics);
    assert.strictEqual(suggestedDefault.source, 'default');
    assert.strictEqual(suggestedDefault.confidence, 'low');
    assert.strictEqual(suggestedDefault.suggestedDailyRate, 100);
    assert.strictEqual(suggestedDefault.suggestedDeliveryFee, 6);
  });
});

describe('Story 3.2: Supabase Edge Function Handler e API Client SDK', () => {
  it('deve processar requisições através do handler da Edge Function nativa (Web Request/Response)', async () => {
    PricingService.setMockMetrics({
      stateId: 'RJ',
      cityId: 'niteroi',
      neighborhoodId: 'icarai',
      isConsolidated: true,
      sampleSize: 20,
      medianDailyRate: 110,
      medianDeliveryFee: 7
    });

    const webRequest = new Request('https://delivrery.supabase.co/functions/v1/pricing-stats?city_id=niteroi&neighborhood_id=icarai&state_id=RJ', {
      method: 'GET'
    });

    const webResponse = await edgeFunctionHandler(webRequest);

    assert.strictEqual(webResponse.status, 200);
    assert.strictEqual(webResponse.headers.get('Cache-Control'), 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    assert.strictEqual(webResponse.headers.get('Access-Control-Allow-Origin'), '*');

    const json = await webResponse.json();
    assert.strictEqual(json.data.cityId, 'niteroi');
    assert.strictEqual(json.data.neighborhoodId, 'icarai');
  });

  it('deve consultar o balizador através do DelivreryClient do SDK', async () => {
    // Mock de fetch simulando a Edge Function respondendo JSON
    const mockFetch = async (url, options) => {
      assert.ok(url.includes('/pricing-stats'));
      assert.ok(url.includes('city_id=rio-de-janeiro'));
      assert.ok(url.includes('neighborhood_id=centro'));

      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            cityId: 'rio-de-janeiro',
            neighborhoodId: 'centro',
            medianDailyRate: 125,
            medianDeliveryFee: 8,
            suggestedPricing: {
              suggestedDailyRate: 125,
              suggestedDeliveryFee: 8,
              source: 'neighborhood',
              confidence: 'high'
            }
          },
          cached: false
        })
      };
    };

    const client = new DelivreryClient({
      baseUrl: 'http://localhost:54321/functions/v1',
      apiKey: 'test-api-key',
      fetch: mockFetch
    });

    const result = await client.getPricingStats({
      cityId: 'rio-de-janeiro',
      neighborhoodId: 'centro',
      stateId: 'RJ'
    });

    assert.ok(result.data);
    assert.strictEqual(result.data.cityId, 'rio-de-janeiro');
    assert.strictEqual(result.data.medianDailyRate, 125);
  });

  it('deve validar parâmetros obrigatórios no SDK e rejeitar antes da chamada HTTP', async () => {
    const client = new DelivreryClient();

    await assert.rejects(
      async () => {
        await client.getPricingStats({ cityId: 'rio-de-janeiro' });
      },
      /city_id e neighborhood_id são obrigatórios/
    );
  });

  it('deve extrair detalhes de erro RFC 7807 quando o servidor responder com erro no SDK', async () => {
    const mockErrorFetch = async () => {
      return {
        ok: false,
        status: 400,
        json: async () => ({
          type: 'https://delivrery.app/errors/bad-request',
          title: 'Parâmetros Obrigatórios Ausentes',
          status: 400,
          detail: 'A consulta ao balizador regional requer a especificação de city_id e neighborhood_id.'
        })
      };
    };

    const client = new DelivreryClient({
      fetch: mockErrorFetch
    });

    await assert.rejects(
      async () => {
        await client.getPricingStats({ cityId: 'rio', neighborhoodId: 'bairro' });
      },
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.strictEqual(err.message, 'A consulta ao balizador regional requer a especificação de city_id e neighborhood_id.');
        assert.strictEqual(err.problem.type, 'https://delivrery.app/errors/bad-request');
        return true;
      }
    );
  });
});
