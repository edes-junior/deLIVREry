-- ==============================================================================
-- Migration: 20260904230000_donations_log_schema.sql
-- Description: Tabela de logs de microdoações comunitárias via PIX e agregação
--              de transparência nos 5 Delight Moments (FR-10, FR-11, FR-12, NFR-8).
-- Architecture: Hexagonal / Supabase PostgreSQL 15+
-- ==============================================================================

-- 1. Tabela: donations_log (Registro anônimo/voluntário de intenções de apoio PIX)
CREATE TABLE IF NOT EXISTS public.donations_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    trigger_moment VARCHAR(50) NOT NULL,
    suggested_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    copied_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Validação de momentos disparadores canônicos (FR-10)
    CONSTRAINT check_donations_trigger_moment CHECK (
        trigger_moment IN (
            'shift_completed',       -- 1. Entregador após confirmação de pagamento do turno
            'level_up',              -- 2. Entregador/Lojista ao subir de nível
            'emergency_matched',     -- 3. Lojista com vaga de emergência aceita em < 5min
            'rating_5_stars',        -- 4. Lojista avaliando entregador com 5 estrelas
            'api_1000_requests',     -- 5. Parceiro API atingindo 1.000 requisições de sucesso
            'manual_donation'        -- Doação voluntária espontânea (ex: rodapé ou painel de transparência)
        )
    ),

    -- Valores de doação devem ser estritamente não-negativos
    CONSTRAINT check_donations_amount_non_negative CHECK (suggested_amount >= 0.00)
);

-- Comentários explicativos da tabela e colunas
COMMENT ON TABLE public.donations_log IS 'Log de cliques e intenções de microdoação comunitária via chave PIX nos Delight Moments (FR-10, FR-11).';
COMMENT ON COLUMN public.donations_log.user_id IS 'ID opcional do usuário autenticado. Pode ser NULL para doações anônimas.';
COMMENT ON COLUMN public.donations_log.trigger_moment IS 'Momento de satisfação operacional em que o modal de doação foi acionado.';
COMMENT ON COLUMN public.donations_log.suggested_amount IS 'Valor sugerido em reais (BRL) selecionado ou 0.00 para valor livre.';
COMMENT ON COLUMN public.donations_log.copied_at IS 'Data e hora da cópia do BR Code PIX pelo doador.';

-- 2. Índices de alta performance para relatórios e agregações
CREATE INDEX IF NOT EXISTS idx_donations_log_copied_at 
    ON public.donations_log(copied_at DESC);

CREATE INDEX IF NOT EXISTS idx_donations_log_trigger 
    ON public.donations_log(trigger_moment);

CREATE INDEX IF NOT EXISTS idx_donations_log_user_id 
    ON public.donations_log(user_id) 
    WHERE user_id IS NOT NULL;

-- 3. Row Level Security (RLS - NFR-5)
ALTER TABLE public.donations_log ENABLE ROW LEVEL SECURITY;

-- Política de Inserção: tanto anônimos (anon) quanto autenticados (authenticated) podem registrar doações
DROP POLICY IF EXISTS "donations_log_insert_policy" ON public.donations_log;
CREATE POLICY "donations_log_insert_policy" 
    ON public.donations_log 
    FOR INSERT 
    WITH CHECK (true);

-- Política de Leitura Própria: usuário autenticado só visualiza seu próprio histórico
DROP POLICY IF EXISTS "donations_log_select_self" ON public.donations_log;
CREATE POLICY "donations_log_select_self" 
    ON public.donations_log 
    FOR SELECT 
    USING (
        auth.uid() = user_id 
        OR auth.role() = 'service_role'
    );

-- 4. View Agregada Pública para o Painel de Transparência (FR-12, Story 4.4)
-- Preserva privacidade completa (não expõe user_id) e disponibiliza métricas por mês
CREATE OR REPLACE VIEW public.monthly_donation_stats AS
SELECT 
    date_trunc('month', copied_at) AS month_period,
    COUNT(*)::INT AS total_intents,
    COALESCE(SUM(suggested_amount), 0.00)::NUMERIC(10, 2) AS total_estimated_amount,
    COUNT(DISTINCT user_id)::INT AS unique_donors_count,
    COUNT(*) FILTER (WHERE trigger_moment = 'shift_completed')::INT AS count_shift_completed,
    COUNT(*) FILTER (WHERE trigger_moment = 'level_up')::INT AS count_level_up,
    COUNT(*) FILTER (WHERE trigger_moment = 'emergency_matched')::INT AS count_emergency_matched,
    COUNT(*) FILTER (WHERE trigger_moment = 'rating_5_stars')::INT AS count_rating_5_stars,
    COUNT(*) FILTER (WHERE trigger_moment = 'api_1000_requests')::INT AS count_api_1000_requests,
    COUNT(*) FILTER (WHERE trigger_moment = 'manual_donation')::INT AS count_manual_donation
FROM public.donations_log
GROUP BY date_trunc('month', copied_at)
ORDER BY month_period DESC;

-- Concede acesso de leitura à view pública para transparência comunitária
GRANT SELECT ON public.monthly_donation_stats TO anon, authenticated;
