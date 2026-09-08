-- ==============================================================================
-- Migration: 20260908120000_community_supporter_badge_xp.sql
-- Description: Concessão de Badge de Apoiador da Comunidade e Bonificação de +25 XP
--              na primeira microdoação do mês (Story 4.3 / FR-11, FR-14).
-- Architecture: Hexagonal / Supabase PostgreSQL 15+
-- ==============================================================================

-- 1. Expansão de courier_profiles com campos de apoiador
ALTER TABLE public.courier_profiles 
    ADD COLUMN IF NOT EXISTS community_supporter BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS supporter_since TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_donation_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS monthly_donations_count INTEGER NOT NULL DEFAULT 0;

-- 2. Expansão de store_profiles com campos de apoiador
ALTER TABLE public.store_profiles 
    ADD COLUMN IF NOT EXISTS community_supporter BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS supporter_since TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_donation_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS monthly_donations_count INTEGER NOT NULL DEFAULT 0;

-- Comentários documentais
COMMENT ON COLUMN public.courier_profiles.community_supporter IS 'Indica se o entregador é um apoiador ativo da comunidade deLIVREry.';
COMMENT ON COLUMN public.courier_profiles.supporter_since IS 'Data do primeiro apoio voluntário registrado pelo entregador.';
COMMENT ON COLUMN public.courier_profiles.last_donation_at IS 'Data do apoio voluntário mais recente.';
COMMENT ON COLUMN public.courier_profiles.monthly_donations_count IS 'Total de apoios voluntários registrados pelo usuário.';

COMMENT ON COLUMN public.store_profiles.community_supporter IS 'Indica se o estabelecimento é um apoiador ativo da comunidade deLIVREry.';
COMMENT ON COLUMN public.store_profiles.supporter_since IS 'Data do primeiro apoio voluntário registrado pelo lojista.';
COMMENT ON COLUMN public.store_profiles.last_donation_at IS 'Data do apoio voluntário mais recente.';
COMMENT ON COLUMN public.store_profiles.monthly_donations_count IS 'Total de apoios voluntários registrados pelo lojista.';

-- 3. Função Trigger para bonificação de XP e concessão de badge
CREATE OR REPLACE FUNCTION public.process_donation_supporter_reward()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_monthly_count INTEGER;
BEGIN
    -- Se a doação for anônima, não há perfil de usuário para atualizar
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Conta quantas doações o usuário realizou no mesmo mês calendário
    SELECT COUNT(*) INTO v_monthly_count
    FROM public.donations_log
    WHERE user_id = NEW.user_id
      AND date_trunc('month', copied_at) = date_trunc('month', NEW.copied_at);

    -- Se esta for a primeira doação do mês (v_monthly_count = 1 após o INSERT)
    IF v_monthly_count = 1 THEN
        -- Atualiza perfil de entregador (se existir) com +25 XP e recálculo de nível
        UPDATE public.courier_profiles
        SET 
            xp_points = xp_points + 25,
            level = CASE 
                WHEN xp_points + 25 >= 1000 THEN 'Ouro'
                WHEN xp_points + 25 >= 300 THEN 'Prata'
                ELSE 'Bronze'
            END,
            community_supporter = true,
            supporter_since = COALESCE(supporter_since, NEW.copied_at),
            last_donation_at = NEW.copied_at,
            monthly_donations_count = monthly_donations_count + 1,
            updated_at = timezone('utc'::text, now())
        WHERE user_id = NEW.user_id;

        -- Atualiza perfil de lojista (se existir) com +25 XP e recálculo de nível
        UPDATE public.store_profiles
        SET 
            xp_points = xp_points + 25,
            level = CASE 
                WHEN xp_points + 25 >= 1000 THEN 'Ouro'
                WHEN xp_points + 25 >= 300 THEN 'Prata'
                ELSE 'Bronze'
            END,
            community_supporter = true,
            supporter_since = COALESCE(supporter_since, NEW.copied_at),
            last_donation_at = NEW.copied_at,
            monthly_donations_count = monthly_donations_count + 1,
            updated_at = timezone('utc'::text, now())
        WHERE user_id = NEW.user_id;

    ELSE
        -- Doação subsequente no mesmo mês: mantém badge e atualiza contadores sem conceder XP duplicado
        UPDATE public.courier_profiles
        SET 
            community_supporter = true,
            last_donation_at = NEW.copied_at,
            monthly_donations_count = monthly_donations_count + 1,
            updated_at = timezone('utc'::text, now())
        WHERE user_id = NEW.user_id;

        UPDATE public.store_profiles
        SET 
            community_supporter = true,
            last_donation_at = NEW.copied_at,
            monthly_donations_count = monthly_donations_count + 1,
            updated_at = timezone('utc'::text, now())
        WHERE user_id = NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$;

-- 4. Trigger ativado após cada inserção em donations_log
DROP TRIGGER IF EXISTS trg_donation_supporter_reward ON public.donations_log;
CREATE TRIGGER trg_donation_supporter_reward
    AFTER INSERT ON public.donations_log
    FOR EACH ROW
    EXECUTE FUNCTION public.process_donation_supporter_reward();
