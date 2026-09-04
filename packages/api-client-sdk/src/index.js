/**
 * deLIVREry API Client SDK
 * Neutral client SDK for interacting with deLIVREry Headless API
 */

export class DelivreryClient {
  constructor(config = {}) {
    this.baseUrl = (config.baseUrl || 'http://localhost:54321/functions/v1').replace(/\/$/, '');
    this.apiKey = config.apiKey || '';
    this.fetchFn = config.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  }

  async getHealth() {
    return { status: 'ok', client: 'delivrery-api-client-sdk' };
  }

  /**
   * Consulta as métricas analíticas de preços regionais com filtro 1.5xIQR.
   * @param {Object} params
   * @param {string} params.cityId ou params.city_id
   * @param {string} params.neighborhoodId ou params.neighborhood_id
   * @param {string} [params.stateId] ou params.state_id
   * @param {string} [params.transportModal] ou params.transport_modal
   * @returns {Promise<Object>} Resposta com dados analíticos e sugestão de mercado
   */
  async getPricingStats(params = {}) {
    const cityId = params.cityId || params.city_id;
    const neighborhoodId = params.neighborhoodId || params.neighborhood_id;
    const stateId = params.stateId || params.state_id || 'RJ';
    const transportModal = params.transportModal || params.transport_modal || 'all';

    if (!cityId || !neighborhoodId) {
      throw new Error('city_id e neighborhood_id são obrigatórios para consultar o balizador de preços.');
    }

    const query = new URLSearchParams({
      city_id: cityId,
      neighborhood_id: neighborhoodId,
      state_id: stateId,
      transport_modal: transportModal
    });

    const url = `${this.baseUrl}/pricing-stats?${query.toString()}`;

    if (!this.fetchFn) {
      throw new Error('Nenhum cliente fetch disponível no ambiente.');
    }

    const headers = {
      'Accept': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const res = await this.fetchFn(url, { method: 'GET', headers });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const message = errorBody.detail || errorBody.title || `Erro HTTP ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      err.problem = errorBody;
      throw err;
    }

    return await res.json();
  }
}

export default DelivreryClient;
