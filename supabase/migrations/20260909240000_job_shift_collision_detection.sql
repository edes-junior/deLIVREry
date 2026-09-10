-- ==============================================================================
-- Migration: 20260909240000_job_shift_collision_detection.sql
-- Description: Suporte e índices para verificação de colisão temporal de turnos com buffer de 30m (CAP-5, CAP-6)
-- Story: 5 - Detecção de Colisão com Buffer de 30 min e Filtro Hiperlocal de Vagas
-- ==============================================================================

-- 1. Índice composto para acelerar consulta da agenda confirmada do entregador
CREATE INDEX IF NOT EXISTS idx_job_posts_matched_courier_schedule
ON public.job_posts(matched_courier_id, status, shift_start_time, shift_end_time)
WHERE status IN ('matched', 'in_progress');

-- 2. Função pura no Postgres para cálculo de colisão com buffer de 30 minutos
CREATE OR REPLACE FUNCTION public.do_shifts_collide(
    p_start_a TIMESTAMPTZ,
    p_end_a TIMESTAMPTZ,
    p_start_b TIMESTAMPTZ,
    p_end_b TIMESTAMPTZ,
    p_buffer_minutes INT DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT (p_start_a < (p_end_b + (p_buffer_minutes || ' minutes')::INTERVAL))
       AND (p_end_a > (p_start_b - (p_buffer_minutes || ' minutes')::INTERVAL));
$$;

GRANT EXECUTE ON FUNCTION public.do_shifts_collide TO authenticated, anon;
