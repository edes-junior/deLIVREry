-- ==============================================================================
-- Migration: 20260910100000_multi_neighborhoods_and_store_address.sql
-- Description: Adiciona postal_code e address_complement para store_profiles,
--              e operating_neighborhoods para courier_profiles com suporte a GIN.
-- Architecture: Hexagonal / Supabase PostgreSQL 15+
-- ==============================================================================

-- 1. Expansão de store_profiles com CEP e Complemento
ALTER TABLE public.store_profiles
    ADD COLUMN IF NOT EXISTS postal_code VARCHAR(9),
    ADD COLUMN IF NOT EXISTS address_complement VARCHAR(150);

ALTER TABLE public.store_profiles DROP CONSTRAINT IF EXISTS check_store_postal_code_format;
ALTER TABLE public.store_profiles ADD CONSTRAINT check_store_postal_code_format
    CHECK (postal_code IS NULL OR postal_code ~ '^\d{5}-?\d{3}$');

COMMENT ON COLUMN public.store_profiles.postal_code IS 'Código de Endereçamento Postal (CEP) brasileiro do estabelecimento (ex: 01310-100 ou 01310100).';
COMMENT ON COLUMN public.store_profiles.address_complement IS 'Complemento opcional do endereço (ex: Apto 101, Galpão B, Sala 2).';

CREATE INDEX IF NOT EXISTS idx_store_profiles_postal_code ON public.store_profiles(postal_code);

-- 2. Expansão de courier_profiles com Múltiplos Bairros de Atuação (array)
ALTER TABLE public.courier_profiles
    ADD COLUMN IF NOT EXISTS operating_neighborhoods VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR(100)[];

COMMENT ON COLUMN public.courier_profiles.operating_neighborhoods IS 'Lista de identificadores de bairros onde o entregador aceita realizar turnos e entregas.';

CREATE INDEX IF NOT EXISTS idx_courier_operating_neighborhoods 
    ON public.courier_profiles USING GIN (operating_neighborhoods);
