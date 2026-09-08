/**
 * @file quorum-service.ts
 * @description Serviço de consulta e cálculo de métricas de Quórum Hiperlocal (FR-13, AD-8).
 * Gerencia a ativação operacional territorial (10 lojistas e 50 entregadores para desbloqueio).
 */

import { supabase } from '../lib/supabase.ts';

export const REQUIRED_STORES_QUORUM = 10;
export const REQUIRED_COURIERS_QUORUM = 50;

export interface QuorumMetrics {
  couriersCount: number;
  storesCount: number;
  requiredCouriers: number;
  requiredStores: number;
  courierPercentage: number;
  storePercentage: number;
  overallPercentage: number;
  isUnlocked: boolean;
  status: 'pre_launch' | 'unlocked';
}

export interface RegionQuorum extends QuorumMetrics {
  stateId: string;
  cityId: string;
  neighborhoodId: string;
  unlockedAt: string | null;
}

/**
 * Calcula determinísticamente as porcentagens e status de quórum regional.
 */
export function calculateQuorumMetrics(rawCouriers = 0, rawStores = 0): QuorumMetrics {
  const couriersCount = Math.max(0, rawCouriers || 0);
  const storesCount = Math.max(0, rawStores || 0);

  const courierPercentage = Math.min(
    100,
    Math.round((couriersCount / REQUIRED_COURIERS_QUORUM) * 100)
  );

  const storePercentage = Math.min(
    100,
    Math.round((storesCount / REQUIRED_STORES_QUORUM) * 100)
  );

  const overallPercentage = Math.round((courierPercentage + storePercentage) / 2);

  const isUnlocked =
    couriersCount >= REQUIRED_COURIERS_QUORUM && storesCount >= REQUIRED_STORES_QUORUM;

  return {
    couriersCount,
    storesCount,
    requiredCouriers: REQUIRED_COURIERS_QUORUM,
    requiredStores: REQUIRED_STORES_QUORUM,
    courierPercentage,
    storePercentage,
    overallPercentage,
    isUnlocked,
    status: isUnlocked ? 'unlocked' : 'pre_launch'
  };
}

export class QuorumService {
  /**
   * Consulta o quórum de uma região específica (UF, Cidade, Bairro) no Supabase.
   * Se o registro ainda não existir no banco, retorna métricas zeradas com status 'pre_launch'.
   */
  public static async getRegionQuorum(
    stateId: string,
    cityId: string,
    neighborhoodId: string
  ): Promise<RegionQuorum> {
    if (!stateId || !cityId || !neighborhoodId) {
      const defaultMetrics = calculateQuorumMetrics(0, 0);
      return {
        ...defaultMetrics,
        stateId: stateId || '',
        cityId: cityId || '',
        neighborhoodId: neighborhoodId || '',
        unlockedAt: null
      };
    }

    const { data, error } = await supabase
      .from('region_unlocks')
      .select('*')
      .eq('state_id', stateId.toUpperCase())
      .eq('city_id', cityId)
      .eq('neighborhood_id', neighborhoodId)
      .maybeSingle();

    if (error) {
      console.warn('Erro ao consultar quórum regional:', error.message);
    }

    const couriersCount = data ? data.couriers_count : 0;
    const storesCount = data ? data.stores_count : 0;
    const metrics = calculateQuorumMetrics(couriersCount, storesCount);

    return {
      ...metrics,
      stateId: stateId.toUpperCase(),
      cityId,
      neighborhoodId,
      unlockedAt: data?.unlocked_at || null
    };
  }
}
