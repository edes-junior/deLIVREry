/**
 * @file pricing-service.ts
 * @description Camada de serviço de domínio para o Balizador Inteligente de Preços Regionais (FR-7, FR-8).
 * Implementa o algoritmo de expurgo estatístico de Tukey (1.5xIQR) e consulta resiliente com cache.
 */

import { supabase } from '../lib/supabase.ts';
import type {
  IQRCalculationResult,
  RegionalPricingMetrics,
  PricingQueryParams,
  SuggestedPricing,
  RFC7807ProblemDetails,
  PricingStatsApiResponse
} from './types.ts';

/**
 * Calcula percentil contínuo com interpolação linear (compatível com percentile_cont do PostgreSQL).
 */
export function calculatePercentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  if (p <= 0) return sortedValues[0];
  if (p >= 1) return sortedValues[sortedValues.length - 1];

  const index = p * (sortedValues.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const weight = index - lowerIndex;

  const result = (1 - weight) * sortedValues[lowerIndex] + weight * sortedValues[upperIndex];
  return Math.round(result * 100) / 100;
}

/**
 * Executa o cálculo estatístico de quartis (Q1, Mediana, Q3) e aplica o corte de Tukey 1.5xIQR.
 */
export function calculateIQR(rawValues: number[]): IQRCalculationResult {
  const sanitized = (rawValues || [])
    .filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v) && v >= 0)
    .sort((a, b) => a - b);

  if (sanitized.length === 0) {
    return {
      q1: 0,
      median: 0,
      q3: 0,
      iqr: 0,
      lowerBound: 0,
      upperBound: 0,
      outliers: [],
      cleanValues: [],
      min: 0,
      max: 0
    };
  }

  const q1 = calculatePercentile(sanitized, 0.25);
  const median = calculatePercentile(sanitized, 0.50);
  const q3 = calculatePercentile(sanitized, 0.75);
  const iqr = Math.round(Math.max(0, q3 - q1) * 100) / 100;

  const lowerBound = Math.max(0, Math.round((q1 - 1.5 * iqr) * 100) / 100);
  const upperBound = Math.round((q3 + 1.5 * iqr) * 100) / 100;

  const cleanValues: number[] = [];
  const outliers: number[] = [];

  for (const val of sanitized) {
    if (val >= lowerBound && val <= upperBound) {
      cleanValues.push(val);
    } else {
      outliers.push(val);
    }
  }

  const min = cleanValues.length > 0 ? cleanValues[0] : 0;
  const max = cleanValues.length > 0 ? cleanValues[cleanValues.length - 1] : 0;
  const cleanMedian = cleanValues.length > 0 ? calculatePercentile(cleanValues, 0.50) : median;

  return {
    q1,
    median: cleanMedian,
    q3,
    iqr,
    lowerBound,
    upperBound,
    outliers,
    cleanValues,
    min,
    max
  };
}

