-- ==============================================================================
-- Migration: 20260904190000_job_posts_radius.sql
-- Description: Adiciona raio máximo de entrega (delivery_radius_km) em job_posts
--              para viabilizar filtragem ergonômica por modal (bicicletas <= 3km).
-- Epic: 2 - Publicação de Vagas, Matching Bid/Ask e Orquestração Operacional
-- Story: 2.3 - Listagem de Vagas Filtrada por Modal e Negociação Bid/Ask (Proposta/Contraproposta)
-- Architecture: Hexagonal / Supabase PostgreSQL 15+
-- ==============================================================================

-- 1. Adiciona coluna delivery_radius_km em job_posts com default 3.0km
ALTER TABLE public.job_posts
    ADD COLUMN IF NOT EXISTS delivery_radius_km NUMERIC(4, 1) NOT NULL DEFAULT 3.0;

-- 2. Constraint de validação para raio positivo e razoável
ALTER TABLE public.job_posts DROP CONSTRAINT IF EXISTS check_delivery_radius;
ALTER TABLE public.job_posts 
    ADD CONSTRAINT check_delivery_radius 
    CHECK (delivery_radius_km > 0.0 AND delivery_radius_km <= 100.0);

-- 3. Índice para filtragem eficiente por raio
CREATE INDEX IF NOT EXISTS idx_job_posts_radius ON public.job_posts(delivery_radius_km);
