-- ==============================================================================
-- Migration: 20260904200000_job_ratings_and_completion.sql
-- Description: Criação da tabela de avaliações (job_ratings), suporte a reputação
--              para entregadores (courier_profiles.reputation_score) e triggers de recálculo.
-- Epic: 2 - Publicação de Vagas, Matching Bid/Ask e Orquestração Operacional
-- Story: 2.4 - Fechamento de Matching, Liberação de Contatos e Gestão de Reputação/XP
-- Architecture: Hexagonal / Supabase PostgreSQL 15+
-- ==============================================================================

-- 1. Garante coluna reputation_score em courier_profiles (inicial 5.00)
ALTER TABLE public.courier_profiles
    ADD COLUMN IF NOT EXISTS reputation_score NUMERIC(3, 2) NOT NULL DEFAULT 5.00;

ALTER TABLE public.courier_profiles DROP CONSTRAINT IF EXISTS check_courier_reputation_score;
ALTER TABLE public.courier_profiles
    ADD CONSTRAINT check_courier_reputation_score
    CHECK (reputation_score >= 0.00 AND reputation_score <= 5.00);

-- 2. Tabela: job_ratings (Avaliações Mútuas pós-turno)
CREATE TABLE IF NOT EXISTS public.job_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
    rater_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rated_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rating NUMERIC(2, 1) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT check_rating_range CHECK (rating >= 1.0 AND rating <= 5.0),
    CONSTRAINT check_rater_different_from_rated CHECK (rater_id != rated_user_id),
    CONSTRAINT unique_job_rater UNIQUE (job_id, rater_id)
);

-- Índices para consultas rápidas de reputação
CREATE INDEX IF NOT EXISTS idx_job_ratings_job_id ON public.job_ratings(job_id);
CREATE INDEX IF NOT EXISTS idx_job_ratings_rated_user_id ON public.job_ratings(rated_user_id);
CREATE INDEX IF NOT EXISTS idx_job_ratings_rater_id ON public.job_ratings(rater_id);

-- 3. Habilita RLS em job_ratings
ALTER TABLE public.job_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public authenticated users can read ratings" ON public.job_ratings;
CREATE POLICY "Public authenticated users can read ratings"
    ON public.job_ratings
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Participants can submit rating for completed or matched jobs" ON public.job_ratings;
CREATE POLICY "Participants can submit rating for completed or matched jobs"
    ON public.job_ratings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = rater_id
        AND EXISTS (
            SELECT 1 FROM public.job_posts jp
            WHERE jp.id = public.job_ratings.job_id
              AND jp.status IN ('matched', 'completed')
              AND (
                  (jp.store_id = auth.uid() AND jp.matched_courier_id = public.job_ratings.rated_user_id)
                  OR
                  (jp.matched_courier_id = auth.uid() AND jp.store_id = public.job_ratings.rated_user_id)
              )
        )
    );

-- 4. Função e Trigger para recálculo automático de reputação do usuário avaliado
CREATE OR REPLACE FUNCTION public.handle_job_rating_inserted()
RETURNS TRIGGER AS $$
DECLARE
    new_avg NUMERIC(3, 2);
BEGIN
    SELECT ROUND(AVG(rating)::NUMERIC, 2)
    INTO new_avg
    FROM public.job_ratings
    WHERE rated_user_id = NEW.rated_user_id;

    IF new_avg IS NOT NULL THEN
        -- Atualiza se for lojista
        UPDATE public.store_profiles
        SET reputation_score = new_avg,
            updated_at = timezone('utc'::text, now())
        WHERE user_id = NEW.rated_user_id;

        -- Atualiza se for entregador
        UPDATE public.courier_profiles
        SET reputation_score = new_avg,
            updated_at = timezone('utc'::text, now())
        WHERE user_id = NEW.rated_user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_job_rating_inserted ON public.job_ratings;
CREATE TRIGGER trg_job_rating_inserted
    AFTER INSERT OR UPDATE ON public.job_ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_job_rating_inserted();
