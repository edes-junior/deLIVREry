Conduct a review of CONTENT.
Look for what's missing, not only what's wrong.
Find at least ten issues to fix or improve.
Output a Markdown list of findings only — no severity, priority, or ranking.
If the content is empty, stop and say so.
If you have zero findings, re-check and keep thinking; do not stop with an empty list.

CONTENT:
diff --git a/_bmad-output/implementation-artifacts/deferred-work.md b/_bmad-output/implementation-artifacts/deferred-work.md
index a5623cf..998b546 100644
--- a/_bmad-output/implementation-artifacts/deferred-work.md
+++ b/_bmad-output/implementation-artifacts/deferred-work.md
@@ -11,3 +11,19 @@
 ## Deferred from: code review of Epic 1 (2026-09-04)
 - [Review][Defer] Triggers de Quórum `sync_region_unlock_quorum` limitados a `AFTER INSERT` [`supabase/migrations/20260904160000_update_courier_profiles_geography.sql:98-109`] — expandir suporte para UPDATE (troca de bairro) e DELETE (exclusão de conta) quando a gestão administrativa de perfis e transferência territorial for modelada.
 
+- source_spec: none
+  summary: Story 5.2 - Endpoints RESTful Headless de Gestão de Vagas e Perfis (OpenAPI 3.0).
+  evidence: Escopo dividido do Epic 5 via Multi-goal check para desenvolvimento sequencial focado a partir da Story 5.1.
+
+- source_spec: none
+  summary: Story 5.3 - Dispatcher de Webhooks de Saída Assinados Criptograficamente (HMAC-SHA256).
+  evidence: Escopo dividido do Epic 5 via Multi-goal check para desenvolvimento sequencial focado a partir da Story 5.1.
+
+- source_spec: none
+  summary: Story 5.4 - Portal do Desenvolvedor (/developers) com Swagger UI Interativo.
+  evidence: Escopo dividido do Epic 5 via Multi-goal check para desenvolvimento sequencial focado a partir da Story 5.1.
+
+- source_spec: none
+  summary: Story 5.5 - Web Component Embutível Nativo (<delivrery-button />) para Cardápios e PDVs.
+  evidence: Escopo dividido do Epic 5 via Multi-goal check para desenvolvimento sequencial focado a partir da Story 5.1.
+
diff --git a/_bmad-output/implementation-artifacts/sprint-status.yaml b/_bmad-output/implementation-artifacts/sprint-status.yaml
index f45756d..fb34bc2 100644
--- a/_bmad-output/implementation-artifacts/sprint-status.yaml
+++ b/_bmad-output/implementation-artifacts/sprint-status.yaml
@@ -29,7 +29,7 @@
 # - Dev moves story to 'review', then runs code-review (fresh context, different LLM recommended)
 # - Retrospective appends its action items to action_items; the status view surfaces open ones
 generated: 09-04-2026 14:24
-last_updated: 09-04-2026 19:07
+last_updated: 09-08-2026 14:14
 project: deLIVREry
 project_key: NOKEY
 tracking_system: file-system
@@ -63,8 +63,8 @@ development_status:
   4-4-painel-público-de-transparência-de-custos-do-servidor-e-vitó: done
   epic-4-retrospective: done
 
-  epic-5: backlog
-  5-1-schema-de-clientes-de-api-webhooks-e-gateway-de-validação: backlog
+  epic-5: in-progress
+  5-1-schema-de-clientes-de-api-webhooks-e-gateway-de-validação: review
   5-2-endpoints-restful-headless-de-gestão-de-vagas-e-perfis-opena: backlog
   5-3-dispatcher-de-webhooks-de-saída-assinados-criptograficamente: backlog
   5-4-portal-do-desenvolvedor-developers-com-swagger-ui-interativo: backlog
diff --git a/packages/api-client-sdk/src/index.js b/packages/api-client-sdk/src/index.js
index b7277e9..7e927f1 100644
--- a/packages/api-client-sdk/src/index.js
+++ b/packages/api-client-sdk/src/index.js
@@ -3,6 +3,8 @@
  * Neutral client SDK for interacting with deLIVREry Headless API
  */
 
+import { createHash, randomBytes } from 'node:crypto';
+
 export class DelivreryClient {
   constructor(config = {}) {
     this.baseUrl = (config.baseUrl || 'http://localhost:54321/functions/v1').replace(/\/$/, '');
@@ -10,6 +12,11 @@ export class DelivreryClient {
     this.fetchFn = config.fetch || (typeof fetch !== 'undefined' ? fetch : null);
   }
 
+  setApiKey(apiKey) {
+    this.apiKey = apiKey || '';
+    return this;
+  }
+
   async getHealth() {
     return { status: 'ok', client: 'delivrery-api-client-sdk' };
   }
@@ -51,6 +58,7 @@ export class DelivreryClient {
     };
 
     if (this.apiKey) {
+      headers['X-API-Key'] = this.apiKey;
       headers['Authorization'] = `Bearer ${this.apiKey}`;
     }
 
@@ -84,6 +92,27 @@ export class DelivreryClient {
   }
 }
 
+/**
+ * Utilitários de credenciais para integradores B2B
+ */
+export function hashApiKey(apiKey) {
+  if (!apiKey || typeof apiKey !== 'string') {
+    return '';
+  }
+  return createHash('sha256').update(apiKey.trim()).digest('hex');
+}
+
+export function generateApiKey(prefix = 'dlv_live', byteLength = 24) {
+  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_]/g, '');
+  const entropy = randomBytes(byteLength).toString('hex');
+  return `${cleanPrefix}_${entropy}`;
+}
+
+export function generateWebhookSecret(byteLength = 32) {
+  const entropy = randomBytes(byteLength).toString('hex');
+  return `whsec_${entropy}`;
+}
+
 /**
  * Funções utilitárias de BR Code PIX no padrão EMVCo / BACEN
  */
