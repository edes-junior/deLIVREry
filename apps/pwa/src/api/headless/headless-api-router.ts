import { ApiGatewayService } from '../gateway/api-gateway-service.ts';
import { RateLimiterService } from '../gateway/rate-limiter.ts';
import { validateCPF, validatePhone, cleanDigits } from '../../profile/cpf-validator.ts';
import { generateReferralCode } from '../../profile/profile-service.ts';
import { supabase } from '../../lib/supabase.ts';
import type { 
  ApiGatewayRequest, 
  ApiGatewayResponse, 
  ApiClient, 
  ProblemDetails 
} from '../gateway/types.ts';

export class HeadlessApiRouter {
  private static mockJobs: any[] = [];
  private static mockBids: any[] = [];

  /**
   * Ponto de entrada central para processamento de requisições headless /api/v1/*
   */
  public static async handle(req: ApiGatewayRequest): Promise<ApiGatewayResponse> {
    return await ApiGatewayService.handleGatewayRequest(req, async (client: ApiClient) => {
      // 1. Verificação de Taxa (Rate Limiting)
      const rateLimitResult = RateLimiterService.checkRateLimit(client.id, client.rateLimitRpm);

      const rateHeaders: Record<string, string> = {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset.toString()
      };

      if (!rateLimitResult.allowed) {
        const problem: ProblemDetails = {
          type: 'https://delivrery.app.br/errors/rate-limit-exceeded',
          title: 'Limite de Requisições Excedido',
          status: 429,
          detail: `Limite de ${rateLimitResult.limit} requisições por minuto excedido para este tenant. Tente novamente em ${rateLimitResult.retryAfter} segundos.`,
          instance: req.url
        };

        return {
          status: 429,
          headers: {
            ...rateHeaders,
            'Retry-After': (rateLimitResult.retryAfter || 60).toString(),
            'Content-Type': 'application/problem+json; charset=utf-8'
          },
          body: problem
        };
      }

      // Normaliza pathname da URL
      const pathname = req.url.split('?')[0].replace(/\/$/, '');
      const method = req.method.toUpperCase();

      // 2. Roteamento de Endpoints
      // POST /api/v1/couriers
      if (method === 'POST' && pathname === '/api/v1/couriers') {
        const response = await this.handleCreateCourier(req, client);
        return {
          ...response,
          headers: { ...rateHeaders, ...response.headers }
        };
      }

      // POST /api/v1/stores
      if (method === 'POST' && pathname === '/api/v1/stores') {
        const response = await this.handleCreateStore(req, client);
        return {
          ...response,
          headers: { ...rateHeaders, ...response.headers }
        };
      }

      // GET /api/v1/jobs
      if (method === 'GET' && pathname === '/api/v1/jobs') {
        const response = await this.handleGetJobs(req, client);
        return {
          ...response,
          headers: { ...rateHeaders, ...response.headers }
        };
      }

      // POST /api/v1/bids/:id/accept
      const matchBidAccept = pathname.match(/^\/api\/v1\/bids\/([^\/]+)\/accept$/);
      if (method === 'POST' && matchBidAccept) {
        const bidId = matchBidAccept[1];
        const response = await this.handleAcceptBid(req, bidId, client);
        return {
          ...response,
          headers: { ...rateHeaders, ...response.headers }
        };
      }

      // Rota não encontrada (404)
      const notFoundProblem: ProblemDetails = {
        type: 'https://delivrery.app.br/errors/not-found',
        title: 'Recurso Não Encontrado',
        status: 404,
        detail: `A rota ${method} ${pathname} não existe na API Headless v1.`,
        instance: req.url
      };

      return {
        status: 404,
        headers: {
          ...rateHeaders,
          'Content-Type': 'application/problem+json; charset=utf-8'
        },
        body: notFoundProblem
      };
    });
  }

  // --- CONTROLADORES INDIVIDUAIS ---

  private static parseBody(body: any): any {
    if (!body) return {};
    if (typeof body === 'object') return body;
    if (typeof body === 'string') {
      try {
        return JSON.parse(body);
      } catch {
        return {};
      }
    }
    return {};
  }

