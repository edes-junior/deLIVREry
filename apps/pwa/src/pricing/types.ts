/**
 * @file types.ts
 * @description Modelos de dados e tipos para o Balizador Inteligente de Preços Regionais (FR-7, FR-8).
 */

export interface IQRCalculationResult {
  q1: number;
  median: number;
  q3: number;
  iqr: number;
  lowerBound: number;
  upperBound: number;
  outliers: number[];
  cleanValues: number[];
  min: number;
  max: number;
}

export interface RegionalPricingMetrics {
  id?: string;
  stateId: string;
  cityId: string;
  neighborhoodId: string;
  transportModal: string;
  sampleSize: number;
  windowDays: number;
  isConsolidated: boolean;

  // Diária (Daily Rate)
  q1DailyRate: number;
  medianDailyRate: number;
  q3DailyRate: number;
  iqrDailyRate: number;
  minDailyRate: number;
  maxDailyRate: number;

  // Taxa por Entrega (Delivery Fee)
  q1DeliveryFee: number;
  medianDeliveryFee: number;
  q3DeliveryFee: number;
  iqrDeliveryFee: number;
  minDeliveryFee: number;
  maxDeliveryFee: number;

  outliersExpunged: number;
  calculatedAt?: string;
}

export interface PricingQueryParams {
  stateId: string;
  cityId: string;
  neighborhoodId: string;
  transportModal?: string;
}