@@ -135,4 +164,3 @@ export function generatePixBrcode(params = {}) {
 }
 
 export default DelivreryClient;
-

diff --git a/supabase/migrations/20260908130000_api_clients_and_webhooks_schema.sql b/supabase/migrations/20260908130000_api_clients_and_webhooks_schema.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20260908130000_api_clients_and_webhooks_schema.sql
@@ -0,0 +1,207 @@
+-- ==============================================================================
+-- Migration: 20260908130000_api_clients_and_webhooks_schema.sql
+-- Description: Schema de clientes integradores de API (tenants), subscrições
+--              de webhooks e controle de escopo geográfico (FR-3, FR-16, FR-17, NFR-5).
+-- Architecture: Hexagonal / Headless / Supabase PostgreSQL 15+
+-- ==============================================================================
+
+-- 1. Tabela: api_clients (Tenants e Integradores B2B)
+CREATE TABLE IF NOT EXISTS public.api_clients (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    client_name TEXT NOT NULL,
+    api_key_hash TEXT NOT NULL UNIQUE,
+    owner_email TEXT NOT NULL,
+    allowed_cities TEXT[] NOT NULL DEFAULT '{"*"}',
+    rate_limit_rpm INT NOT NULL DEFAULT 120,
+    is_active BOOLEAN NOT NULL DEFAULT true,
+    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
+    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
+
+    -- Restrições de integridade
+    CONSTRAINT check_api_clients_name_not_empty CHECK (trim(client_name) <> ''),
+    CONSTRAINT check_api_clients_key_hash_len CHECK (length(api_key_hash) = 64),
+    CONSTRAINT check_api_clients_rate_limit_positive CHECK (rate_limit_rpm > 0),
+    CONSTRAINT check_api_clients_allowed_cities_not_empty CHECK (cardinality(allowed_cities) > 0)
+);
+
+COMMENT ON TABLE public.api_clients IS 'Tenants e integradores terceiros (cardápios, PDVs, portais municipais) com credenciais e limites de requisição (FR-3).';
+COMMENT ON COLUMN public.api_clients.api_key_hash IS 'Hash SHA-256 (64 hex chars) da API Key emitida. Nunca armazena a chave em texto puro.';
+COMMENT ON COLUMN public.api_clients.allowed_cities IS 'Lista de slugs de cidades autorizadas (ex: {"sao_paulo", "rio_de_janeiro"}). Valor {"*"} confere acesso nacional irrestrito.';
+COMMENT ON COLUMN public.api_clients.rate_limit_rpm IS 'Limite de requisições por minuto (120 RPM Free, 600 RPM Enterprise).';
+
+-- 2. Tabela: webhooks_subscriptions (Endpoints receptores de parceiros)
+CREATE TABLE IF NOT EXISTS public.webhooks_subscriptions (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    client_id UUID NOT NULL REFERENCES public.api_clients(id) ON DELETE CASCADE,
+    target_url TEXT NOT NULL,
+    event_type TEXT NOT NULL,
+    secret_token TEXT NOT NULL,
+    is_active BOOLEAN NOT NULL DEFAULT true,
+    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
+
+    -- Validação de eventos canônicos de delivery
+    CONSTRAINT check_webhook_event_type CHECK (
+        event_type IN (
+            'job.created',
+            'bid.submitted',
+            'job.accepted',
+            'job.completed'
+        )
+    ),
+    CONSTRAINT check_webhook_url_format CHECK (target_url ~* '^https?://.+$'),
+    CONSTRAINT check_webhook_secret_not_empty CHECK (length(secret_token) >= 16)
+);
+
+COMMENT ON TABLE public.webhooks_subscriptions IS 'Subscrições de eventos operacionais para despacho assinado via HMAC-SHA256 (FR-17).';
+COMMENT ON COLUMN public.webhooks_subscriptions.target_url IS 'URL de destino HTTP POST fornecida pelo integrador parceiro.';
+COMMENT ON COLUMN public.webhooks_subscriptions.secret_token IS 'Segredo compartilhado utilizado para calcular a assinatura X-Signature-SHA256.';
+
+-- 3. Associação de Origem em Tabelas Operacionais Existentes
+ALTER TABLE public.users 
+    ADD COLUMN IF NOT EXISTS origin_client_id UUID REFERENCES public.api_clients(id) ON DELETE SET NULL;
+
+ALTER TABLE public.job_posts 
+    ADD COLUMN IF NOT EXISTS origin_client_id UUID REFERENCES public.api_clients(id) ON DELETE SET NULL;
+
+COMMENT ON COLUMN public.users.origin_client_id IS 'Identificador do integrador parceiro de onde originou o cadastro do usuário (se via API).';
+COMMENT ON COLUMN public.job_posts.origin_client_id IS 'Identificador do integrador parceiro de onde a vaga foi criada headless via API.';
+
+-- 4. Índices para Alta Performance e Busca Rápida no Gateway
+CREATE INDEX IF NOT EXISTS idx_api_clients_api_key_hash 
+    ON public.api_clients(api_key_hash);
+
+CREATE INDEX IF NOT EXISTS idx_api_clients_is_active 
+    ON public.api_clients(is_active);
+
+CREATE INDEX IF NOT EXISTS idx_webhooks_subscriptions_client_id 
+    ON public.webhooks_subscriptions(client_id);
+
+CREATE INDEX IF NOT EXISTS idx_webhooks_subscriptions_event_type 
+    ON public.webhooks_subscriptions(event_type);
+
+CREATE INDEX IF NOT EXISTS idx_users_origin_client_id 
+    ON public.users(origin_client_id) 
+    WHERE origin_client_id IS NOT NULL;
+
+CREATE INDEX IF NOT EXISTS idx_job_posts_origin_client_id 
+    ON public.job_posts(origin_client_id) 
+    WHERE origin_client_id IS NOT NULL;
+
+-- 5. Row Level Security (RLS - NFR-5)
+ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY;
+ALTER TABLE public.webhooks_subscriptions ENABLE ROW LEVEL SECURITY;
+
+-- Políticas de RLS para api_clients
+DROP POLICY IF EXISTS "api_clients_service_role_all" ON public.api_clients;
+CREATE POLICY "api_clients_service_role_all" 
+    ON public.api_clients 
+    FOR ALL 
+    USING (auth.role() = 'service_role');
+
+DROP POLICY IF EXISTS "api_clients_select_owner" ON public.api_clients;
+CREATE POLICY "api_clients_select_owner" 
+    ON public.api_clients 
+    FOR SELECT 
+    USING (
+        auth.role() = 'authenticated' 
+        AND owner_email = (SELECT email FROM auth.users WHERE id = auth.uid())
+    );
+
+-- Políticas de RLS para webhooks_subscriptions
+DROP POLICY IF EXISTS "webhooks_subscriptions_service_role_all" ON public.webhooks_subscriptions;
+CREATE POLICY "webhooks_subscriptions_service_role_all" 
+    ON public.webhooks_subscriptions 
+    FOR ALL 
+    USING (auth.role() = 'service_role');
+
+DROP POLICY IF EXISTS "webhooks_subscriptions_owner_all" ON public.webhooks_subscriptions;
+CREATE POLICY "webhooks_subscriptions_owner_all" 
+    ON public.webhooks_subscriptions 
+    FOR ALL 
+    USING (
+        auth.role() = 'authenticated' 
+        AND EXISTS (
+            SELECT 1 FROM public.api_clients c 
+            WHERE c.id = webhooks_subscriptions.client_id 
+              AND c.owner_email = (SELECT email FROM auth.users WHERE id = auth.uid())
+        )
+    );
+
+-- 6. Função PL/pgSQL Utilitária de Validação de Gateway
+CREATE OR REPLACE FUNCTION public.validate_api_client_access(
+    p_api_key_hash TEXT,
+    p_city_id TEXT DEFAULT NULL
+)
+RETURNS TABLE (
+    is_authenticated BOOLEAN,
+    is_city_authorized BOOLEAN,
+    client_id UUID,
+    client_name TEXT,
+    rate_limit_rpm INT,
+    status_code INT,
+    error_message TEXT
+) 
+LANGUAGE plpgsql
+SECURITY DEFINER
+AS $$
+DECLARE
+    v_client public.api_clients%ROWTYPE;
+    v_norm_city TEXT;
+BEGIN
+    -- Busca o cliente ativo pelo hash SHA-256
+    SELECT * INTO v_client 
+    FROM public.api_clients 
+    WHERE api_key_hash = p_api_key_hash 
+      AND is_active = true;
+
+    -- Se não encontrar ou inativo -> 401 Unauthorized
+    IF NOT FOUND THEN
+        RETURN QUERY SELECT 
+            false, 
+            false, 
+            NULL::UUID, 
+            NULL::TEXT, 
+            0, 
+            401, 
+            'API Key inválida, revogada ou inativa'::TEXT;
+        RETURN;
+    END IF;
+
+    -- Se não especificou cidade para validação, autenticação é aprovada
+    IF p_city_id IS NULL OR trim(p_city_id) = '' THEN
+        RETURN QUERY SELECT 
+            true, 
+            true, 
+            v_client.id, 
+            v_client.client_name, 
+            v_client.rate_limit_rpm, 
+            200, 
+            NULL::TEXT;
+        RETURN;
+    END IF;
+
+    -- Normaliza a cidade pesquisada
+    v_norm_city := lower(trim(p_city_id));
+
+    -- Verifica se possui wildcard nacional ("*") ou a cidade específica
+    IF '*' = ANY(v_client.allowed_cities) OR v_norm_city = ANY(v_client.allowed_cities) THEN
+        RETURN QUERY SELECT 
+            true, 
+            true, 
+            v_client.id, 
+            v_client.client_name, 
+            v_client.rate_limit_rpm, 
+            200, 
+            NULL::TEXT;
+    ELSE
+        RETURN QUERY SELECT 
+            true, 
+            false, 
+            v_client.id, 
+            v_client.client_name, 
+            v_client.rate_limit_rpm, 
+            403, 
+            ('Acesso não autorizado para o município: ' || v_norm_city)::TEXT;
+    END IF;
+END;
+$$;

