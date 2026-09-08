-- ==============================================================================
-- Migration: 20260904220000_rate_limit_velocity_lock.sql
-- Description: Implementa a Trava de Velocidade Tarifária (Rate Limiting de Preços)
--              limitando variações de tarifas base a no máximo ±30% em 12h (FR-9).
-- ==============================================================================

-- 1. Expansão de store_profiles com campos padrão de tarifa e timestamp de velocidade
ALTER TABLE public.store_profiles
    ADD COLUMN IF NOT EXISTS default_daily_rate NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS default_delivery_fee NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS rate_updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.store_profiles DROP CONSTRAINT IF EXISTS check_store_default_rates_positive;
ALTER TABLE public.store_profiles ADD CONSTRAINT check_store_default_rates_positive
    CHECK (default_daily_rate >= 0.00 AND default_delivery_fee >= 0.00);

-- Garantir constraint de tarifas positivas em courier_profiles
ALTER TABLE public.courier_profiles DROP CONSTRAINT IF EXISTS check_courier_base_rates_positive;
ALTER TABLE public.courier_profiles ADD CONSTRAINT check_courier_base_rates_positive
    CHECK (base_daily_rate >= 0.00 AND base_delivery_fee >= 0.00);

-- ==============================================================================
-- 2. Função PL/pgSQL para Verificação da Trava de Velocidade Tarifária (±30% em 12h)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_rate_velocity_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_window_interval INTERVAL := interval '12 hours';
    v_max_variation NUMERIC := 0.30;
    v_min_allowed NUMERIC;
    v_max_allowed NUMERIC;
    v_time_passed INTERVAL;
    v_time_remaining_minutes INTEGER;
BEGIN
    -- Se for tabela courier_profiles
    IF TG_TABLE_NAME = 'courier_profiles' THEN
        -- Só valida se houve alteração de valores de diária ou taxa
        IF (NEW.base_daily_rate <> OLD.base_daily_rate OR NEW.base_delivery_fee <> OLD.base_delivery_fee) THEN
            v_time_passed := timezone('utc'::text, now()) - OLD.rate_updated_at;

            IF v_time_passed < v_window_interval THEN
                v_time_remaining_minutes := GREATEST(1, ROUND(EXTRACT(EPOCH FROM (v_window_interval - v_time_passed)) / 60));

                -- Validação da Diária Base
                IF OLD.base_daily_rate > 0 AND NEW.base_daily_rate <> OLD.base_daily_rate THEN
                    v_min_allowed := ROUND(OLD.base_daily_rate * (1 - v_max_variation), 2);
                    v_max_allowed := ROUND(OLD.base_daily_rate * (1 + v_max_variation), 2);

                    IF NEW.base_daily_rate < v_min_allowed OR NEW.base_daily_rate > v_max_allowed THEN
                        RAISE EXCEPTION 'Trava de velocidade tarifária: alteração da diária base superior a 30%% bloqueada. Piso permitido: R$ %, Teto permitido: R$ %. Próxima atualização livre em % minutos.',
                            v_min_allowed, v_max_allowed, v_time_remaining_minutes
                            USING ERRCODE = 'P0001';
                    END IF;
                END IF;

                -- Validação da Taxa de Entrega
                IF OLD.base_delivery_fee > 0 AND NEW.base_delivery_fee <> OLD.base_delivery_fee THEN
                    v_min_allowed := ROUND(OLD.base_delivery_fee * (1 - v_max_variation), 2);
                    v_max_allowed := ROUND(OLD.base_delivery_fee * (1 + v_max_variation), 2);

                    IF NEW.base_delivery_fee < v_min_allowed OR NEW.base_delivery_fee > v_max_allowed THEN
                        RAISE EXCEPTION 'Trava de velocidade tarifária: alteração da taxa por entrega superior a 30%% bloqueada. Piso permitido: R$ %, Teto permitido: R$ %. Próxima atualização livre em % minutos.',
                            v_min_allowed, v_max_allowed, v_time_remaining_minutes
                            USING ERRCODE = 'P0001';
                    END IF;
                END IF;
            END IF;

            -- Se passou ou estava fora da janela, renova o timestamp
            NEW.rate_updated_at := timezone('utc'::text, now());
        END IF;

    -- Se for tabela store_profiles
    ELSIF TG_TABLE_NAME = 'store_profiles' THEN
        IF (NEW.default_daily_rate <> OLD.default_daily_rate OR NEW.default_delivery_fee <> OLD.default_delivery_fee) THEN
            v_time_passed := timezone('utc'::text, now()) - OLD.rate_updated_at;

            IF v_time_passed < v_window_interval THEN
                v_time_remaining_minutes := GREATEST(1, ROUND(EXTRACT(EPOCH FROM (v_window_interval - v_time_passed)) / 60));

                IF OLD.default_daily_rate > 0 AND NEW.default_daily_rate <> OLD.default_daily_rate THEN
                    v_min_allowed := ROUND(OLD.default_daily_rate * (1 - v_max_variation), 2);
                    v_max_allowed := ROUND(OLD.default_daily_rate * (1 + v_max_variation), 2);

                    IF NEW.default_daily_rate < v_min_allowed OR NEW.default_daily_rate > v_max_allowed THEN
                        RAISE EXCEPTION 'Trava de velocidade tarifária: alteração da diária ofertada superior a 30%% bloqueada. Piso permitido: R$ %, Teto permitido: R$ %. Próxima atualização livre em % minutos.',
                            v_min_allowed, v_max_allowed, v_time_remaining_minutes
                            USING ERRCODE = 'P0001';
                    END IF;
                END IF;

                IF OLD.default_delivery_fee > 0 AND NEW.default_delivery_fee <> OLD.default_delivery_fee THEN
                    v_min_allowed := ROUND(OLD.default_delivery_fee * (1 - v_max_variation), 2);
                    v_max_allowed := ROUND(OLD.default_delivery_fee * (1 + v_max_variation), 2);

                    IF NEW.default_delivery_fee < v_min_allowed OR NEW.default_delivery_fee > v_max_allowed THEN
                        RAISE EXCEPTION 'Trava de velocidade tarifária: alteração da taxa ofertada superior a 30%% bloqueada. Piso permitido: R$ %, Teto permitido: R$ %. Próxima atualização livre em % minutos.',
                            v_min_allowed, v_max_allowed, v_time_remaining_minutes
                            USING ERRCODE = 'P0001';
                    END IF;
                END IF;
            END IF;

            NEW.rate_updated_at := timezone('utc'::text, now());
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para courier_profiles e store_profiles
DROP TRIGGER IF EXISTS trg_courier_rate_velocity_lock ON public.courier_profiles;
CREATE TRIGGER trg_courier_rate_velocity_lock
    BEFORE UPDATE ON public.courier_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_rate_velocity_lock();

DROP TRIGGER IF EXISTS trg_store_rate_velocity_lock ON public.store_profiles;
CREATE TRIGGER trg_store_rate_velocity_lock
    BEFORE UPDATE ON public.store_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_rate_velocity_lock();
