-- ==============================================================================
-- Migration: 20260904210000_regional_pricing_iqr_analytics.sql
-- Description: Tabela e função analítica de cálculo de preços regionais com
--              expurgo estatístico de outliers via filtro 1.5xIQR de Tukey (FR-7, FR-8).
-- Architecture: Hexagonal / Supabase PostgreSQL 15+
-- ==============================================================================

-- 1. Tabela: regional_pricing_metrics (Métricas consolidadas do Balizador)
CREATE TABLE IF NOT EXISTS public.regional_pricing_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_id VARCHAR(2) NOT NULL,
    city_id VARCHAR(100) NOT NULL,
    neighborhood_id VARCHAR(100) NOT NULL,
    transport_modal VARCHAR(30) NOT NULL DEFAULT 'all',
    sample_size INTEGER NOT NULL DEFAULT 0,
    window_days INTEGER NOT NULL DEFAULT 14,
    is_consolidated BOOLEAN NOT NULL DEFAULT true,

    -- Diária (Daily Rate)
    q1_daily_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    median_daily_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    q3_daily_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    iqr_daily_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    min_daily_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    max_daily_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,

    -- Taxa por Entrega (Delivery Fee)
    q1_delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    median_delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    q3_delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    iqr_delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    min_delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    max_delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,

    outliers_expunged INTEGER NOT NULL DEFAULT 0,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_regional_pricing UNIQUE (state_id, city_id, neighborhood_id, transport_modal),
    CONSTRAINT check_pricing_state_format CHECK (length(state_id) = 2 AND state_id = UPPER(state_id)),
    CONSTRAINT check_pricing_rates_non_negative CHECK (
        min_daily_rate >= 0.00 AND median_daily_rate >= 0.00 AND max_daily_rate >= 0.00 AND
        min_delivery_fee >= 0.00 AND median_delivery_fee >= 0.00 AND max_delivery_fee >= 0.00
    )
);

CREATE INDEX IF NOT EXISTS idx_regional_pricing_lookup 
    ON public.regional_pricing_metrics(state_id, city_id, neighborhood_id, transport_modal);

CREATE INDEX IF NOT EXISTS idx_regional_pricing_city 
    ON public.regional_pricing_metrics(state_id, city_id);

DROP TRIGGER IF EXISTS trg_regional_pricing_updated_at ON public.regional_pricing_metrics;
CREATE TRIGGER trg_regional_pricing_updated_at
    BEFORE UPDATE ON public.regional_pricing_metrics
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 2. Função Analítica: calculate_regional_pricing_iqr
--    Calcula quartis, aplica expurgo Tukey 1.5xIQR e persiste os limites
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.calculate_regional_pricing_iqr(
    p_state_id VARCHAR(2),
    p_city_id VARCHAR(100),
    p_neighborhood_id VARCHAR(100),
    p_transport_modal VARCHAR(30) DEFAULT 'all',
    p_window_days INTEGER DEFAULT 14
)
RETURNS public.regional_pricing_metrics AS $$
DECLARE
    v_raw_count INTEGER := 0;
    v_clean_count INTEGER := 0;
    v_is_consolidated BOOLEAN := true;
    v_outliers_expunged INTEGER := 0;

    -- Estatísticas da Amostra Bruta
    v_q1_daily NUMERIC(10, 2) := 0.00;
    v_med_daily NUMERIC(10, 2) := 0.00;
    v_q3_daily NUMERIC(10, 2) := 0.00;
    v_iqr_daily NUMERIC(10, 2) := 0.00;
    v_lower_daily NUMERIC(10, 2) := 0.00;
    v_upper_daily NUMERIC(10, 2) := 0.00;

    v_q1_fee NUMERIC(10, 2) := 0.00;
    v_med_fee NUMERIC(10, 2) := 0.00;
    v_q3_fee NUMERIC(10, 2) := 0.00;
    v_iqr_fee NUMERIC(10, 2) := 0.00;
    v_lower_fee NUMERIC(10, 2) := 0.00;
    v_upper_fee NUMERIC(10, 2) := 0.00;

    -- Estatísticas da Amostra Limpa (Pós-Expurgo)
    v_clean_min_daily NUMERIC(10, 2) := 0.00;
    v_clean_med_daily NUMERIC(10, 2) := 0.00;
    v_clean_max_daily NUMERIC(10, 2) := 0.00;
    v_clean_min_fee NUMERIC(10, 2) := 0.00;
    v_clean_med_fee NUMERIC(10, 2) := 0.00;
    v_clean_max_fee NUMERIC(10, 2) := 0.00;

    v_result public.regional_pricing_metrics;
