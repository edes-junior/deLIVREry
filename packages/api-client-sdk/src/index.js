/**
 * deLIVREry API Client SDK
 * Neutral client SDK for interacting with deLIVREry Headless API
 */

import { createHash, randomBytes } from 'node:crypto';

export class DelivreryClient {
  constructor(config = {}) {
    this.baseUrl = (config.baseUrl || 'http://localhost:54321/functions/v1').replace(/\/$/, '');
    this.apiKey = config.apiKey || '';
    this.fetchFn = config.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey || '';
    return this;
  }

  async getHealth() {
    return { status: 'ok', client: 'delivrery-api-client-sdk' };
  }

  /**
   * Método auxiliar para despachar requisições com headers de autenticação e tratamento RFC 7807
   */
  async _request(path, options = {}) {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;

    if (!this.fetchFn) {
      throw new Error('Nenhum cliente fetch disponível no ambiente.');
    }

    const headers = {
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const res = await this.fetchFn(url, { ...options, headers });

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

  /**
   * Cadastra um entregador via API Headless (POST /couriers)
   */
  async createCourier(data = {}) {
    return await this._request('/couriers', {
      method: 'POST',
      body: data
    });
  }

  /**
   * Cadastra um estabelecimento lojista via API Headless (POST /stores)
   */
  async createStore(data = {}) {
    return await this._request('/stores', {
      method: 'POST',
      body: data
    });
  }

  /**
   * Lista vagas e turnos de entrega abertos (GET /jobs)
   */
  async getJobs(params = {}) {
    const cityId = params.cityId || params.city_id;
    if (!cityId) {
      throw new Error('city_id é obrigatório para consultar vagas.');
    }

    const query = new URLSearchParams({
      city_id: cityId
    });

    if (params.neighborhoodId || params.neighborhood_id) {
      query.set('neighborhood_id', params.neighborhoodId || params.neighborhood_id);
    }
    if (params.transportModal || params.transport_modal) {
      query.set('transport_modal', params.transportModal || params.transport_modal);
    }

    return await this._request(`/jobs?${query.toString()}`, {
      method: 'GET'
    });
  }

  /**
   * Aceita uma proposta formalizando o matching da vaga (POST /bids/:id/accept)
   */
  async acceptBid(bidId, params = {}) {
    if (!bidId) {
      throw new Error('bidId é obrigatório para aceite de proposta.');
    }

    return await this._request(`/bids/${bidId}/accept`, {
      method: 'POST',
      body: {
        store_id: params.storeId || params.store_id,
        job_id: params.jobId || params.job_id,
        courier_id: params.courierId || params.courier_id
      }
    });
  }

  /**
   * Consulta as métricas analíticas de preços regionais com filtro 1.5xIQR.
   */
  async getPricingStats(params = {}) {
    const cityId = params.cityId || params.city_id;
    const neighborhoodId = params.neighborhoodId || params.neighborhood_id;
    const stateId = (params.stateId || params.state_id || 'RJ').toUpperCase();
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

    return await this._request(`/pricing-stats?${query.toString()}`, {
      method: 'GET'
    });
  }

  /**
   * Obtém a configuração de apoio comunitário e chave PIX.
   */
  getPixConfig() {
    const key = (typeof process !== 'undefined' && process.env?.PUBLIC_PIX_KEY) || 'apoio@delivrery.org';
    const recipientName = (typeof process !== 'undefined' && process.env?.PUBLIC_PIX_RECIPIENT_NAME) || 'Comunidade deLIVREry';
    const city = (typeof process !== 'undefined' && process.env?.PUBLIC_PIX_CITY) || 'SAO PAULO';
    return {
      key,
      recipientName,
      city,
      brCodePayload: generatePixBrcode({ key, recipientName, city })
    };
  }
}

/**
 * Utilitários de credenciais para integradores B2B
 */
export function hashApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return '';
  }
  return createHash('sha256').update(apiKey.trim()).digest('hex');
}

export function generateApiKey(prefix = 'dlv_live', byteLength = 24) {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_]/g, '');
  const entropy = randomBytes(byteLength).toString('hex');
  return `${cleanPrefix}_${entropy}`;
}

export function generateWebhookSecret(byteLength = 32) {
  const entropy = randomBytes(byteLength).toString('hex');
  return `whsec_${entropy}`;
}

/**
 * Funções utilitárias de BR Code PIX no padrão EMVCo / BACEN
 */
export function formatPixTLV(id, value) {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

export function calculatePixCrc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= (str.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generatePixBrcode(params = {}) {
  const key = (params.key || 'apoio@delivrery.org').trim();
  const recipientName = (params.recipientName || 'Comunidade deLIVREry')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().slice(0, 25);
  const city = (params.city || 'SAO PAULO')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().slice(0, 15);
  const txid = params.txid || '***';

  const tag00 = formatPixTLV('00', '01');
  const subtag00 = formatPixTLV('00', 'br.gov.bcb.pix');
  const subtag01 = formatPixTLV('01', key);
  const tag26 = formatPixTLV('26', `${subtag00}${subtag01}`);
  const tag52 = formatPixTLV('52', '0000');
  const tag53 = formatPixTLV('53', '986');
  let tag54 = '';
  if (params.amount && params.amount > 0) {
    tag54 = formatPixTLV('54', Number(params.amount).toFixed(2));
  }
  const tag58 = formatPixTLV('58', 'BR');
  const tag59 = formatPixTLV('59', recipientName);
  const tag60 = formatPixTLV('60', city);
  const tag62 = formatPixTLV('62', formatPixTLV('05', txid));

  const partial = `${tag00}${tag26}${tag52}${tag53}${tag54}${tag58}${tag59}${tag60}${tag62}6304`;
  return `${partial}${calculatePixCrc16(partial)}`;
}

export default DelivreryClient;
