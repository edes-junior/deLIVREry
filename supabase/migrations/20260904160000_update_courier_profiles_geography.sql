-- ==============================================================================
-- Migration: 20260904160000_update_courier_profiles_geography.sql
-- Description: Adiciona colunas geográficas (state_id, city_id, home_neighborhood_id),
--              referred_by_id e trigger de atualização de quórum em region_unlocks.
-- ==============================================================================

-- 1. Expansão da tabela courier_profiles com campos geográficos e indicação
ALTER TABLE public.courier_profiles 
    ADD COLUMN IF NOT EXISTS state_id VARCHAR(2),
    ADD COLUMN IF NOT EXISTS city_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS home_neighborhood_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS rate_updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- Constraints de formato para state_id em courier_profiles
ALTER TABLE public.courier_profiles DROP CONSTRAINT IF EXISTS check_courier_state_id_format;
ALTER TABLE public.courier_profiles ADD CONSTRAINT check_courier_state_id_format 
    CHECK (state_id IS NULL OR (length(state_id) = 2 AND state_id = UPPER(state_id)));

-- Índices de performance geográfica
CREATE INDEX IF NOT EXISTS idx_courier_profiles_geography 
    ON public.courier_profiles(state_id, city_id, home_neighborhood_id);

CREATE INDEX IF NOT EXISTS idx_courier_profiles_referred_by 
    ON public.courier_profiles(referred_by_id);

-- ==============================================================================
-- 2. Função e Trigger para Sincronização Automática de Quórum em region_unlocks
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.sync_region_unlock_quorum()
RETURNS TRIGGER AS $$
DECLARE
    target_state VARCHAR(2);
    target_city VARCHAR(100);
    target_neighborhood VARCHAR(100);
    is_courier BOOLEAN := false;
BEGIN
    IF TG_TABLE_NAME = 'courier_profiles' THEN
        target_state := NEW.state_id;
        target_city := NEW.city_id;
        target_neighborhood := NEW.home_neighborhood_id;
        is_courier := true;
    ELSIF TG_TABLE_NAME = 'store_profiles' THEN
        target_state := NEW.state_id;
        target_city := NEW.city_id;
        target_neighborhood := NEW.neighborhood_id;
        is_courier := false;
    END IF;

    -- Ignora registros com localização incompleta
    IF target_state IS NULL OR target_city IS NULL OR target_neighborhood IS NULL THEN
        RETURN NEW;
    END IF;

    -- Insere ou atualiza o contador de quórum para o bairro
    INSERT INTO public.region_unlocks (
        state_id, 
        city_id, 
        neighborhood_id, 
        couriers_count, 
        stores_count, 
        is_unlocked, 
        unlocked_at
    )
    VALUES (
        target_state, 
        target_city, 
        target_neighborhood, 
        CASE WHEN is_courier THEN 1 ELSE 0 END,
        CASE WHEN NOT is_courier THEN 1 ELSE 0 END,
        false,
        NULL
    )
    ON CONFLICT (state_id, city_id, neighborhood_id) DO UPDATE
    SET 
        couriers_count = public.region_unlocks.couriers_count + (CASE WHEN is_courier THEN 1 ELSE 0 END),
        stores_count = public.region_unlocks.stores_count + (CASE WHEN NOT is_courier THEN 1 ELSE 0 END),
        is_unlocked = CASE 
            WHEN (public.region_unlocks.couriers_count + (CASE WHEN is_courier THEN 1 ELSE 0 END) >= 50)
             AND (public.region_unlocks.stores_count + (CASE WHEN NOT is_courier THEN 1 ELSE 0 END) >= 10)
            THEN true 
            ELSE public.region_unlocks.is_unlocked 
        END,
        unlocked_at = CASE 
            WHEN (public.region_unlocks.couriers_count + (CASE WHEN is_courier THEN 1 ELSE 0 END) >= 50)
             AND (public.region_unlocks.stores_count + (CASE WHEN NOT is_courier THEN 1 ELSE 0 END) >= 10)
             AND public.region_unlocks.unlocked_at IS NULL
            THEN timezone('utc'::text, now())
            ELSE public.region_unlocks.unlocked_at
        END,
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers para courier_profiles e store_profiles
DROP TRIGGER IF EXISTS trg_courier_quorum_sync ON public.courier_profiles;
CREATE TRIGGER trg_courier_quorum_sync
    AFTER INSERT ON public.courier_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_region_unlock_quorum();

DROP TRIGGER IF EXISTS trg_store_quorum_sync ON public.store_profiles;
CREATE TRIGGER trg_store_quorum_sync
    AFTER INSERT ON public.store_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_region_unlock_quorum();
