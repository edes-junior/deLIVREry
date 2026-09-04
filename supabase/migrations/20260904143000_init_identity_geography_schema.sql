-- ==============================================================================
-- Migration: 20260904143000_init_identity_geography_schema.sql
-- Description: Schema inicial de Identidade (users, courier_profiles, store_profiles)
--              e Geografia/Quórum Regional (region_unlocks) com RLS ativado.
-- Architecture: Hexagonal / Supabase PostgreSQL 15+
-- ==============================================================================

-- 1. Extensões Essenciais
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Função utilitária para atualização automática de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. Tabela: users (Identidade Civil e Autenticação)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150),
    cpf VARCHAR(14) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    user_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT users_cpf_key UNIQUE (cpf),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT check_user_type CHECK (user_type IN ('courier', 'store')),
    CONSTRAINT check_cpf_format CHECK (cpf ~ '^[0-9]{11}$|^[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}$')
);

CREATE INDEX IF NOT EXISTS idx_users_cpf ON public.users(cpf);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON public.users(user_type);

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 3. Tabela: courier_profiles (Perfil de Entregador / Motoboy)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.courier_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    transport_modal VARCHAR(30) NOT NULL,
    base_daily_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    base_delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    xp_points INTEGER NOT NULL DEFAULT 0,
    level VARCHAR(20) NOT NULL DEFAULT 'Bronze',
    referral_code VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT check_transport_modal CHECK (transport_modal IN ('motorcycle', 'bicycle', 'ebike_scooter')),
    CONSTRAINT check_base_daily_rate CHECK (base_daily_rate >= 0),
    CONSTRAINT check_base_delivery_fee CHECK (base_delivery_fee >= 0),
    CONSTRAINT check_xp_points CHECK (xp_points >= 0),
    CONSTRAINT check_courier_level CHECK (level IN ('Bronze', 'Prata', 'Ouro')),
    CONSTRAINT courier_profiles_referral_code_key UNIQUE (referral_code)
);

CREATE INDEX IF NOT EXISTS idx_courier_profiles_referral_code ON public.courier_profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_courier_profiles_transport_modal ON public.courier_profiles(transport_modal);

DROP TRIGGER IF EXISTS trg_courier_profiles_updated_at ON public.courier_profiles;
CREATE TRIGGER trg_courier_profiles_updated_at
    BEFORE UPDATE ON public.courier_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 4. Tabela: store_profiles (Perfil do Lojista / Comerciante)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.store_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    store_name VARCHAR(150) NOT NULL,
    state_id VARCHAR(2) NOT NULL,
    city_id VARCHAR(100) NOT NULL,
    neighborhood_id VARCHAR(100) NOT NULL,
    address_street VARCHAR(255),
    address_number VARCHAR(30),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    reputation_score NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT check_reputation_score CHECK (reputation_score >= 0.00 AND reputation_score <= 5.00),
    CONSTRAINT check_store_state_id_format CHECK (length(state_id) = 2 AND state_id = UPPER(state_id))
);

CREATE INDEX IF NOT EXISTS idx_store_profiles_geography ON public.store_profiles(state_id, city_id, neighborhood_id);

DROP TRIGGER IF EXISTS trg_store_profiles_updated_at ON public.store_profiles;
CREATE TRIGGER trg_store_profiles_updated_at
    BEFORE UPDATE ON public.store_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 5. Tabela: region_unlocks (Controle de Quórum Hiperlocal e Ativação Territorial)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.region_unlocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_id VARCHAR(2) NOT NULL,
    city_id VARCHAR(100) NOT NULL,
    neighborhood_id VARCHAR(100) NOT NULL,
    couriers_count INTEGER NOT NULL DEFAULT 0,
    stores_count INTEGER NOT NULL DEFAULT 0,
    is_unlocked BOOLEAN NOT NULL DEFAULT false,
    unlocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_region_geography UNIQUE (state_id, city_id, neighborhood_id),
    CONSTRAINT check_couriers_count CHECK (couriers_count >= 0),
    CONSTRAINT check_stores_count CHECK (stores_count >= 0),
    CONSTRAINT check_region_state_id_format CHECK (length(state_id) = 2 AND state_id = UPPER(state_id))
);

CREATE INDEX IF NOT EXISTS idx_region_unlocks_lookup ON public.region_unlocks(state_id, city_id, neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_region_unlocks_status ON public.region_unlocks(is_unlocked);

DROP TRIGGER IF EXISTS trg_region_unlocks_updated_at ON public.region_unlocks;
CREATE TRIGGER trg_region_unlocks_updated_at
    BEFORE UPDATE ON public.region_unlocks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 6. Row Level Security (RLS) - Isolamento e Governança de Dados
-- ==============================================================================

-- Habilitação obrigatória de RLS em todas as tabelas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.region_unlocks ENABLE ROW LEVEL SECURITY;

-- Políticas para: public.users
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile"
    ON public.users
    FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
    ON public.users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
    ON public.users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Políticas para: public.courier_profiles
DROP POLICY IF EXISTS "Couriers can read own profile" ON public.courier_profiles;
CREATE POLICY "Couriers can read own profile"
    ON public.courier_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Couriers can insert own profile" ON public.courier_profiles;
CREATE POLICY "Couriers can insert own profile"
    ON public.courier_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Couriers can update own profile" ON public.courier_profiles;
CREATE POLICY "Couriers can update own profile"
    ON public.courier_profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas para: public.store_profiles
DROP POLICY IF EXISTS "Stores can read own profile" ON public.store_profiles;
CREATE POLICY "Stores can read own profile"
    ON public.store_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Stores can insert own profile" ON public.store_profiles;
CREATE POLICY "Stores can insert own profile"
    ON public.store_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Stores can update own profile" ON public.store_profiles;
CREATE POLICY "Stores can update own profile"
    ON public.store_profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas para: public.region_unlocks
-- Leitura pública para exibição universal do termômetro de quórum em PWA e Landing Pages
DROP POLICY IF EXISTS "Public can view region unlocks quorum" ON public.region_unlocks;
CREATE POLICY "Public can view region unlocks quorum"
    ON public.region_unlocks
    FOR SELECT
    USING (true);

-- Escrita e atualização restrita ao backend / service_role
DROP POLICY IF EXISTS "Service role manages region unlocks" ON public.region_unlocks;
CREATE POLICY "Service role manages region unlocks"
    ON public.region_unlocks
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role' OR auth.role() = 'service_role')
    WITH CHECK (auth.jwt()->>'role' = 'service_role' OR auth.role() = 'service_role');