diff --git a/apps/pwa/src/api/gateway/types.ts b/apps/pwa/src/api/gateway/types.ts
new file mode 100644
--- /dev/null
+++ b/apps/pwa/src/api/gateway/types.ts
@@ -0,0 +1,78 @@
+/**
+ * Contratos de tipos para o Gateway de API e Tenants Integradores
+ * Em conformidade com RFC 7807 Problem Details e arquitetura Headless.
+ */
+
+export type WebhookEventType = 
+  | 'job.created'
+  | 'bid.submitted'
+  | 'job.accepted'
+  | 'job.completed';
+
+export const VALID_WEBHOOK_EVENTS: readonly WebhookEventType[] = [
+  'job.created',
+  'bid.submitted',
+  'job.accepted',
+  'job.completed'
+] as const;
+
+export interface ApiClient {
+  id: string;
+  clientName: string;
+  apiKeyHash: string;
+  ownerEmail: string;
+  allowedCities: string[];
+  rateLimitRpm: number;
+  isActive: boolean;
+  createdAt?: string;
+  updatedAt?: string;
+}
+
+export interface WebhookSubscription {
+  id: string;
+  clientId: string;
+  targetUrl: string;
+  eventType: WebhookEventType;
+  secretToken: string;
+  isActive: boolean;
+  createdAt?: string;
+}
+
+/**
+ * Resposta de erro padronizada conforme a especificação RFC 7807 Problem Details
+ */
+export interface ProblemDetails {
+  type: string;
+  title: string;
+  status: number;
+  detail: string;
+  instance?: string;
+  invalidParams?: Array<{
+    name: string;
+    reason: string;
+  }>;
+  [key: string]: unknown;
+}
+
+export interface ApiGatewayRequest {
+  method: string;
+  url: string;
+  headers?: Record<string, string | undefined>;
+  queryParams?: Record<string, string | undefined>;
+  body?: any;
+  cityId?: string;
+}
+
+export interface ApiGatewayAuthResult {
+  isAuthenticated: boolean;
+  isAuthorized: boolean;
+  client?: ApiClient;
+  problem?: ProblemDetails;
+  statusCode: number;
+}
+
+export interface ApiGatewayResponse {
+  status: number;
+  headers: Record<string, string>;
+  body: any;
+}

