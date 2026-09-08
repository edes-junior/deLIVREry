import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { supabase } from '../../lib/supabase.ts';
import type { 
  ApiClient, 
  ApiGatewayRequest, 
  ApiGatewayAuthResult, 
  ApiGatewayResponse, 
  ProblemDetails,
  WebhookSubscription,
  WebhookEventType,
  VALID_WEBHOOK_EVENTS
} from './types.ts';

export class ApiGatewayService {
  private static mockClients: Map<string, ApiClient> = new Map();
  private static mockSubscriptions: Map<string, WebhookSubscription[]> = new Map();

  /**
   * Calcula o hash SHA-256 (64 hex characters) da chave de API em texto plano.
   */
  public static hashApiKey(apiKey: string): string {
    if (!apiKey || typeof apiKey !== 'string') {
      return '';
    }
    return bytesToHex(sha256(utf8ToBytes(apiKey.trim())));
  }

  /**
   * Normaliza o identificador da cidade para comparação case-insensitive sem acentos.
   */
  public static normalizeCity(city: string): string {
    if (!city || typeof city !== 'string') {
      return '';
    }
    return city
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_');
  }

  /**
   * Verifica se a cidade solicitada está contida na lista de cidades autorizadas pelo cliente.
   * O valor "*" confere acesso nacional a qualquer município.
   */
  public static validateCityAccess(allowedCities: string[], requestedCity?: string): boolean {
    if (!requestedCity || requestedCity.trim() === '') {
      return true;
    }

    if (!Array.isArray(allowedCities) || allowedCities.length === 0) {
      return false;
    }

    if (allowedCities.includes('*')) {
      return true;
    }

    const normRequested = this.normalizeCity(requestedCity);
    return allowedCities.some(city => this.normalizeCity(city) === normRequested);
  }

  /**
   * Extrai a API Key dos cabeçalhos HTTP suportados (X-API-Key ou Authorization: Bearer dlv_...)
   */
  public static extractApiKey(headers?: Record<string, string | undefined> | Headers | any): string | null {
    if (!headers) return null;

    // Suporte tanto a instâncias de Headers (Web API) quanto Record<string, string>
    if (typeof headers.get === 'function') {
      const xApiKey = headers.get('x-api-key') || headers.get('X-API-Key');
      if (xApiKey && typeof xApiKey === 'string' && xApiKey.trim()) {
        return xApiKey.trim();
      }
      const auth = headers.get('authorization') || headers.get('Authorization');
      if (auth && typeof auth === 'string') {
        const match = auth.trim().match(/^Bearer\s+(dlv_[a-zA-Z0-9_-]+)$/i);
        if (match && match[1]) {
          return match[1];
        }
      }
      return null;
    }

    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'x-api-key' && value && typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
      if (key.toLowerCase() === 'authorization' && value && typeof value === 'string') {
        const match = value.trim().match(/^Bearer\s+(dlv_[a-zA-Z0-9_-]+)$/i);
        if (match && match[1]) {
          return match[1];
        }
      }
    }