BEGIN
    -- 1. Verifica contagem no bairro específico
    SELECT count(*)
    INTO v_raw_count
    FROM public.job_posts p
    WHERE p.state_id = UPPER(p_state_id)
      AND p.city_id = p_city_id
      AND p.neighborhood_id = p_neighborhood_id
      AND p.status IN ('matched', 'in_progress', 'completed')
      AND p.created_at >= timezone('utc'::text, now()) - (p_window_days || ' days')::INTERVAL
      AND (p_transport_modal = 'all' OR p_transport_modal = ANY(p.accepted_modals));

    -- Se amostra for insuficiente (< 10), aciona fallback municipal
    IF v_raw_count < 10 THEN
        v_is_consolidated := false;
    ELSE
        v_is_consolidated := true;
    END IF;

    -- 2. Coleta valores brutos para cálculo de quartis
    WITH raw_samples AS (
        SELECT
            COALESCE(b.bid_daily_rate, p.offered_daily_rate) AS daily_rate,
            COALESCE(b.bid_delivery_fee, p.offered_delivery_fee) AS delivery_fee
        FROM public.job_posts p
        LEFT JOIN public.job_bids b ON p.matched_bid_id = b.id
        WHERE p.state_id = UPPER(p_state_id)
          AND p.city_id = p_city_id
          AND (v_is_consolidated = false OR p.neighborhood_id = p_neighborhood_id)
          AND p.status IN ('matched', 'in_progress', 'completed')
          AND p.created_at >= timezone('utc'::text, now()) - (p_window_days || ' days')::INTERVAL
          AND (p_transport_modal = 'all' OR p_transport_modal = ANY(p.accepted_modals))
    )
    SELECT
        count(*),
        COALESCE(percentile_cont(0.25) WITHIN GROUP (ORDER BY daily_rate), 0.00)::NUMERIC(10, 2),
        COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY daily_rate), 0.00)::NUMERIC(10, 2),
        COALESCE(percentile_cont(0.75) WITHIN GROUP (ORDER BY daily_rate), 0.00)::NUMERIC(10, 2),
        COALESCE(percentile_cont(0.25) WITHIN GROUP (ORDER BY delivery_fee), 0.00)::NUMERIC(10, 2),
        COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY delivery_fee), 0.00)::NUMERIC(10, 2),
        COALESCE(percentile_cont(0.75) WITHIN GROUP (ORDER BY delivery_fee), 0.00)::NUMERIC(10, 2)
    INTO
        v_raw_count,
        v_q1_daily, v_med_daily, v_q3_daily,
        v_q1_fee, v_med_fee, v_q3_fee
    FROM raw_samples;

    -- Se não houver amostras nem no fallback, retorna métricas neutras
    IF v_raw_count = 0 THEN
        INSERT INTO public.regional_pricing_metrics (
            state_id, city_id, neighborhood_id, transport_modal,
            sample_size, window_days, is_consolidated,
            q1_daily_rate, median_daily_rate, q3_daily_rate, iqr_daily_rate, min_daily_rate, max_daily_rate,
            q1_delivery_fee, median_delivery_fee, q3_delivery_fee, iqr_delivery_fee, min_delivery_fee, max_delivery_fee,
            outliers_expunged, calculated_at, updated_at
        ) VALUES (
            UPPER(p_state_id), p_city_id, p_neighborhood_id, p_transport_modal,
            0, p_window_days, false,
            0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
            0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
            0, timezone('utc'::text, now()), timezone('utc'::text, now())
        )
        ON CONFLICT (state_id, city_id, neighborhood_id, transport_modal) DO UPDATE
        SET sample_size = 0, is_consolidated = false, calculated_at = timezone('utc'::text, now()), updated_at = timezone('utc'::text, now())
        RETURNING * INTO v_result;

        RETURN v_result;
    END IF;

    -- 3. Cálculo do IQR e Limites de Corte de Tukey
    v_iqr_daily := GREATEST(0.00, v_q3_daily - v_q1_daily);
    v_lower_daily := GREATEST(0.00, v_q1_daily - (1.5 * v_iqr_daily));
    v_upper_daily := v_q3_daily + (1.5 * v_iqr_daily);

    v_iqr_fee := GREATEST(0.00, v_q3_fee - v_q1_fee);
    v_lower_fee := GREATEST(0.00, v_q1_fee - (1.5 * v_iqr_fee));
    v_upper_fee := v_q3_fee + (1.5 * v_iqr_fee);

    -- 4. Agregação final sobre a amostra limpa (expurgo de outliers)
    WITH raw_samples AS (
        SELECT
            COALESCE(b.bid_daily_rate, p.offered_daily_rate) AS daily_rate,
            COALESCE(b.bid_delivery_fee, p.offered_delivery_fee) AS delivery_fee
        FROM public.job_posts p
        LEFT JOIN public.job_bids b ON p.matched_bid_id = b.id
        WHERE p.state_id = UPPER(p_state_id)
          AND p.city_id = p_city_id
          AND (v_is_consolidated = false OR p.neighborhood_id = p_neighborhood_id)
          AND p.status IN ('matched', 'in_progress', 'completed')
          AND p.created_at >= timezone('utc'::text, now()) - (p_window_days || ' days')::INTERVAL
          AND (p_transport_modal = 'all' OR p_transport_modal = ANY(p.accepted_modals))
    ),
    clean_samples AS (
        SELECT *
        FROM raw_samples
        WHERE daily_rate >= v_lower_daily AND daily_rate <= v_upper_daily
          AND delivery_fee >= v_lower_fee AND delivery_fee <= v_upper_fee
    )
    SELECT
        count(*),
        COALESCE(min(daily_rate), 0.00)::NUMERIC(10, 2),
        COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY daily_rate), 0.00)::NUMERIC(10, 2),
        COALESCE(max(daily_rate), 0.00)::NUMERIC(10, 2),
        COALESCE(min(delivery_fee), 0.00)::NUMERIC(10, 2),
        COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY delivery_fee), 0.00)::NUMERIC(10, 2),
        COALESCE(max(delivery_fee), 0.00)::NUMERIC(10, 2)
    INTO
        v_clean_count,
        v_clean_min_daily, v_clean_med_daily, v_clean_max_daily,
        v_clean_min_fee, v_clean_med_fee, v_clean_max_fee
    FROM clean_samples;

    v_outliers_expunged := GREATEST(0, v_raw_count - v_clean_count);

    -- 5. Gravação/Atualização atômica na tabela de métricas
    INSERT INTO public.regional_pricing_metrics (
        state_id,
        city_id,
        neighborhood_id,
        transport_modal,
        sample_size,
        window_days,
        is_consolidated,
        q1_daily_rate,
        median_daily_rate,
        q3_daily_rate,
        iqr_daily_rate,
        min_daily_rate,
        max_daily_rate,
        q1_delivery_fee,
        median_delivery_fee,
        q3_delivery_fee,
        iqr_delivery_fee,
        min_delivery_fee,
        max_delivery_fee,
        outliers_expunged,
        calculated_at,
        updated_at
    )
    VALUES (
        UPPER(p_state_id),
        p_city_id,
        p_neighborhood_id,
        p_transport_modal,
        v_clean_count,
        p_window_days,
        v_is_consolidated,
        v_q1_daily,
        COALESCE(v_clean_med_daily, v_med_daily),
        v_q3_daily,
        v_iqr_daily,
        v_clean_min_daily,
        v_clean_max_daily,
        v_q1_fee,
        COALESCE(v_clean_med_fee, v_med_fee),
        v_q3_fee,
        v_iqr_fee,
        v_clean_min_fee,
        v_clean_max_fee,
        v_outliers_expunged,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (state_id, city_id, neighborhood_id, transport_modal) DO UPDATE
    SET
        sample_size = EXCLUDED.sample_size,
        window_days = EXCLUDED.window_days,
        is_consolidated = EXCLUDED.is_consolidated,
        q1_daily_rate = EXCLUDED.q1_daily_rate,
        median_daily_rate = EXCLUDED.median_daily_rate,
        q3_daily_rate = EXCLUDED.q3_daily_rate,
        iqr_daily_rate = EXCLUDED.iqr_daily_rate,
        min_daily_rate = EXCLUDED.min_daily_rate,
        max_daily_rate = EXCLUDED.max_daily_rate,
        q1_delivery_fee = EXCLUDED.q1_delivery_fee,
        median_delivery_fee = EXCLUDED.median_delivery_fee,
        q3_delivery_fee = EXCLUDED.q3_delivery_fee,
        iqr_delivery_fee = EXCLUDED.iqr_delivery_fee,
        min_delivery_fee = EXCLUDED.min_delivery_fee,
        max_delivery_fee = EXCLUDED.max_delivery_fee,
        outliers_expunged = EXCLUDED.outliers_expunged,
        calculated_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 3. Row Level Security (RLS)
-- ==============================================================================
ALTER TABLE public.regional_pricing_metrics ENABLE ROW LEVEL SECURITY;

-- Leitura pública para exibição universal no PWA, Landing Pages e Balizador
DROP POLICY IF EXISTS "Public can view regional pricing metrics" ON public.regional_pricing_metrics;
CREATE POLICY "Public can view regional pricing metrics"
    ON public.regional_pricing_metrics
    FOR SELECT
    USING (true);

-- Modificação restrita ao backend / service_role
DROP POLICY IF EXISTS "Service role manages regional pricing metrics" ON public.regional_pricing_metrics;
CREATE POLICY "Service role manages regional pricing metrics"
    ON public.regional_pricing_metrics
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role' OR auth.role() = 'service_role')
    WITH CHECK (auth.jwt()->>'role' = 'service_role' OR auth.role() = 'service_role');