diff --git a/apps/pwa/src/api/gateway/api-gateway-service.ts b/apps/pwa/src/api/gateway/api-gateway-service.ts
new file mode 100644
--- /dev/null
+++ b/apps/pwa/src/api/gateway/api-gateway-service.ts
@@ -0,0 +1,316 @@
+import { createHash } from 'node:crypto';
+import { supabase } from '../../lib/supabase.ts';
+import type { 
+  ApiClient, 
+  ApiGatewayRequest, 
+  ApiGatewayAuthResult, 
+  ApiGatewayResponse, 
+  ProblemDetails,
+  WebhookSubscription,
+  WebhookEventType,
+  VALID_WEBHOOK_EVENTS
+} from './types.ts';
+
+export class ApiGatewayService {
+  private static mockClients: Map<string, ApiClient> = new Map();
+  private static mockSubscriptions: Map<string, WebhookSubscription[]> = new Map();
+
+  /**
+   * Calcula o hash SHA-256 (64 hex characters) da chave de API em texto plano.
+   */
+  public static hashApiKey(apiKey: string): string {
+    if (!apiKey || typeof apiKey !== 'string') {
+      return '';
+    }
+    return createHash('sha256').update(apiKey.trim()).digest('hex');
+  }
+
+  /**
+   * Normaliza o identificador da cidade para comparação case-insensitive sem acentos.
+   */
+  public static normalizeCity(city: string): string {
+    if (!city || typeof city !== 'string') {
+      return '';
+    }
+    return city
+      .trim()
+      .toLowerCase()
+      .normalize('NFD')
+      .replace(/[\u0300-\u036f]/g, '')
+      .replace(/[^a-z0-9_]/g, '_');
+  }
+
+  /**
+   * Verifica se a cidade solicitada está contida na lista de cidades autorizadas pelo cliente.
+   * O valor "*" confere acesso nacional a qualquer município.
+   */
+  public static validateCityAccess(allowedCities: string[], requestedCity?: string): boolean {
+    if (!requestedCity || requestedCity.trim() === '') {
+      return true;
+    }
+
+    if (!Array.isArray(allowedCities) || allowedCities.length === 0) {
+      return false;
+    }
+
+    if (allowedCities.includes('*')) {
+      return true;
+    }
+
+    const normRequested = this.normalizeCity(requestedCity);
+    return allowedCities.some(city => this.normalizeCity(city) === normRequested);
+  }
+
+  /**
+   * Extrai a API Key dos cabeçalhos HTTP suportados (X-API-Key ou Authorization: Bearer dlv_...)
+   */
+  public static extractApiKey(headers?: Record<string, string | undefined>): string | null {
+    if (!headers) return null;
+
+    for (const [key, value] of Object.entries(headers)) {
+      if (key.toLowerCase() === 'x-api-key' && value && typeof value === 'string') {
+        const trimmed = value.trim();
+        if (trimmed) return trimmed;
+      }
+      if (key.toLowerCase() === 'authorization' && value && typeof value === 'string') {
+        const match = value.trim().match(/^Bearer\s+(dlv_[a-zA-Z0-9_-]+)$/i);
+        if (match && match[1]) {
+          return match[1];
+        }
+      }
+    }
+
+    return null;
+  }
+
+  /**
+   * Extrai o identificador da cidade a partir de query params, cabeçalhos ou body
+   */
+  public static extractCityId(req: ApiGatewayRequest): string | null {
+    if (req.cityId && typeof req.cityId === 'string' && req.cityId.trim()) {
+      return req.cityId.trim();
+    }
+
+    if (req.queryParams) {
+      const qCity = req.queryParams['city_id'] || req.queryParams['cityId'] || req.queryParams['city'];
+      if (qCity && typeof qCity === 'string' && qCity.trim()) {
+        return qCity.trim();
+      }
+    }
+
+    if (req.headers) {
+      for (const [key, value] of Object.entries(req.headers)) {
+        if (key.toLowerCase() === 'x-city-id' && value && typeof value === 'string') {
+          return value.trim();
+        }
+      }
+    }
+
+    if (req.body && typeof req.body === 'object') {
+      const bCity = req.body.city_id || req.body.cityId || req.body.city;
+      if (bCity && typeof bCity === 'string' && bCity.trim()) {
+        return bCity.trim();
+      }
+    }
+
+    return null;
+  }
+
+  /**
+   * Autentica e valida a requisição HTTP contra o schema de parceiros e escopo territorial
+   */
+  public static async authenticateRequest(req: ApiGatewayRequest): Promise<ApiGatewayAuthResult> {
+    const rawApiKey = this.extractApiKey(req.headers);
+
+    if (!rawApiKey) {
+      const problem: ProblemDetails = {
+        type: 'https://delivrery.app.br/errors/unauthorized',
+        title: 'Não Autorizado',
+        status: 401,
+        detail: 'Cabeçalho X-API-Key ausente ou inválido.',
+        instance: req.url
+      };
+      return {
+        isAuthenticated: false,
+        isAuthorized: false,
+        statusCode: 401,
+        problem
+      };
+    }
+
+    const keyHash = this.hashApiKey(rawApiKey);
+    let client: ApiClient | null = null;
+
+    // 1. Verifica no repositório em memória/mock
+    if (this.mockClients.has(keyHash)) {
+      client = this.mockClients.get(keyHash)!;
+    } else if (supabase) {
+      // 2. Consulta no Supabase PostgreSQL
+      try {
+        const { data, error } = await supabase
+          .from('api_clients')
+          .select('*')
+          .eq('api_key_hash', keyHash)
+          .single();
+
+        if (data && !error) {
+          client = {
+            id: data.id,
+            clientName: data.client_name,
+            apiKeyHash: data.api_key_hash,
+            ownerEmail: data.owner_email,
+            allowedCities: data.allowed_cities || ['*'],
+            rateLimitRpm: data.rate_limit_rpm || 120,
+            isActive: Boolean(data.is_active),
+            createdAt: data.created_at,
+            updatedAt: data.updated_at
+          };
+        }
+      } catch {
+        // Fallback se supabase local não estiver com o servidor ativo
+      }
+    }
+
+    if (!client || !client.isActive) {
+      const problem: ProblemDetails = {
+        type: 'https://delivrery.app.br/errors/unauthorized',
+        title: 'Não Autorizado',
+        status: 401,
+        detail: 'API Key inválida, revogada ou inativa.',
+        instance: req.url
+      };
+      return {
+        isAuthenticated: false,
+        isAuthorized: false,
+        statusCode: 401,
+        problem
+      };
+    }
+
+    // Validação de Escopo Geográfico (allowed_cities)
+    const requestedCity = this.extractCityId(req);
+    if (requestedCity) {
+      const isCityAllowed = this.validateCityAccess(client.allowedCities, requestedCity);
+      if (!isCityAllowed) {
+        const problem: ProblemDetails = {
+          type: 'https://delivrery.app.br/errors/forbidden',
+          title: 'Acesso Não Autorizado para Município',
+          status: 403,
+          detail: `Acesso não autorizado para o município solicitado: ${requestedCity}`,
+          instance: req.url
+        };
+        return {
+          isAuthenticated: true,
+          isAuthorized: false,
+          client,
+          statusCode: 403,
+          problem
+        };
+      }
+    }
+
+    return {
+      isAuthenticated: true,
+      isAuthorized: true,
+      client,
+      statusCode: 200
+    };
+  }
+
+  /**
+   * Intercepta a requisição, valida autenticação e CORS, e delega para o handler subsequente.
+   */
+  public static async handleGatewayRequest(
+    req: ApiGatewayRequest,
+    next: (client: ApiClient) => Promise<ApiGatewayResponse>
+  ): Promise<ApiGatewayResponse> {
+    const corsHeaders: Record<string, string> = {
+      'Access-Control-Allow-Origin': '*',
+      'Access-Control-Allow-Headers': 'X-API-Key, Authorization, Content-Type, X-City-ID',
+      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
+    };
+
+    if (req.method.toUpperCase() === 'OPTIONS') {
+      return {
+        status: 204,
+        headers: corsHeaders,
+        body: null
+      };
+    }
+
+    const authResult = await this.authenticateRequest(req);
+
+    if (!authResult.isAuthenticated || !authResult.isAuthorized) {
+      return {
+        status: authResult.statusCode,
+        headers: {
+          ...corsHeaders,
+          'Content-Type': 'application/problem+json; charset=utf-8'
+        },
+        body: authResult.problem
+      };
+    }
+
+    const response = await next(authResult.client!);
+
+    return {
+      status: response.status,
+      headers: {
+        ...corsHeaders,
+        'X-RateLimit-Limit': authResult.client!.rateLimitRpm.toString(),
+        ...response.headers
+      },
+      body: response.body
+    };
+  }
+
+  /**
+   * Valida e registra uma subscrição de webhook
+   */
+  public static validateWebhookSubscription(sub: Partial<WebhookSubscription>): { valid: boolean; errors: string[] } {
+    const errors: string[] = [];
+
+    if (!sub.clientId) {
+      errors.push('client_id é obrigatório.');
+    }
+    if (!sub.targetUrl || !sub.targetUrl.match(/^https?:\/\/.+/)) {
+      errors.push('target_url deve ser uma URL HTTP/HTTPS válida.');
+    }
+    if (!sub.eventType || !['job.created', 'bid.submitted', 'job.accepted', 'job.completed'].includes(sub.eventType)) {
+      errors.push(`event_type deve ser um dos eventos canônicos: job.created, bid.submitted, job.accepted, job.completed.`);
+    }
+    if (!sub.secretToken || sub.secretToken.length < 16) {
+      errors.push('secret_token deve conter no mínimo 16 caracteres para assinatura HMAC-SHA256.');
+    }
+
+    return {
+      valid: errors.length === 0,
+      errors
+    };
+  }
+
+  // --- MÉTODOS AUXILIARES PARA TESTES E DESENVOLVIMENTO ---
+
+  public static registerMockClient(client: ApiClient): void {
+    this.mockClients.set(client.apiKeyHash, client);
+  }
+
+  public static clearMockClients(): void {
+    this.mockClients.clear();
+    this.mockSubscriptions.clear();
+  }
+
+  public static getMockClient(keyHash: string): ApiClient | undefined {
+    return this.mockClients.get(keyHash);
+  }
+
+  public static registerMockSubscription(sub: WebhookSubscription): void {
+    const list = this.mockSubscriptions.get(sub.clientId) || [];
+    list.push(sub);
+    this.mockSubscriptions.set(sub.clientId, list);
+  }
+
+  public static getMockSubscriptions(clientId: string): WebhookSubscription[] {
+    return this.mockSubscriptions.get(clientId) || [];
+  }
+}