  /**
   * POST /api/v1/couriers
   */
  private static async handleCreateCourier(req: ApiGatewayRequest, client: ApiClient): Promise<ApiGatewayResponse> {
    const payload = this.parseBody(req.body);
    const invalidParams: Array<{ name: string; reason: string }> = [];

    if (!payload.fullName || typeof payload.fullName !== 'string' || !payload.fullName.trim()) {
      invalidParams.push({ name: 'fullName', reason: 'Nome completo é obrigatório.' });
    }

    if (!payload.cpf || !validateCPF(payload.cpf)) {
      invalidParams.push({ name: 'cpf', reason: 'CPF inválido ou malformatado.' });
    }

    if (!payload.phoneNumber || !validatePhone(payload.phoneNumber)) {
      invalidParams.push({ name: 'phoneNumber', reason: 'Telefone celular com DDD é obrigatório.' });
    }

    const validModals = ['motorcycle', 'bicycle', 'ebike_scooter'];
    if (!payload.transportModal || !validModals.includes(payload.transportModal)) {
      invalidParams.push({ name: 'transportModal', reason: `Modal inválido. Opções: ${validModals.join(', ')}.` });
    }

    if (typeof payload.baseDailyRate !== 'number' || payload.baseDailyRate < 0) {
      invalidParams.push({ name: 'baseDailyRate', reason: 'Tarifa da diária base deve ser um número não-negativo.' });
    }

    if (typeof payload.baseDeliveryFee !== 'number' || payload.baseDeliveryFee < 0) {
      invalidParams.push({ name: 'baseDeliveryFee', reason: 'Taxa de entrega base deve ser um número não-negativo.' });
    }

    if (!payload.cityId || typeof payload.cityId !== 'string' || !payload.cityId.trim()) {
      invalidParams.push({ name: 'cityId', reason: 'Cidade (cityId) é obrigatória.' });
    }

    if (invalidParams.length > 0) {
      const problem: ProblemDetails = {
        type: 'https://delivrery.app.br/errors/bad-request',
        title: 'Dados Cadastrais Inválidos',
        status: 400,
        detail: 'Houve falhas na validação dos campos do perfil do entregador.',
        instance: req.url,
        invalidParams
      };
      return {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
        body: problem
      };
    }

    const courierId = payload.userId || `usr_${cleanDigits(payload.cpf).slice(0, 8)}`;
    const referralCode = generateReferralCode();

    const courierProfile = {
      userId: courierId,
      fullName: payload.fullName.trim(),
      transportModal: payload.transportModal,
      referralCode,
      level: 'Bronze',
      xpPoints: 0,
      baseDailyRate: payload.baseDailyRate,
      baseDeliveryFee: payload.baseDeliveryFee,
      cityId: payload.cityId.trim(),
      stateId: (payload.stateId || 'RJ').toUpperCase(),
      homeNeighborhoodId: payload.homeNeighborhoodId || 'centro',
      originClientId: client.id,
      createdAt: new Date().toISOString()
    };

    return {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        courier: courierProfile
      }
    };
  }

  /**
   * POST /api/v1/stores
   */
  private static async handleCreateStore(req: ApiGatewayRequest, client: ApiClient): Promise<ApiGatewayResponse> {
    const payload = this.parseBody(req.body);
    const invalidParams: Array<{ name: string; reason: string }> = [];

    if (!payload.storeName || typeof payload.storeName !== 'string' || !payload.storeName.trim()) {
      invalidParams.push({ name: 'storeName', reason: 'Nome do estabelecimento é obrigatório.' });
    }

    if (!payload.fullName || typeof payload.fullName !== 'string' || !payload.fullName.trim()) {
      invalidParams.push({ name: 'fullName', reason: 'Nome do responsável é obrigatório.' });
    }

    if (!payload.cpf || !validateCPF(payload.cpf)) {
      invalidParams.push({ name: 'cpf', reason: 'CPF do responsável é inválido.' });
    }

    if (!payload.cityId || typeof payload.cityId !== 'string' || !payload.cityId.trim()) {
      invalidParams.push({ name: 'cityId', reason: 'Município é obrigatório.' });
    }

    if (!payload.neighborhoodId || typeof payload.neighborhoodId !== 'string' || !payload.neighborhoodId.trim()) {
      invalidParams.push({ name: 'neighborhoodId', reason: 'Bairro é obrigatório.' });
    }

    if (invalidParams.length > 0) {
      const problem: ProblemDetails = {
        type: 'https://delivrery.app.br/errors/bad-request',
        title: 'Dados Cadastrais Inválidos',
        status: 400,
        detail: 'Falha na validação dos campos do perfil do lojista.',
        instance: req.url,
        invalidParams
      };
      return {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
        body: problem
      };
    }

    const storeId = payload.userId || `usr_${cleanDigits(payload.cpf).slice(0, 8)}`;

    const storeProfile = {
      userId: storeId,
      storeName: payload.storeName.trim(),
      fullName: payload.fullName.trim(),
      reputationScore: 5.00,
      addressStreet: payload.addressStreet || 'Rua Principal',
      addressNumber: payload.addressNumber || 'S/N',
      cityId: payload.cityId.trim(),
      stateId: (payload.stateId || 'RJ').toUpperCase(),
      neighborhoodId: payload.neighborhoodId.trim(),
      originClientId: client.id,
      createdAt: new Date().toISOString()
    };

    return {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        store: storeProfile
      }
    };
  }

  /**
   * GET /api/v1/jobs?city_id=...&neighborhood_id=...&transport_modal=...
   */
  private static async handleGetJobs(req: ApiGatewayRequest, client: ApiClient): Promise<ApiGatewayResponse> {
    const cityId = req.queryParams?.['city_id'] || req.queryParams?.['cityId'] || req.queryParams?.['city'];

    if (!cityId || !cityId.trim()) {
      const problem: ProblemDetails = {
        type: 'https://delivrery.app.br/errors/bad-request',
        title: 'Parâmetro Obrigatório Ausente',
        status: 400,
        detail: 'O parâmetro de consulta city_id é obrigatório para listar vagas abertas.',
        instance: req.url,
        invalidParams: [{ name: 'city_id', reason: 'Informe o identificador do município.' }]
      };
      return {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
        body: problem
      };
    }

    const normCity = ApiGatewayService.normalizeCity(cityId);
    const neighborhoodId = req.queryParams?.['neighborhood_id'];
    const modal = req.queryParams?.['transport_modal'];

    // Filtra das vagas em mock ou banco
    let filteredJobs = this.mockJobs.filter(j => {
      const matchCity = ApiGatewayService.normalizeCity(j.city_id || j.cityId) === normCity;
      const matchStatus = (j.status || 'open') === 'open';
      const matchNeighborhood = !neighborhoodId || j.neighborhood_id === neighborhoodId;
      const matchModal = !modal || modal === 'all' || (j.accepted_modals && j.accepted_modals.includes(modal));
      return matchCity && matchStatus && matchNeighborhood && matchModal;
    });

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        total: filteredJobs.length,
        cityId: normCity,
        jobs: filteredJobs
      }
    };
  }

  /**
   * POST /api/v1/bids/:id/accept
   */
  private static async handleAcceptBid(
    req: ApiGatewayRequest, 
    bidId: string, 
    client: ApiClient
  ): Promise<ApiGatewayResponse> {
    const payload = this.parseBody(req.body);

    if (!payload.store_id || !payload.job_id) {
      const problem: ProblemDetails = {
        type: 'https://delivrery.app.br/errors/bad-request',
        title: 'Parâmetros Ausentes',
        status: 400,
        detail: 'Campos store_id e job_id são obrigatórios para aceite de proposta.',
        instance: req.url
      };
      return {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
        body: problem
      };
    }

    // Busca proposta no mock ou banco
    const bidIndex = this.mockBids.findIndex(b => b.id === bidId && b.job_id === payload.job_id);
    const jobIndex = this.mockJobs.findIndex(j => j.id === payload.job_id && (j.store_id === payload.store_id || j.storeId === payload.store_id));

    if (bidIndex === -1 && jobIndex === -1 && this.mockBids.length > 0) {
      const notFound: ProblemDetails = {
        type: 'https://delivrery.app.br/errors/not-found',
        title: 'Proposta ou Vaga Não Encontrada',
        status: 404,
        detail: `Proposta ${bidId} para a vaga ${payload.job_id} não foi encontrada ou já foi finalizada.`,
        instance: req.url
      };
      return {
        status: 404,
        headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
        body: notFound
      };
    }

    // Consolida matching
    const courierId = payload.courier_id || (bidIndex !== -1 ? this.mockBids[bidIndex].courier_id : 'courier_default');

    if (jobIndex !== -1) {
      this.mockJobs[jobIndex].status = 'matched';
      this.mockJobs[jobIndex].matched_bid_id = bidId;
      this.mockJobs[jobIndex].matched_courier_id = courierId;
    }

    if (bidIndex !== -1) {
      this.mockBids[bidIndex].status = 'accepted';
      // Rejeita os outros da mesma vaga
      for (const otherBid of this.mockBids) {
        if (otherBid.job_id === payload.job_id && otherBid.id !== bidId) {
          otherBid.status = 'rejected';
        }
      }
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        jobId: payload.job_id,
        bidId,
        courierId,
        status: 'matched'
      }
    };
  }

  // --- HELPERS PARA TESTES ---

  public static setMockJobs(jobs: any[]): void {
    this.mockJobs = [...jobs];
  }

  public static setMockBids(bids: any[]): void {
    this.mockBids = [...bids];
  }

  public static clearMocks(): void {
    this.mockJobs = [];
    this.mockBids = [];
  }
}