// Cache em memória de curta duração para alta performance (NFR-3 < 100ms)
const pricingCache = new Map<string, { data: RegionalPricingMetrics; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

export class PricingService {
  /**
   * Limpa o cache em memória (útil para testes unitários).
   */
  public static clearCache(): void {
    pricingCache.clear();
  }

  /**
   * Consulta as métricas consolidadas do Balizador de Preços Regionais para um bairro/cidade.
   * Se o registro não existir ou estiver desatualizado, pode disparar a RPC do banco.
   */
  public static async getRegionalPricing(params: PricingQueryParams): Promise<RegionalPricingMetrics> {
    const { stateId, cityId, neighborhoodId, transportModal = 'all' } = params;

    if (!stateId || !cityId || !neighborhoodId) {
      throw new Error('Estado, cidade e bairro são obrigatórios para consultar o balizador regional.');
    }

    const cacheKey = `${stateId.toUpperCase()}:${cityId}:${neighborhoodId}:${transportModal}`;
    const cached = pricingCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // 1. Tenta buscar métricas já consolidadas na tabela com timeout defensivo
    try {
      const selectQuery = supabase
        .from('regional_pricing_metrics')
        .select('*')
        .eq('state_id', stateId.toUpperCase())
        .eq('city_id', cityId)
        .eq('neighborhood_id', neighborhoodId)
        .eq('transport_modal', transportModal)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) => {
        const timer = setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 40);
        timer.unref?.();
      });

      const { data: metricsRow, error: selectError } = await Promise.race([selectQuery, timeoutPromise]);

      if (metricsRow && !selectError) {
        const result = this.mapRowToMetrics(metricsRow);
        pricingCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
        return result;
      }
    } catch {
      // Continua para RPC em caso de erro de rede
    }

    // 2. Se não encontrou, executa a RPC analítica calculate_regional_pricing_iqr com timeout
    try {
      const rpcQuery = supabase.rpc('calculate_regional_pricing_iqr', {
        p_state_id: stateId.toUpperCase(),
        p_city_id: cityId,
        p_neighborhood_id: neighborhoodId,
        p_transport_modal: transportModal,
        p_window_days: 14
      });

      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) => {
        const timer = setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 40);
        timer.unref?.();
      });

      const { data: rpcRow, error: rpcError } = await Promise.race([rpcQuery, timeoutPromise]);

      if (rpcRow && !rpcError) {
        const result = this.mapRowToMetrics(rpcRow);
        pricingCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
        return result;
      }
    } catch {
      // Continua para fallback em caso de indisponibilidade
    }

    // 3. Fallback neutro padrão caso o banco ainda não tenha dados
    const defaultMetrics: RegionalPricingMetrics = {
      stateId: stateId.toUpperCase(),
      cityId,
      neighborhoodId,
      transportModal,
      sampleSize: 0,
      windowDays: 14,
      isConsolidated: false,
      q1DailyRate: 0,
      medianDailyRate: 0,
      q3DailyRate: 0,
      iqrDailyRate: 0,
      minDailyRate: 0,
      maxDailyRate: 0,
      q1DeliveryFee: 0,
      medianDeliveryFee: 0,
      q3DeliveryFee: 0,
      iqrDeliveryFee: 0,
      minDeliveryFee: 0,
      maxDeliveryFee: 0,
      outliersExpunged: 0
    };

    pricingCache.set(cacheKey, { data: defaultMetrics, expiresAt: Date.now() + CACHE_TTL_MS });
    return defaultMetrics;
  }

  /**
   * Registra métricas pré-consolidadas no cache (útil para testes e mocking).
   */
  public static setMockMetrics(metrics: Partial<RegionalPricingMetrics> & { cityId: string; neighborhoodId: string }): void {
    const stateId = (metrics.stateId || 'RJ').toUpperCase();
    const transportModal = metrics.transportModal || 'all';
    const fullMetrics: RegionalPricingMetrics = {
      stateId,
      cityId: metrics.cityId,
      neighborhoodId: metrics.neighborhoodId,
      transportModal,
      sampleSize: metrics.sampleSize || 0,
      windowDays: metrics.windowDays || 14,
      isConsolidated: metrics.isConsolidated ?? false,
      q1DailyRate: metrics.q1DailyRate || 0,
      medianDailyRate: metrics.medianDailyRate || 0,
      q3DailyRate: metrics.q3DailyRate || 0,
      iqrDailyRate: metrics.iqrDailyRate || 0,
      minDailyRate: metrics.minDailyRate || 0,
      maxDailyRate: metrics.maxDailyRate || 0,
      q1DeliveryFee: metrics.q1DeliveryFee || 0,
      medianDeliveryFee: metrics.medianDeliveryFee || 0,
      q3DeliveryFee: metrics.q3DeliveryFee || 0,
      iqrDeliveryFee: metrics.iqrDeliveryFee || 0,
      minDeliveryFee: metrics.minDeliveryFee || 0,
      maxDeliveryFee: metrics.maxDeliveryFee || 0,
      outliersExpunged: metrics.outliersExpunged || 0,
      calculatedAt: metrics.calculatedAt || new Date().toISOString()
    };

    const cacheKey = `${stateId}:${metrics.cityId}:${metrics.neighborhoodId}:${transportModal}`;
    pricingCache.set(cacheKey, { data: fullMetrics, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  private static mapRowToMetrics(row: any): RegionalPricingMetrics {
    return {
      id: row.id,
      stateId: row.state_id,
      cityId: row.city_id,
      neighborhoodId: row.neighborhood_id,
      transportModal: row.transport_modal || 'all',
      sampleSize: Number(row.sample_size) || 0,
      windowDays: Number(row.window_days) || 14,
      isConsolidated: Boolean(row.is_consolidated),
      q1DailyRate: Number(row.q1_daily_rate) || 0,
      medianDailyRate: Number(row.median_daily_rate) || 0,
      q3DailyRate: Number(row.q3_daily_rate) || 0,
      iqrDailyRate: Number(row.iqr_daily_rate) || 0,
      minDailyRate: Number(row.min_daily_rate) || 0,
      maxDailyRate: Number(row.max_daily_rate) || 0,
      q1DeliveryFee: Number(row.q1_delivery_fee) || 0,
      medianDeliveryFee: Number(row.median_delivery_fee) || 0,
      q3DeliveryFee: Number(row.q3_delivery_fee) || 0,
      iqrDeliveryFee: Number(row.iqr_delivery_fee) || 0,
      minDeliveryFee: Number(row.min_delivery_fee) || 0,
      maxDeliveryFee: Number(row.max_delivery_fee) || 0,
      outliersExpunged: Number(row.outliers_expunged) || 0,
      calculatedAt: row.calculated_at
    };
  }

  /**
   * Calcula recomendação de preços de mercado ("Sugerir Preço de Mercado").
   */
  public static calculateSuggestedPricing(metrics: RegionalPricingMetrics): SuggestedPricing {
    if (metrics.sampleSize >= 10 && metrics.isConsolidated) {
      return {
        suggestedDailyRate: metrics.medianDailyRate || 120,
        suggestedDeliveryFee: metrics.medianDeliveryFee || 8,
        source: 'neighborhood',
        confidence: 'high'
      };
    }

    if (metrics.medianDailyRate > 0 || metrics.medianDeliveryFee > 0) {
      return {
        suggestedDailyRate: metrics.medianDailyRate || 110,
        suggestedDeliveryFee: metrics.medianDeliveryFee || 7,
        source: 'city',
        confidence: 'medium'
      };
    }

    return {
      suggestedDailyRate: 100,
      suggestedDeliveryFee: 6,
      source: 'default',
      confidence: 'low'
    };
  }

  /**
   * Constrói resposta de erro padronizada conforme RFC 7807 (Problem Details).
   */
  public static createProblemDetails(params: {
    status: number;
    title: string;
    detail: string;
    instance: string;
    invalidParams?: Array<{ name: string; reason: string }>;
  }): RFC7807ProblemDetails {
    const errorTypeMap: Record<number, string> = {
      400: 'https://delivrery.app/errors/bad-request',
      404: 'https://delivrery.app/errors/not-found',
      405: 'https://delivrery.app/errors/method-not-allowed',
      429: 'https://delivrery.app/errors/rate-limit-exceeded',
      500: 'https://delivrery.app/errors/internal-server-error'
    };

    return {
      type: errorTypeMap[params.status] || 'https://delivrery.app/errors/general-error',
      title: params.title,
      status: params.status,
      detail: params.detail,
      instance: params.instance,
      ...(params.invalidParams && params.invalidParams.length > 0 ? { invalidParams: params.invalidParams } : {})
    };
  }

  /**
   * Handler HTTP para o endpoint GET /api/v1/analytics/pricing-stats.
   * Suporta CORS, validação RFC 7807, caching HTTP e execução em alta performance (< 100ms).
   */
  public static async handlePricingStatsRequest(req: {
    method: string;
    url?: string;
    queryParams?: Record<string, string | undefined>;
    headers?: Record<string, string | undefined>;
  }): Promise<{ status: number; headers: Record<string, string>; body: any }> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    };

    // 1. Preflight CORS
    if (req.method === 'OPTIONS') {
      return {
        status: 204,
        headers: {
          ...corsHeaders,
          'Content-Length': '0'
        },
        body: null
      };
    }

    const instanceUri = req.url || '/api/v1/analytics/pricing-stats';

    // 2. Restrição de método HTTP (somente GET)
    if (req.method !== 'GET') {
      const problem = this.createProblemDetails({
        status: 405,
        title: 'Método Não Permitido',
        detail: `O método HTTP ${req.method} não é suportado para este endpoint analítico. Use GET.`,
        instance: instanceUri
      });

      return {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/problem+json; charset=utf-8',
          'Allow': 'GET, OPTIONS'
        },
        body: problem
      };
    }

    // 3. Extração e validação de parâmetros de consulta
    const query = req.queryParams || {};
    const cityId = query.city_id || query.cityId || '';
    const neighborhoodId = query.neighborhood_id || query.neighborhoodId || '';
    const stateId = (query.state_id || query.stateId || 'RJ').toUpperCase();
    const transportModal = query.transport_modal || query.transportModal || 'all';

    const missingParams: Array<{ name: string; reason: string }> = [];
    if (!cityId) missingParams.push({ name: 'city_id', reason: 'Identificador do município é obrigatório.' });
    if (!neighborhoodId) missingParams.push({ name: 'neighborhood_id', reason: 'Identificador do bairro é obrigatório.' });

    if (missingParams.length > 0) {
      const problem = this.createProblemDetails({
        status: 400,
        title: 'Parâmetros Obrigatórios Ausentes',
        detail: 'A consulta ao balizador regional requer a especificação de city_id e neighborhood_id.',
        instance: instanceUri,
        invalidParams: missingParams
      });

      return {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/problem+json; charset=utf-8'
        },
        body: problem
      };
    }

    // 4. Execução da consulta analítica
    const cacheKey = `${stateId}:${cityId}:${neighborhoodId}:${transportModal}`;
    const isCached = Boolean(pricingCache.has(cacheKey) && (pricingCache.get(cacheKey)?.expiresAt || 0) > Date.now());

    const metrics = await this.getRegionalPricing({
      stateId,
      cityId,
      neighborhoodId,
      transportModal
    });

    const suggestedPricing = this.calculateSuggestedPricing(metrics);

    const etag = `W/"${stateId}-${cityId}-${neighborhoodId}-${transportModal}-${metrics.sampleSize}-${metrics.isConsolidated}"`;

    return {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
        'ETag': etag
      },
      body: {
        data: {
          ...metrics,
          suggestedPricing
        },
        cached: isCached,
        serverTime: new Date().toISOString()
      }
    };
  }
}
