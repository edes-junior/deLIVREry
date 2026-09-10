-- ==============================================================================
-- Migration: 20260910150000_job_cancellation_rules.sql
-- Description: Adiciona campos de auditoria e métricas de cancelamento de vagas (cancellation_reason e cancelled_at)
-- Regras de Negócio: Cancelamento permitido pelo lojista apenas enquanto status = 'open'
-- ==============================================================================

-- 1. Adiciona coluna de motivo e timestamp de cancelamento
ALTER TABLE public.job_posts
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2. Índice parcial para consultas analíticas e relatórios de motivos de cancelamento
CREATE INDEX IF NOT EXISTS idx_job_posts_cancellation_analytics
ON public.job_posts(cancellation_reason, cancelled_at)
WHERE status = 'cancelled';

-- 3. Comentários para documentação de schema
COMMENT ON COLUMN public.job_posts.cancellation_reason IS 'Motivo registrado pelo usuário (lojista) ao cancelar a vaga. Obrigatório no cancelamento.';
COMMENT ON COLUMN public.job_posts.cancelled_at IS 'Data/hora exata do cancelamento da vaga.';
