/**
 * @file pricing-service.ts
 * @description Camada de serviço de domínio para o Balizador Inteligente de Preços Regionais (FR-7, FR-8).
 * Implementa o algoritmo de expurgo estatístico de Tukey (1.5xIQR) e consulta resiliente com cache.
 */

import { supabase } from '../lib/supabase.ts';
import type { IQRCalculationResult, RegionalPricingMetrics, PricingQueryParams } from './types.ts';

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

    // 1. Tenta buscar métricas já consolidadas na tabela
    const { data: metricsRow, error: selectError } = await supabase
      .from('regional_pricing_metrics')
      .select('*')
      .eq('state_id', stateId.toUpperCase())
      .eq('city_id', cityId)
      .eq('neighborhood_id', neighborhoodId)
      .eq('transport_modal', transportModal)
      .maybeSingle();

    if (metricsRow && !selectError) {
      const result = this.mapRowToMetrics(metricsRow);
      pricingCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    }

    // 2. Se não encontrou, executa a RPC analítica calculate_regional_pricing_iqr
    const { data: rpcRow, error: rpcError } = await supabase.rpc('calculate_regional_pricing_iqr', {
      p_state_id: stateId.toUpperCase(),
      p_city_id: cityId,
      p_neighborhood_id: neighborhoodId,
      p_transport_modal: transportModal,
      p_window_days: 14
    });

    if (rpcRow && !rpcError) {
      const result = this.mapRowToMetrics(rpcRow);
      pricingCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
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

    return defaultMetrics;
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
}
