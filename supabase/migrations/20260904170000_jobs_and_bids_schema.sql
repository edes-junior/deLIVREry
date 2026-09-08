-- ==============================================================================
-- Migration: 20260904170000_jobs_and_bids_schema.sql
-- Description: Schema de Vagas (job_posts) e Ofertas/Contrapropostas (job_bids)
--              com Row Level Security (RLS) e Isolamento Recíproco de Contatos.
-- Epic: 2 - Publicação de Vagas, Matching Bid/Ask e Orquestração Operacional
-- Story: 2.1 - Schema de Vagas e Propostas com RLS e Isolamento de Contatos
-- Architecture: Hexagonal / Supabase PostgreSQL 15+
-- ==============================================================================

-- ==============================================================================
-- 1. Tabela: job_posts (Postagens de Vagas e Turnos por Lojistas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.job_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.store_profiles(user_id) ON DELETE CASCADE,
    shift_start_time TIMESTAMPTZ NOT NULL,
    shift_end_time TIMESTAMPTZ NOT NULL,
    offered_daily_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    offered_delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    accepted_modals TEXT[] NOT NULL DEFAULT ARRAY['motorcycle']::TEXT[],
    state_id VARCHAR(2) NOT NULL,
    city_id VARCHAR(100) NOT NULL,
    neighborhood_id VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    matched_bid_id UUID,
    matched_courier_id UUID REFERENCES public.courier_profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT check_job_status CHECK (status IN ('open', 'matched', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT check_job_rates CHECK (offered_daily_rate >= 0.00 AND offered_delivery_fee >= 0.00),
    CONSTRAINT check_shift_times CHECK (shift_end_time > shift_start_time),
    CONSTRAINT check_job_state_id_format CHECK (length(state_id) = 2 AND state_id = UPPER(state_id))
);

-- Índices para buscas hiperlocais e filtros de vagas
CREATE INDEX IF NOT EXISTS idx_job_posts_geography ON public.job_posts(state_id, city_id, neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_job_posts_store ON public.job_posts(store_id);
CREATE INDEX IF NOT EXISTS idx_job_posts_status ON public.job_posts(status);
CREATE INDEX IF NOT EXISTS idx_job_posts_matched_courier ON public.job_posts(matched_courier_id);

-- Trigger de updated_at para job_posts
DROP TRIGGER IF EXISTS trg_job_posts_updated_at ON public.job_posts;
CREATE TRIGGER trg_job_posts_updated_at
    BEFORE UPDATE ON public.job_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 2. Tabela: job_bids (Propostas e Contrapropostas dos Entregadores)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.job_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
    courier_id UUID NOT NULL REFERENCES public.courier_profiles(user_id) ON DELETE CASCADE,
    bid_daily_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    bid_delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT check_bid_status CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    CONSTRAINT check_bid_rates CHECK (bid_daily_rate >= 0.00 AND bid_delivery_fee >= 0.00),
    CONSTRAINT uq_job_courier_bid UNIQUE (job_id, courier_id)
);

-- Índices para busca de propostas e isolamento
CREATE INDEX IF NOT EXISTS idx_job_bids_job_id ON public.job_bids(job_id);
CREATE INDEX IF NOT EXISTS idx_job_bids_courier_id ON public.job_bids(courier_id);
CREATE INDEX IF NOT EXISTS idx_job_bids_status ON public.job_bids(status);

-- Foreign key recíproca entre job_posts.matched_bid_id e job_bids.id
ALTER TABLE public.job_posts DROP CONSTRAINT IF EXISTS fk_job_posts_matched_bid;
ALTER TABLE public.job_posts 
    ADD CONSTRAINT fk_job_posts_matched_bid 
    FOREIGN KEY (matched_bid_id) REFERENCES public.job_bids(id) ON DELETE SET NULL;

-- Trigger de updated_at para job_bids
DROP TRIGGER IF EXISTS trg_job_bids_updated_at ON public.job_bids;
CREATE TRIGGER trg_job_bids_updated_at
    BEFORE UPDATE ON public.job_bids
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 3. Row Level Security (RLS) - Políticas de Privacidade e Isolamento (AD-10)
-- ==============================================================================

ALTER TABLE public.job_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_bids ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Políticas para: public.job_posts
-- ------------------------------------------------------------------------------

-- SELECT: Vagas com status 'open' são públicas para consulta no PWA.
-- Vagas fechadas/em andamento são visíveis apenas para o lojista dono e o entregador vencedor.
DROP POLICY IF EXISTS "Public can view open jobs or participants can view theirs" ON public.job_posts;
CREATE POLICY "Public can view open jobs or participants can view theirs"
    ON public.job_posts
    FOR SELECT
    USING (
        status = 'open'
        OR auth.uid() = store_id
        OR auth.uid() = matched_courier_id
    );

-- INSERT: Apenas lojistas autenticados podem criar vagas em seu próprio perfil.
DROP POLICY IF EXISTS "Stores can insert own job posts" ON public.job_posts;
CREATE POLICY "Stores can insert own job posts"
    ON public.job_posts
    FOR INSERT
    WITH CHECK (
        auth.uid() = store_id
    );

-- UPDATE: O lojista proprietário pode atualizar sua própria vaga (incluindo formalização de matching).
DROP POLICY IF EXISTS "Stores can update own job posts" ON public.job_posts;
CREATE POLICY "Stores can update own job posts"
    ON public.job_posts
    FOR UPDATE
    USING (auth.uid() = store_id)
    WITH CHECK (auth.uid() = store_id);

-- DELETE: O lojista pode cancelar/excluir sua vaga aberta.
DROP POLICY IF EXISTS "Stores can delete own open job posts" ON public.job_posts;
CREATE POLICY "Stores can delete own open job posts"
    ON public.job_posts
    FOR DELETE
    USING (auth.uid() = store_id AND status = 'open');

-- ------------------------------------------------------------------------------
-- Políticas para: public.job_bids
-- ------------------------------------------------------------------------------

-- SELECT: Isolamento Estrito de Propostas Concorrentes.
-- Um entregador visualiza exclusivamente seus próprios bids (auth.uid() = courier_id).
-- O lojista proprietário da vaga visualiza todas as propostas enviadas para sua vaga.
DROP POLICY IF EXISTS "Couriers view own bids and store view received bids" ON public.job_bids;
CREATE POLICY "Couriers view own bids and store view received bids"
    ON public.job_bids
    FOR SELECT
    USING (
        auth.uid() = courier_id
        OR EXISTS (
            SELECT 1 FROM public.job_posts jp
            WHERE jp.id = public.job_bids.job_id
              AND jp.store_id = auth.uid()
        )
    );

-- INSERT: Entregadores autenticados podem submeter propostas apenas para vagas com status 'open'.
DROP POLICY IF EXISTS "Couriers can submit bids to open jobs" ON public.job_bids;
CREATE POLICY "Couriers can submit bids to open jobs"
    ON public.job_bids
    FOR INSERT
    WITH CHECK (
        auth.uid() = courier_id
        AND EXISTS (
            SELECT 1 FROM public.job_posts jp
            WHERE jp.id = public.job_bids.job_id
              AND jp.status = 'open'
        )
    );

-- UPDATE: Entregador pode atualizar/cancelar sua proposta enquanto pendente.
-- Lojista proprietário da vaga pode atualizar o status da proposta (aceitar/rejeitar).
DROP POLICY IF EXISTS "Couriers can edit pending bids or store can update status" ON public.job_bids;
CREATE POLICY "Couriers can edit pending bids or store can update status"
    ON public.job_bids
    FOR UPDATE
    USING (
        (auth.uid() = courier_id AND status = 'pending')
        OR EXISTS (
            SELECT 1 FROM public.job_posts jp
            WHERE jp.id = public.job_bids.job_id
              AND jp.store_id = auth.uid()
        )
    )
    WITH CHECK (
        (auth.uid() = courier_id)
        OR EXISTS (
            SELECT 1 FROM public.job_posts jp
            WHERE jp.id = public.job_bids.job_id
              AND jp.store_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- 4. Liberação Recíproca de Contatos Pós-Matching na Tabela users (FR-6, AD-10)
-- ------------------------------------------------------------------------------

-- Política de RLS em public.users permitindo que participantes de um turno formalizado ('matched')
-- tenham acesso recíproco aos dados de contato (nome e telefone celular com DDD).
DROP POLICY IF EXISTS "Users can read matched partner profile" ON public.users;
CREATE POLICY "Users can read matched partner profile"
    ON public.users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.job_posts jp
            WHERE jp.status IN ('matched', 'in_progress', 'completed')
              AND (
                (jp.store_id = auth.uid() AND jp.matched_courier_id = public.users.id)
                OR
                (jp.matched_courier_id = auth.uid() AND jp.store_id = public.users.id)
              )
        )
    );

-- ==============================================================================
-- 5. View Segura de Detalhes de Matching e Contatos Operacionais
-- ==============================================================================
CREATE OR REPLACE VIEW public.job_matched_contacts AS
SELECT 
    jp.id AS job_id,
    jp.status AS job_status,
    jp.shift_start_time,
    jp.shift_end_time,
    jp.offered_daily_rate,
    jp.offered_delivery_fee,
    sp.store_name,
    sp.user_id AS store_id,
    u_store.full_name AS store_contact_name,
    u_store.phone_number AS store_phone_number,
    cp.user_id AS courier_id,
    u_courier.full_name AS courier_name,
    u_courier.phone_number AS courier_phone_number,
    cp.transport_modal AS courier_modal
FROM public.job_posts jp
JOIN public.store_profiles sp ON sp.user_id = jp.store_id
JOIN public.users u_store ON u_store.id = sp.user_id
JOIN public.courier_profiles cp ON cp.user_id = jp.matched_courier_id
JOIN public.users u_courier ON u_courier.id = cp.user_id
WHERE jp.status IN ('matched', 'in_progress', 'completed');
