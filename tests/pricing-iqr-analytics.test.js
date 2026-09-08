import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { calculateIQR, calculatePercentile, PricingService } from '../apps/pwa/src/pricing/pricing-service.ts';

describe('Story 3.1: Algoritmo Estatístico de Tukey (1.5xIQR) e Expurgo de Outliers (FR-8)', () => {
  beforeEach(() => {
    PricingService.clearCache();
  });

  it('deve calcular percentis contínuos com interpolação linear (compatível com PostgreSQL)', () => {
    const values = [10, 20, 30, 40, 50];
    assert.strictEqual(calculatePercentile(values, 0.0), 10);
    assert.strictEqual(calculatePercentile(values, 0.5), 30);
    assert.strictEqual(calculatePercentile(values, 1.0), 50);

    // Amostra de 4 elementos: index = 0.5 * (4 - 1) = 1.5 -> média entre 20 e 30 = 25
    const fourValues = [10, 20, 30, 40];
    assert.strictEqual(calculatePercentile(fourValues, 0.5), 25);
  });

  it('deve calcular Q1, Mediana, Q3, IQR e limites para amostra homogênea sem outliers (Matriz Linha 1)', () => {
    // Amostra de diárias típicas de R$ 100 a R$ 140
    const rates = [100, 105, 110, 115, 120, 125, 130, 135, 140];
    const result = calculateIQR(rates);

    assert.strictEqual(result.cleanValues.length, 9);
    assert.strictEqual(result.outliers.length, 0);
    assert.strictEqual(result.median, 120);
    assert.strictEqual(result.q1, 110);
    assert.strictEqual(result.q3, 130);
    assert.strictEqual(result.iqr, 20);
    // Limite inferior: 110 - (1.5 * 20) = 80
    assert.strictEqual(result.lowerBound, 80);
    // Limite superior: 130 + (1.5 * 20) = 160
    assert.strictEqual(result.upperBound, 160);
    assert.strictEqual(result.min, 100);
    assert.strictEqual(result.max, 140);
  });

  it('deve expurgar outliers extremos aberrantes superiores e inferiores (Matriz Linha 2)', () => {
    // Diárias comuns: 100, 110, 120, 120, 125, 130, 140
    // Outliers introduzidos: R$ 5,00 (erro de digitação) e R$ 1.000,00 (manipulação predatória)
    const dirtyRates = [5, 100, 105, 110, 115, 120, 125, 130, 140, 1000];
    const result = calculateIQR(dirtyRates);

    // Deve identificar exatamente os dois outliers
    assert.ok(result.outliers.includes(5), 'R$ 5,00 deveria ser identificado como outlier inferior');
    assert.ok(result.outliers.includes(1000), 'R$ 1.000,00 deveria ser identificado como outlier superior');
    assert.strictEqual(result.outliers.length, 2);

    // Amostra limpa deve conter apenas valores legítimos
    assert.strictEqual(result.cleanValues.length, 8);
    assert.ok(!result.cleanValues.includes(5));
    assert.ok(!result.cleanValues.includes(1000));

    // Mediana e limites não podem ser distorcidos
    assert.ok(result.median >= 110 && result.median <= 125, `Mediana esperada em torno de 117, obtido: ${result.median}`);
    assert.strictEqual(result.min, 100);
    assert.strictEqual(result.max, 140);
  });

  it('deve garantir que o limite inferior nunca seja negativo (P_min >= 0)', () => {
    const lowRates = [5, 6, 7, 8, 9, 20];
    const result = calculateIQR(lowRates);

    assert.ok(result.lowerBound >= 0, 'Limite inferior deve ser >= 0');
    assert.ok(result.min >= 0, 'Valor mínimo deve ser >= 0');
  });

  it('deve sanitizar entradas vazias, nulas ou não numéricas (Matriz Linha 3)', () => {
    const emptyResult = calculateIQR([]);
    assert.strictEqual(emptyResult.median, 0);
    assert.strictEqual(emptyResult.cleanValues.length, 0);
    assert.strictEqual(emptyResult.outliers.length, 0);

    const nullResult = calculateIQR(null);
    assert.strictEqual(nullResult.median, 0);

    const dirtyInput = [100, NaN, -50, null, undefined, 120, '150', 130];
    const cleaned = calculateIQR(dirtyInput);
    assert.strictEqual(cleaned.cleanValues.length, 3); // 100, 120, 130
    assert.strictEqual(cleaned.median, 120);
  });

  it('deve validar parâmetros obrigatórios no serviço de consulta (PricingService)', async () => {
    await assert.rejects(
      async () => {
        await PricingService.getRegionalPricing({
          stateId: '',
          cityId: 'rio-de-janeiro',
          neighborhoodId: 'copacabana'
        });
      },
      /Estado, cidade e bairro são obrigatórios/
    );
  });
});

