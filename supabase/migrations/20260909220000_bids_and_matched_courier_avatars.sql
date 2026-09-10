-- ==============================================================================
-- Migration: 20260909220000_bids_and_matched_courier_avatars.sql
-- Description: Visualização de avatares e dados públicos de entregadores para lojistas (CAP-3, AD-10)
-- Story: 3 - Visualização de Avatares dos Entregadores pelo Lojista
-- ==============================================================================

-- 1. Atualizar a View job_matched_contacts para incluir avatares e dados de gamificação
DROP VIEW IF EXISTS public.job_matched_contacts;
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
    u_store.avatar_url AS store_avatar_url,
    cp.user_id AS courier_id,
    u_courier.full_name AS courier_name,
    u_courier.phone_number AS courier_phone_number,
    u_courier.avatar_url AS courier_avatar_url,
    cp.transport_modal AS courier_modal,
    cp.level AS courier_level,
    cp.xp_points AS courier_xp
FROM public.job_posts jp
JOIN public.store_profiles sp ON sp.user_id = jp.store_id
JOIN public.users u_store ON u_store.id = sp.user_id
JOIN public.courier_profiles cp ON cp.user_id = jp.matched_courier_id
JOIN public.users u_courier ON u_courier.id = cp.user_id
WHERE jp.status IN ('matched', 'in_progress', 'completed');

-- Conceder acesso à view de matching
GRANT SELECT ON public.job_matched_contacts TO authenticated, anon;

-- 2. Criar a View Segura de Propostas Recebidas com Dados Públicos do Entregador (CAP-3, AD-10)
-- Nota de Privacidade: CPF e Telefone Celular do entregador NÃO são incluídos nesta view.
DROP VIEW IF EXISTS public.job_bids_with_couriers;
CREATE OR REPLACE VIEW public.job_bids_with_couriers AS
SELECT
    b.id,
    b.job_id,
    b.courier_id,
    b.bid_daily_rate,
    b.bid_delivery_fee,
    b.status,
    b.notes,
    b.created_at,
    b.updated_at,
    u.full_name AS courier_name,
    u.avatar_url AS courier_avatar_url,
    cp.transport_modal AS courier_modal,
    cp.level AS courier_level,
    cp.xp_points AS courier_xp
FROM public.job_bids b
JOIN public.users u ON u.id = b.courier_id
JOIN public.courier_profiles cp ON cp.user_id = b.courier_id;

GRANT SELECT ON public.job_bids_with_couriers TO authenticated, anon;

-- 3. Políticas de RLS em public.users e public.courier_profiles
-- Permite que o lojista dono da vaga leia os dados do entregador que enviou proposta
DROP POLICY IF EXISTS "Stores can read public profiles of bidders" ON public.users;
CREATE POLICY "Stores can read public profiles of bidders"
    ON public.users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.job_bids b
            JOIN public.job_posts jp ON jp.id = b.job_id
            WHERE b.courier_id = public.users.id
              AND jp.store_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Stores can read courier profiles of bidders" ON public.courier_profiles;
CREATE POLICY "Stores can read courier profiles of bidders"
    ON public.courier_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.job_bids b
            JOIN public.job_posts jp ON jp.id = b.job_id
            WHERE b.courier_id = public.courier_profiles.user_id
              AND jp.store_id = auth.uid()
        )
    );
