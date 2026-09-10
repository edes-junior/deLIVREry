-- ==============================================================================
-- Migration: 20260909200000_sync_quorum_on_profile_update.sql
-- Description: Garante imutabilidade de CPF e user_type na tabela users (CAP-1)
--              e atualiza gatilhos de sincronização de quórum em region_unlocks
--              para tratar UPDATE de bairro com decremento e incremento transacional (CAP-6).
-- Architecture: Hexagonal / Supabase PostgreSQL 15+
-- ==============================================================================

-- ==============================================================================
-- 1. Imutabilidade Estrita de Identidade Civil (CPF) e Papel de Conta (user_type)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_user_cpf_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.cpf IS NOT NULL AND NEW.cpf IS DISTINCT FROM OLD.cpf THEN
        RAISE EXCEPTION 'O CPF é imutável após o cadastro inicial (regra CAP-1).' USING ERRCODE = '23514';
    END IF;

    IF OLD.user_type IS NOT NULL AND NEW.user_type IS DISTINCT FROM OLD.user_type THEN
        RAISE EXCEPTION 'O tipo de conta (user_type) é imutável após o cadastro inicial (regra CAP-1).' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_cpf_immutability ON public.users;
CREATE TRIGGER trg_users_cpf_immutability
    BEFORE UPDATE OF cpf, user_type ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.check_user_cpf_immutability();

-- ==============================================================================
-- 2. Atualização da Função de Sincronização de Quórum para INSERT e UPDATE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.sync_region_unlock_quorum()
RETURNS TRIGGER AS $$
DECLARE
    new_state VARCHAR(2);
    new_city VARCHAR(100);
    new_neighborhood VARCHAR(100);
    old_state VARCHAR(2);
    old_city VARCHAR(100);
    old_neighborhood VARCHAR(100);
    is_courier BOOLEAN := false;
    location_changed BOOLEAN := false;
BEGIN
    IF TG_TABLE_NAME = 'courier_profiles' THEN
        new_state := NEW.state_id;
        new_city := NEW.city_id;
        new_neighborhood := NEW.home_neighborhood_id;
        is_courier := true;
        IF TG_OP = 'UPDATE' THEN
            old_state := OLD.state_id;
            old_city := OLD.city_id;
            old_neighborhood := OLD.home_neighborhood_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'store_profiles' THEN
        new_state := NEW.state_id;
        new_city := NEW.city_id;
        new_neighborhood := NEW.neighborhood_id;
        is_courier := false;
        IF TG_OP = 'UPDATE' THEN
            old_state := OLD.state_id;
            old_city := OLD.city_id;
            old_neighborhood := OLD.neighborhood_id;
        END IF;
    END IF;

    -- Se for UPDATE e não houve alteração geográfica, encerra sem operações desnecessárias
    IF TG_OP = 'UPDATE' THEN
        IF (old_state IS NOT DISTINCT FROM new_state) AND 
           (old_city IS NOT DISTINCT FROM new_city) AND 
           (old_neighborhood IS NOT DISTINCT FROM new_neighborhood) THEN
            RETURN NEW;
        END IF;
        location_changed := true;
    END IF;

    -- 1. Se for UPDATE e a localização anterior era válida, decrementa os contadores do bairro de origem
    IF location_changed AND old_state IS NOT NULL AND old_city IS NOT NULL AND old_neighborhood IS NOT NULL THEN
        UPDATE public.region_unlocks
        SET 
            couriers_count = GREATEST(0, public.region_unlocks.couriers_count - (CASE WHEN is_courier THEN 1 ELSE 0 END)),
            stores_count = GREATEST(0, public.region_unlocks.stores_count - (CASE WHEN NOT is_courier THEN 1 ELSE 0 END)),
            updated_at = timezone('utc'::text, now())
        WHERE state_id = old_state AND city_id = old_city AND neighborhood_id = old_neighborhood;
    END IF;

    -- 2. Incrementa e avalia quórum no novo bairro de destino (se completo)
    IF new_state IS NOT NULL AND new_city IS NOT NULL AND new_neighborhood IS NOT NULL THEN
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
            new_state, 
            new_city, 
            new_neighborhood, 
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
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 3. Atualização dos Triggers para Cobrir INSERT e UPDATE Geográfico
-- ==============================================================================
DROP TRIGGER IF EXISTS trg_courier_quorum_sync ON public.courier_profiles;
CREATE TRIGGER trg_courier_quorum_sync
    AFTER INSERT OR UPDATE OF state_id, city_id, home_neighborhood_id ON public.courier_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_region_unlock_quorum();

DROP TRIGGER IF EXISTS trg_store_quorum_sync ON public.store_profiles;
CREATE TRIGGER trg_store_quorum_sync
    AFTER INSERT OR UPDATE OF state_id, city_id, neighborhood_id ON public.store_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_region_unlock_quorum();
