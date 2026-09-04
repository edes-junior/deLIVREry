/**
 * deLIVREry API Client SDK
 * Neutral client SDK for interacting with deLIVREry Headless API
 */

export class DelivreryClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:54321/functions/v1';
    this.apiKey = config.apiKey || '';
  }

  async getHealth() {
    return { status: 'ok', client: 'delivrery-api-client-sdk' };
  }
}

export default DelivreryClient;