    return null;
  }

  /**
   * Extrai o identificador da cidade a partir de query params, cabeçalhos ou body
   */
  public static extractCityId(req: ApiGatewayRequest): string | null {
    if (req.cityId && typeof req.cityId === 'string' && req.cityId.trim()) {
      return req.cityId.trim();
    }

    if (req.queryParams) {
      const qCity = req.queryParams['city_id'] || req.queryParams['cityId'] || req.queryParams['city'];
      if (qCity && typeof qCity === 'string' && qCity.trim()) {
        return qCity.trim();
      }
    }

    if (req.headers) {
      if (typeof (req.headers as any).get === 'function') {
        const hCity = (req.headers as any).get('x-city-id');
        if (hCity && typeof hCity === 'string' && hCity.trim()) {
          return hCity.trim();
        }
      } else {
        for (const [key, value] of Object.entries(req.headers)) {
          if (key.toLowerCase() === 'x-city-id' && value && typeof value === 'string') {
            return value.trim();
          }
        }
      }
    }

    if (req.body) {
      if (typeof req.body === 'object') {
        const bCity = req.body.city_id || req.body.cityId || req.body.city;
        if (bCity && typeof bCity === 'string' && bCity.trim()) {
          return bCity.trim();
        }
      } else if (typeof req.body === 'string') {
        try {
          const parsed = JSON.parse(req.body);
          const bCity = parsed?.city_id || parsed?.cityId || parsed?.city;
          if (bCity && typeof bCity === 'string' && bCity.trim()) {
            return bCity.trim();
          }
        } catch {
          // Ignora caso payload não seja JSON
        }
      }
    }

    return null;
  }

  /**
   * Autentica e valida a requisição HTTP contra o schema de parceiros e escopo territorial
   */
  public static async authenticateRequest(req: ApiGatewayRequest): Promise<ApiGatewayAuthResult> {
    const rawApiKey = this.extractApiKey(req.headers);

    if (!rawApiKey) {
      const problem: ProblemDetails = {
        type: 'https://delivrery.app.br/errors/unauthorized',
        title: 'Não Autorizado',
        status: 401,
        detail: 'Cabeçalho X-API-Key ausente ou inválido.',
        instance: req.url
      };
      return {
        isAuthenticated: false,
        isAuthorized: false,
        statusCode: 401,
        problem
      };
    }

    const keyHash = this.hashApiKey(rawApiKey);
    let client: ApiClient | null = null;

    // 1. Verifica no repositório em memória/mock
    if (this.mockClients.has(keyHash)) {
      client = this.mockClients.get(keyHash)!;
    } else if (supabase) {
      // 2. Consulta no Supabase PostgreSQL
      try {
        const { data, error } = await supabase
          .from('api_clients')
          .select('*')
          .eq('api_key_hash', keyHash)
          .single();

        if (data && !error) {
          client = {
            id: data.id,
            clientName: data.client_name,
            apiKeyHash: data.api_key_hash,
            ownerEmail: data.owner_email,
            allowedCities: data.allowed_cities || ['*'],
            rateLimitRpm: data.rate_limit_rpm || 120,
            isActive: Boolean(data.is_active),
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };
        }
      } catch {
        // Fallback se supabase local não estiver com o servidor ativo
      }
    }

    if (!client || !client.isActive) {
      const problem: ProblemDetails = {
        type: 'https://delivrery.app.br/errors/unauthorized',
        title: 'Não Autorizado',
        status: 401,
        detail: 'API Key inválida, revogada ou inativa.',
        instance: req.url
      };
      return {
        isAuthenticated: false,
        isAuthorized: false,
        statusCode: 401,
        problem
      };
    }

    // Validação de Escopo Geográfico (allowed_cities)
    const requestedCity = this.extractCityId(req);
    if (requestedCity) {
      const isCityAllowed = this.validateCityAccess(client.allowedCities, requestedCity);
      if (!isCityAllowed) {
        const problem: ProblemDetails = {
          type: 'https://delivrery.app.br/errors/forbidden',
          title: 'Acesso Não Autorizado para Município',
          status: 403,
          detail: `Acesso não autorizado para o município solicitado: ${requestedCity}`,
          instance: req.url
        };
        return {
          isAuthenticated: true,
          isAuthorized: false,
          client,
          statusCode: 403,
          problem
        };
      }
    }

    return {
      isAuthenticated: true,
      isAuthorized: true,
      client,
      statusCode: 200
    };
  }

  /**
   * Intercepta a requisição, valida autenticação e CORS, e delega para o handler subsequente.
   */
  public static async handleGatewayRequest(
    req: ApiGatewayRequest,
    next: (client: ApiClient) => Promise<ApiGatewayResponse>
  ): Promise<ApiGatewayResponse> {
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'X-API-Key, Authorization, Content-Type, X-City-ID',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };

    if (req.method.toUpperCase() === 'OPTIONS') {
      return {
        status: 204,
        headers: corsHeaders,
        body: null
      };
    }

    const authResult = await this.authenticateRequest(req);

    if (!authResult.isAuthenticated || !authResult.isAuthorized) {
      return {
        status: authResult.statusCode,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/problem+json; charset=utf-8'
        },
        body: authResult.problem
      };
    }

    const response = await next(authResult.client!);

    return {
      status: response.status,
      headers: {
        ...corsHeaders,
        'X-RateLimit-Limit': authResult.client!.rateLimitRpm.toString(),
        ...response.headers
      },
      body: response.body
    };
  }

  /**
   * Valida e registra uma subscrição de webhook
   */
  public static validateWebhookSubscription(sub: Partial<WebhookSubscription>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!sub.clientId) {
      errors.push('client_id é obrigatório.');
    }
    if (!sub.targetUrl || !sub.targetUrl.match(/^https?:\/\/.+/)) {
      errors.push('target_url deve ser uma URL HTTP/HTTPS válida.');
    }
    if (!sub.eventType || !['job.created', 'bid.submitted', 'job.accepted', 'job.completed'].includes(sub.eventType)) {
      errors.push(`event_type deve ser um dos eventos canônicos: job.created, bid.submitted, job.accepted, job.completed.`);
    }
    if (!sub.secretToken || sub.secretToken.length < 16) {
      errors.push('secret_token deve conter no mínimo 16 caracteres para assinatura HMAC-SHA256.');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // --- MÉTODOS AUXILIARES PARA TESTES E DESENVOLVIMENTO ---

  public static registerMockClient(client: ApiClient): void {
    this.mockClients.set(client.apiKeyHash, client);
  }

  public static clearMockClients(): void {
    this.mockClients.clear();
    this.mockSubscriptions.clear();
  }

  public static getMockClient(keyHash: string): ApiClient | undefined {
    return this.mockClients.get(keyHash);
  }

  public static registerMockSubscription(sub: WebhookSubscription): void {
    const list = this.mockSubscriptions.get(sub.clientId) || [];
    list.push(sub);
    this.mockSubscriptions.set(sub.clientId, list);
  }

  public static getMockSubscriptions(clientId: string): WebhookSubscription[] {
    return this.mockSubscriptions.get(clientId) || [];
  }
}
