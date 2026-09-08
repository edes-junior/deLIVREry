-- ==============================================================================
-- Migration: 20260908130000_api_clients_and_webhooks_schema.sql
-- Description: Schema de clientes integradores de API (tenants), subscrições
--              de webhooks e controle de escopo geográfico (FR-3, FR-16, FR-17, NFR-5).
-- Architecture: Hexagonal / Headless / Supabase PostgreSQL 15+
-- ==============================================================================

-- 1. Tabela: api_clients (Tenants e Integradores B2B)
CREATE TABLE IF NOT EXISTS public.api_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    api_key_hash TEXT NOT NULL UNIQUE,
    owner_email TEXT NOT NULL,
    allowed_cities TEXT[] NOT NULL DEFAULT '{"*"}',
    rate_limit_rpm INT NOT NULL DEFAULT 120,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Restrições de integridade
    CONSTRAINT check_api_clients_name_not_empty CHECK (trim(client_name) <> ''),
    CONSTRAINT check_api_clients_key_hash_len CHECK (length(api_key_hash) = 64),
    CONSTRAINT check_api_clients_rate_limit_positive CHECK (rate_limit_rpm > 0),
    CONSTRAINT check_api_clients_allowed_cities_not_empty CHECK (cardinality(allowed_cities) > 0)
);

COMMENT ON TABLE public.api_clients IS 'Tenants e integradores terceiros (cardápios, PDVs, portais municipais) com credenciais e limites de requisição (FR-3).';
COMMENT ON COLUMN public.api_clients.api_key_hash IS 'Hash SHA-256 (64 hex chars) da API Key emitida. Nunca armazena a chave em texto puro.';
COMMENT ON COLUMN public.api_clients.allowed_cities IS 'Lista de slugs de cidades autorizadas (ex: {"sao_paulo", "rio_de_janeiro"}). Valor {"*"} confere acesso nacional irrestrito.';
COMMENT ON COLUMN public.api_clients.rate_limit_rpm IS 'Limite de requisições por minuto (120 RPM Free, 600 RPM Enterprise).';

-- 2. Tabela: webhooks_subscriptions (Endpoints receptores de parceiros)
CREATE TABLE IF NOT EXISTS public.webhooks_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.api_clients(id) ON DELETE CASCADE,
    target_url TEXT NOT NULL,
    event_type TEXT NOT NULL,
    secret_token TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Validação de eventos canônicos de delivery
    CONSTRAINT check_webhook_event_type CHECK (
        event_type IN (
            'job.created',
            'bid.submitted',
            'job.accepted',
            'job.completed'
        )
    ),
    CONSTRAINT check_webhook_url_format CHECK (target_url ~* '^https?://.+$'),
    CONSTRAINT check_webhook_secret_not_empty CHECK (length(secret_token) >= 16)
);

COMMENT ON TABLE public.webhooks_subscriptions IS 'Subscrições de eventos operacionais para despacho assinado via HMAC-SHA256 (FR-17).';
COMMENT ON COLUMN public.webhooks_subscriptions.target_url IS 'URL de destino HTTP POST fornecida pelo integrador parceiro.';
COMMENT ON COLUMN public.webhooks_subscriptions.secret_token IS 'Segredo compartilhado utilizado para calcular a assinatura X-Signature-SHA256.';

-- 3. Associação de Origem em Tabelas Operacionais Existentes
ALTER TABLE public.users 
    ADD COLUMN IF NOT EXISTS origin_client_id UUID REFERENCES public.api_clients(id) ON DELETE SET NULL;

