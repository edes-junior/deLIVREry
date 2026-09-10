-- ==============================================================================
-- Migration: 20260910170000_bilateral_job_completion_and_ratings.sql
-- Description: Suporte a critérios de avaliação (JSONB), concessão de XP ao avaliador
--              e política RLS de Avaliação Cega (Blind Review) com carência de 6h pós-turno.
-- Epic: 2 - Publicação de Vagas, Matching Bid/Ask e Orquestração Operacional
-- Story: 2.4 / CAP-3 - Conclusão em Duas Vias e Gestão de Reputação/XP
-- Architecture: Hexagonal / Supabase PostgreSQL 15+
-- ==============================================================================

-- 1. Adiciona coluna criteria em job_ratings se não existir
ALTER TABLE public.job_ratings
    ADD COLUMN IF NOT EXISTS criteria JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_job_ratings_criteria
    ON public.job_ratings USING gin (criteria);

-- 2. Atualiza política de leitura (SELECT) com Avaliação Cega (Blind Review)
-- A avaliação de uma parte só fica visível para o outro participante quando:
-- (a) O usuário autenticado é o próprio autor da avaliação (rater_id);
-- (b) O usuário autenticado já submeteu a sua própria avaliação para a mesma vaga;
-- (c) Já se passaram 6 horas do término previsto da vaga (shift_end_time).

DROP POLICY IF EXISTS "Public authenticated users can read ratings" ON public.job_ratings;
DROP POLICY IF EXISTS "Blind rating visibility on job_ratings" ON public.job_ratings;

-- Função auxiliar SECURITY DEFINER para checagem rápida de avaliação sem recursão de RLS
CREATE OR REPLACE FUNCTION public.check_user_rated_job(p_job_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_ratings
    WHERE job_id = p_job_id AND rater_id = p_user_id
  );
$$;

CREATE POLICY "Blind rating visibility on job_ratings"
    ON public.job_ratings
    FOR SELECT
    TO authenticated
    USING (
        -- Própria avaliação sempre visível para quem a fez
        (select auth.uid()) = rater_id
        OR
        -- Avaliação de terceiros visível apenas se houver reciprocidade OU 6h pós-término previsto
        EXISTS (
            SELECT 1 FROM public.job_posts jp
            WHERE jp.id = public.job_ratings.job_id
              AND (
                  -- Condição A: O usuário autenticado já enviou sua avaliação para este turno
                  public.check_user_rated_job(jp.id, (select auth.uid()))
                  OR
                  -- Condição B: Passaram-se 6 horas após o término previsto da vaga
                  (now() > jp.shift_end_time + interval '6 hours')
              )
        )
    );
