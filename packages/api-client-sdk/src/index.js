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

