-- ==============================================================================
-- Migration: 20260909230000_courier_availability_status.sql
-- Description: Adiciona coluna is_active em public.courier_profiles para controle operacional (CAP-4)
-- Story: 4 - Controle de Disponibilidade Operacional do Entregador
-- ==============================================================================

-- 1. Adiciona a coluna is_active na tabela de perfis de entregadores
ALTER TABLE public.courier_profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Índice condicional para busca rápida de entregadores ativos por região (Web Push e Despacho)
CREATE INDEX IF NOT EXISTS idx_courier_profiles_active_region 
ON public.courier_profiles(state_id, city_id, home_neighborhood_id) 
WHERE is_active = true;