describe('Story 3.1: Integridade da Migration DDL de Preços Regionais e IQR', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260904210000_regional_pricing_iqr_analytics.sql'
  );

  it('deve verificar a existência do arquivo SQL de migration', () => {
    assert.ok(fs.existsSync(migrationPath), 'Arquivo de migration regional pricing deve existir');
  });

  it('deve conter a definição da tabela regional_pricing_metrics e índices', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.regional_pricing_metrics'), 'Deve criar regional_pricing_metrics');
    assert.ok(sql.includes('state_id VARCHAR(2) NOT NULL'), 'Deve conter state_id');
    assert.ok(sql.includes('city_id VARCHAR(100) NOT NULL'), 'Deve conter city_id');
    assert.ok(sql.includes('neighborhood_id VARCHAR(100) NOT NULL'), 'Deve conter neighborhood_id');
    assert.ok(sql.includes('transport_modal VARCHAR(30) NOT NULL'), 'Deve conter transport_modal');
    assert.ok(sql.includes('sample_size INTEGER NOT NULL'), 'Deve conter sample_size');
    assert.ok(sql.includes('is_consolidated BOOLEAN NOT NULL'), 'Deve conter is_consolidated');
    assert.ok(sql.includes('q1_daily_rate NUMERIC(10, 2)'), 'Deve conter q1_daily_rate');
    assert.ok(sql.includes('median_daily_rate NUMERIC(10, 2)'), 'Deve conter median_daily_rate');
    assert.ok(sql.includes('q3_daily_rate NUMERIC(10, 2)'), 'Deve conter q3_daily_rate');
    assert.ok(sql.includes('iqr_daily_rate NUMERIC(10, 2)'), 'Deve conter iqr_daily_rate');
    assert.ok(sql.includes('outliers_expunged INTEGER NOT NULL'), 'Deve conter outliers_expunged');
    assert.ok(sql.includes('uq_regional_pricing UNIQUE'), 'Deve ter constraint de unicidade');
  });

  it('deve conter a função PL/pgSQL calculate_regional_pricing_iqr com percentil e corte Tukey', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.calculate_regional_pricing_iqr'), 'Deve criar função analítica');
    assert.ok(sql.includes('percentile_cont(0.25)'), 'Deve calcular Q1');
    assert.ok(sql.includes('percentile_cont(0.50)'), 'Deve calcular Mediana');
    assert.ok(sql.includes('percentile_cont(0.75)'), 'Deve calcular Q3');
    assert.ok(sql.includes('1.5 * v_iqr_daily'), 'Deve aplicar multiplicador 1.5 IQR');
    assert.ok(sql.includes('v_raw_count < 10'), 'Deve conter checagem de amostra mínima < 10');
  });

  it('deve conter ativação de RLS e políticas de leitura pública e escrita restrita', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.ok(sql.includes('ALTER TABLE public.regional_pricing_metrics ENABLE ROW LEVEL SECURITY;'));
    assert.ok(sql.includes('CREATE POLICY "Public can view regional pricing metrics"'));
    assert.ok(sql.includes('CREATE POLICY "Service role manages regional pricing metrics"'));
  });
});