ALTER TABLE public.job_posts 
    ADD COLUMN IF NOT EXISTS origin_client_id UUID REFERENCES public.api_clients(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.users.origin_client_id IS 'Identificador do integrador parceiro de onde originou o cadastro do usuário (se via API).';
COMMENT ON COLUMN public.job_posts.origin_client_id IS 'Identificador do integrador parceiro de onde a vaga foi criada headless via API.';

-- 4. Índices para Alta Performance e Busca Rápida no Gateway
CREATE INDEX IF NOT EXISTS idx_api_clients_api_key_hash 
    ON public.api_clients(api_key_hash);

CREATE INDEX IF NOT EXISTS idx_api_clients_is_active 
    ON public.api_clients(is_active);

CREATE INDEX IF NOT EXISTS idx_webhooks_subscriptions_client_id 
    ON public.webhooks_subscriptions(client_id);

CREATE INDEX IF NOT EXISTS idx_webhooks_subscriptions_event_type 
    ON public.webhooks_subscriptions(event_type);

CREATE INDEX IF NOT EXISTS idx_users_origin_client_id 
    ON public.users(origin_client_id) 
    WHERE origin_client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_posts_origin_client_id 
    ON public.job_posts(origin_client_id) 
    WHERE origin_client_id IS NOT NULL;

-- 5. Row Level Security (RLS - NFR-5)
ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para api_clients
DROP POLICY IF EXISTS "api_clients_service_role_all" ON public.api_clients;
CREATE POLICY "api_clients_service_role_all" 
    ON public.api_clients 
    FOR ALL 
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "api_clients_select_owner" ON public.api_clients;
CREATE POLICY "api_clients_select_owner" 
    ON public.api_clients 
    FOR SELECT 
    USING (
        auth.role() = 'authenticated' 
        AND owner_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Políticas de RLS para webhooks_subscriptions
DROP POLICY IF EXISTS "webhooks_subscriptions_service_role_all" ON public.webhooks_subscriptions;
CREATE POLICY "webhooks_subscriptions_service_role_all" 
    ON public.webhooks_subscriptions 
    FOR ALL 
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "webhooks_subscriptions_owner_all" ON public.webhooks_subscriptions;
CREATE POLICY "webhooks_subscriptions_owner_all" 
    ON public.webhooks_subscriptions 
    FOR ALL 
    USING (
        auth.role() = 'authenticated' 
        AND EXISTS (
            SELECT 1 FROM public.api_clients c 
            WHERE c.id = webhooks_subscriptions.client_id 
              AND c.owner_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );

-- 6. Função PL/pgSQL Utilitária de Validação de Gateway
CREATE OR REPLACE FUNCTION public.validate_api_client_access(
    p_api_key_hash TEXT,
    p_city_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    is_authenticated BOOLEAN,
    is_city_authorized BOOLEAN,
    client_id UUID,
    client_name TEXT,
    rate_limit_rpm INT,
    status_code INT,
    error_message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_client public.api_clients%ROWTYPE;
    v_norm_city TEXT;
BEGIN
    -- Busca o cliente ativo pelo hash SHA-256
    SELECT * INTO v_client 
    FROM public.api_clients 
    WHERE api_key_hash = p_api_key_hash 
      AND is_active = true;

    -- Se não encontrar ou inativo -> 401 Unauthorized
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            false, 
            false, 
            NULL::UUID, 
            NULL::TEXT, 
            0, 
            401, 
            'API Key inválida, revogada ou inativa'::TEXT;
        RETURN;
    END IF;

    -- Se não especificou cidade para validação, autenticação é aprovada
    IF p_city_id IS NULL OR trim(p_city_id) = '' THEN
        RETURN QUERY SELECT 
            true, 
            true, 
            v_client.id, 
            v_client.client_name, 
            v_client.rate_limit_rpm, 
            200, 
            NULL::TEXT;
        RETURN;
    END IF;

    -- Normaliza a cidade pesquisada
    v_norm_city := lower(trim(p_city_id));

    -- Verifica se possui wildcard nacional ("*") ou a cidade específica
    IF '*' = ANY(v_client.allowed_cities) OR v_norm_city = ANY(v_client.allowed_cities) THEN
        RETURN QUERY SELECT 
            true, 
            true, 
            v_client.id, 
            v_client.client_name, 
            v_client.rate_limit_rpm, 
            200, 
            NULL::TEXT;
    ELSE
        RETURN QUERY SELECT 
            true, 
            false, 
            v_client.id, 
            v_client.client_name, 
            v_client.rate_limit_rpm, 
            403, 
            ('Acesso não autorizado para o município: ' || v_norm_city)::TEXT;
    END IF;
END;
$$;
