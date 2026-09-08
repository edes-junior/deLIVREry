-- ==============================================================================
-- Migration: 20260904180000_store_profiles_xp.sql
-- Description: Adiciona sistema de XP e Níveis em store_profiles (FR-14)
--              e trigger para concessão automática de +50 XP para publicações antecipadas (>48h).
-- Epic: 2 - Publicação de Vagas, Matching Bid/Ask e Orquestração Operacional
-- Story: 2.2 - Publicação de Vagas de Turno e Notificações Web Push (FCM)
-- Architecture: Hexagonal / Supabase PostgreSQL 15+
-- ==============================================================================

-- 1. Expansão da tabela store_profiles com xp_points e level
ALTER TABLE public.store_profiles
    ADD COLUMN IF NOT EXISTS xp_points INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS level VARCHAR(20) NOT NULL DEFAULT 'Bronze';

-- Constraints para integridade de XP e Nível
ALTER TABLE public.store_profiles DROP CONSTRAINT IF EXISTS check_store_xp_points;
ALTER TABLE public.store_profiles ADD CONSTRAINT check_store_xp_points CHECK (xp_points >= 0);

ALTER TABLE public.store_profiles DROP CONSTRAINT IF EXISTS check_store_level;
ALTER TABLE public.store_profiles ADD CONSTRAINT check_store_level CHECK (level IN ('Bronze', 'Prata', 'Ouro'));

-- 2. Função para concessão de +50 XP por publicação antecipada (> 48h)
CREATE OR REPLACE FUNCTION public.award_early_job_post_xp()
RETURNS TRIGGER AS $$
DECLARE
    advance_interval INTERVAL;
BEGIN
    advance_interval := NEW.shift_start_time - NEW.created_at;

    -- Se o início do turno for agendado com mais de 48 horas de antecedência
    IF advance_interval >= INTERVAL '48 hours' THEN
        UPDATE public.store_profiles
        SET 
            xp_points = xp_points + 50,
            level = CASE 
                WHEN xp_points + 50 >= 1000 THEN 'Ouro'
                WHEN xp_points + 50 >= 300 THEN 'Prata'
                ELSE 'Bronze'
            END,
            updated_at = timezone('utc'::text, now())
        WHERE user_id = NEW.store_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para job_posts
DROP TRIGGER IF EXISTS trg_award_early_job_post_xp ON public.job_posts;
CREATE TRIGGER trg_award_early_job_post_xp
    AFTER INSERT ON public.job_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.award_early_job_post_xp();