diff --git a/tests/api-clients-gateway.test.js b/tests/api-clients-gateway.test.js
new file mode 100644
--- /dev/null
+++ b/tests/api-clients-gateway.test.js
@@ -0,0 +1,317 @@
+import { describe, it, beforeEach } from 'node:test';
+import assert from 'node:assert';
+import { readFileSync, existsSync } from 'node:fs';
+import { resolve } from 'node:path';
+import { ApiGatewayService } from '../apps/pwa/src/api/gateway/api-gateway-service.ts';
+import { 
+  DelivreryClient, 
+  hashApiKey, 
+  generateApiKey, 
+  generateWebhookSecret 
+} from '../packages/api-client-sdk/src/index.js';
+
+describe('Story 5.1: Schema de Clientes de API, Webhooks e Gateway de Validação (FR-3, FR-16, FR-17, NFR-5)', () => {
+  beforeEach(() => {
+    ApiGatewayService.clearMockClients();
+  });
+
+  describe('Matriz de I/O & Edge Cases do API Gateway', () => {
+    it('Cenário 1: Autenticação Válida (Nacional) com allowed_cities=["*"]', async () => {
+      const rawKey = 'dlv_live_abc123national';
+      const keyHash = hashApiKey(rawKey);
+
+      ApiGatewayService.registerMockClient({
+        id: 'client-1111-uuid',
+        clientName: 'Portal Municipal Nacional',
+        apiKeyHash: keyHash,
+        ownerEmail: 'tech@prefeitura.gov.br',
+        allowedCities: ['*'],
+        rateLimitRpm: 600,
+        isActive: true
+      });
+
+      const response = await ApiGatewayService.handleGatewayRequest(
+        {
+          method: 'GET',
+          url: '/api/v1/jobs?city_id=rio_de_janeiro',
+          headers: {
+            'x-api-key': rawKey
+          },
+          queryParams: {
+            city_id: 'rio_de_janeiro'
+          }
+        },
+        async (client) => {
+          return {
+            status: 200,
+            headers: { 'Content-Type': 'application/json' },
+            body: { message: 'sucesso', clientId: client.id, rpm: client.rateLimitRpm }
+          };
+        }
+      );
+
+      assert.strictEqual(response.status, 200);
+      assert.strictEqual(response.headers['X-RateLimit-Limit'], '600');
+      assert.strictEqual(response.body.message, 'sucesso');
+      assert.strictEqual(response.body.clientId, 'client-1111-uuid');
+    });
+
+    it('Cenário 2: Autenticação Válida (Cidade Permitida) com escopo regional', async () => {
+      const rawKey = 'dlv_live_xyz789regional';
+      const keyHash = hashApiKey(rawKey);
+
+      ApiGatewayService.registerMockClient({
+        id: 'client-2222-uuid',
+        clientName: 'Cardápio Digital SP',
+        apiKeyHash: keyHash,
+        ownerEmail: 'integracao@cardapio.com',
+        allowedCities: ['sao_paulo', 'santos'],
+        rateLimitRpm: 120,
+        isActive: true
+      });
+
+      const response = await ApiGatewayService.handleGatewayRequest(
+        {
+          method: 'POST',
+          url: '/api/v1/jobs',
+          headers: {
+            'X-API-Key': rawKey
+          },
+          body: {
+            city_id: 'São Paulo' // Testa normalização com acento e maiúsculas
+          }
+        },
+        async (client) => {
+          return {
+            status: 201,
+            headers: { 'Content-Type': 'application/json' },
+            body: { created: true, clientName: client.clientName }
+          };
+        }
+      );
+
+      assert.strictEqual(response.status, 201);
+      assert.strictEqual(response.headers['X-RateLimit-Limit'], '120');
+      assert.strictEqual(response.body.created, true);
+      assert.strictEqual(response.body.clientName, 'Cardápio Digital SP');
+    });
+
+    it('Cenário 3: Chave Ausente - Rejeição com HTTP 401 e Problem Details RFC 7807', async () => {
+      const response = await ApiGatewayService.handleGatewayRequest(
+        {
+          method: 'GET',
+          url: '/api/v1/jobs?city_id=curitiba',
+          headers: {}
+        },
+        async () => {
+          return { status: 200, headers: {}, body: {} };
+        }
+      );
+
+      assert.strictEqual(response.status, 401);
+      assert.ok(response.headers['Content-Type'].includes('application/problem+json'));
+      assert.strictEqual(response.body.status, 401);
+      assert.strictEqual(response.body.title, 'Não Autorizado');
+      assert.ok(response.body.detail.includes('X-API-Key ausente ou inválido'));
+      assert.strictEqual(response.body.instance, '/api/v1/jobs?city_id=curitiba');
+    });
+
+    it('Cenário 4: Chave Inválida ou Revogada (is_active=false) - Rejeição com HTTP 401 RFC 7807', async () => {
+      // 4a: Chave inexistente
+      const respInvalid = await ApiGatewayService.handleGatewayRequest(
+        {
+          method: 'GET',
+          url: '/api/v1/jobs',
+          headers: { 'X-API-Key': 'dlv_invalid_key_999' }
+        },
+        async () => ({ status: 200, headers: {}, body: {} })
+      );
+
+      assert.strictEqual(respInvalid.status, 401);
+      assert.strictEqual(respInvalid.body.status, 401);
+      assert.ok(respInvalid.body.detail.includes('inválida, revogada ou inativa'));
+
+      // 4b: Cliente revogado/inativo
+      const rawRevoked = 'dlv_live_revoked_client';
+      ApiGatewayService.registerMockClient({
+        id: 'client-revoked',
+        clientName: 'Parceiro Desativado',
+        apiKeyHash: hashApiKey(rawRevoked),
+        ownerEmail: 'blocked@parceiro.com',
+        allowedCities: ['*'],
+        rateLimitRpm: 120,
+        isActive: false
+      });
+
+      const respRevoked = await ApiGatewayService.handleGatewayRequest(
+        {
+          method: 'GET',
+          url: '/api/v1/jobs',
+          headers: { 'X-API-Key': rawRevoked }
+        },
+        async () => ({ status: 200, headers: {}, body: {} })
+      );
+
+      assert.strictEqual(respRevoked.status, 401);
+      assert.strictEqual(respRevoked.body.status, 401);
+      assert.ok(respRevoked.body.detail.includes('inválida, revogada ou inativa'));
+    });
+
+    it('Cenário 5: Escopo Geográfico Não Autorizado - Rejeição com HTTP 403 RFC 7807', async () => {
+      const rawKey = 'dlv_live_curitiba_only';
+      ApiGatewayService.registerMockClient({
+        id: 'client-curitiba-only',
+        clientName: 'Parceiro Curitiba',
+        apiKeyHash: hashApiKey(rawKey),
+        ownerEmail: 'cwb@parceiro.com',
+        allowedCities: ['curitiba'],
+        rateLimitRpm: 120,
+        isActive: true
+      });
+
+      const response = await ApiGatewayService.handleGatewayRequest(
+        {
+          method: 'GET',
+          url: '/api/v1/jobs?city_id=sao_paulo',
+          headers: { 'X-API-Key': rawKey },
+          queryParams: { city_id: 'sao_paulo' }
+        },
+        async () => ({ status: 200, headers: {}, body: {} })
+      );
+
+      assert.strictEqual(response.status, 403);
+      assert.ok(response.headers['Content-Type'].includes('application/problem+json'));
+      assert.strictEqual(response.body.status, 403);
+      assert.strictEqual(response.body.title, 'Acesso Não Autorizado para Município');
+      assert.ok(response.body.detail.includes('sao_paulo'));
+    });
+
+    it('Cenário 6: Subscrição de Webhook Válida e Registro', () => {
+      const validSub = {
+        clientId: 'client-1111-uuid',
+        targetUrl: 'https://api.parceiro.com/webhooks/delivrery',
+        eventType: 'job.created',
+        secretToken: 'whsec_test_secret_token_1234567890',
+        isActive: true
+      };
+
+      const result = ApiGatewayService.validateWebhookSubscription(validSub);
+      assert.strictEqual(result.valid, true);
+      assert.strictEqual(result.errors.length, 0);
+    });
+
+    it('Cenário 7: Evento de Webhook Inválido ou URL Malformatada - Rejeição de Validação', () => {
+      const invalidSub = {
+        clientId: 'client-1111-uuid',
+        targetUrl: 'invalid-not-a-url',
+        eventType: 'invalid.event.type',
+        secretToken: 'short'
+      };
+
+      const result = ApiGatewayService.validateWebhookSubscription(invalidSub);
+      assert.strictEqual(result.valid, false);
+      assert.ok(result.errors.some(e => e.includes('target_url')));
+      assert.ok(result.errors.some(e => e.includes('event_type')));
+      assert.ok(result.errors.some(e => e.includes('secret_token')));
+    });
+  });
+
+  describe('Utilitários Criptográficos e Suporte no SDK', () => {
+    it('deve calcular hash SHA-256 idempotente e consistente', () => {
+      const key = 'dlv_live_mysecretkey123';
+      const hash1 = hashApiKey(key);
+      const hash2 = ApiGatewayService.hashApiKey(key);
+
+      assert.strictEqual(hash1.length, 64);
+      assert.strictEqual(hash1, hash2);
+      assert.strictEqual(/^[0-9a-f]{64}$/.test(hash1), true);
+    });
+
+    it('deve gerar credenciais seguras com formato padronizado', () => {
+      const liveKey = generateApiKey('dlv_live', 24);
+      const testKey = generateApiKey('dlv_test', 24);
+      const webhookSecret = generateWebhookSecret(32);
+
+      assert.ok(liveKey.startsWith('dlv_live_'));
+      assert.ok(testKey.startsWith('dlv_test_'));
+      assert.ok(webhookSecret.startsWith('whsec_'));
+      assert.ok(liveKey.length >= 40);
+      assert.ok(webhookSecret.length >= 40);
+    });
+
+    it('deve configurar DelivreryClient com X-API-Key e despachar nos headers', async () => {
+      let capturedHeaders = null;
+      const mockFetch = async (url, options) => {
+        capturedHeaders = options.headers;
+        return {
+          ok: true,
+          status: 200,
+          json: async () => ({ status: 'ok' })
+        };
+      };
+
+      const client = new DelivreryClient({
+        apiKey: 'dlv_live_client_test_key',
+        fetch: mockFetch
+      });
+
+      await client.getPricingStats({
+        city_id: 'rio_de_janeiro',
+        neighborhood_id: 'copacabana'
+      });
+
+      assert.ok(capturedHeaders);
+      assert.strictEqual(capturedHeaders['X-API-Key'], 'dlv_live_client_test_key');
+      assert.strictEqual(capturedHeaders['Authorization'], 'Bearer dlv_live_client_test_key');
+    });
+
+    it('deve suportar preflight CORS (OPTIONS) com status 204 no gateway', async () => {
+      const response = await ApiGatewayService.handleGatewayRequest(
+        {
+          method: 'OPTIONS',
+          url: '/api/v1/jobs'
+        },
+        async () => ({ status: 200, headers: {}, body: {} })
+      );
+
+      assert.strictEqual(response.status, 204);
+      assert.strictEqual(response.headers['Access-Control-Allow-Origin'], '*');
+      assert.ok(response.headers['Access-Control-Allow-Headers'].includes('X-API-Key'));
+      assert.strictEqual(response.body, null);
+    });
+  });
+
+  describe('Integridade da Migration DDL e Políticas RLS (20260908130000)', () => {
+    it('deve verificar a existência e consistência do arquivo SQL de migration', () => {
+      const migrationPath = resolve(
+        process.cwd(),
+        'supabase/migrations/20260908130000_api_clients_and_webhooks_schema.sql'
+      );
+
+      assert.strictEqual(existsSync(migrationPath), true, 'O arquivo de migration DDL deve existir.');
+      const sql = readFileSync(migrationPath, 'utf8');
+
+      // Tabelas
+      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.api_clients'), 'Deve criar api_clients');
+      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.webhooks_subscriptions'), 'Deve criar webhooks_subscriptions');
+
+      // Colunas em tabelas existentes
+      assert.ok(sql.includes('ALTER TABLE public.users'), 'Deve alterar users para adicionar origin_client_id');
+      assert.ok(sql.includes('ALTER TABLE public.job_posts'), 'Deve alterar job_posts para adicionar origin_client_id');
+
+      // Constraints
+      assert.ok(sql.includes('check_api_clients_key_hash_len'), 'Deve validar 64 caracteres do hash');
+      assert.ok(sql.includes('check_webhook_event_type'), 'Deve validar os 4 eventos canônicos de webhook');
+      assert.ok(sql.includes('check_api_clients_rate_limit_positive'), 'Deve validar rate_limit > 0');
+
+      // RLS (NFR-5)
+      assert.ok(sql.includes('ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY'), 'RLS ativo em api_clients');
+      assert.ok(sql.includes('ALTER TABLE public.webhooks_subscriptions ENABLE ROW LEVEL SECURITY'), 'RLS ativo em webhooks_subscriptions');
+      assert.ok(sql.includes('api_clients_service_role_all'), 'Policy para service_role em api_clients');
+      assert.ok(sql.includes('webhooks_subscriptions_service_role_all'), 'Policy para service_role em webhooks_subscriptions');
+
+      // Função utilitária de banco
+      assert.ok(sql.includes('FUNCTION public.validate_api_client_access'), 'Função de validação de gateway no banco');
+    });
+  });
+});


Do not invoke any skill. Return only the review result.
