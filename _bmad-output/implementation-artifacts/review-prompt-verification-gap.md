# Verification Gap Review

**Goal:** Find changed behavior that could break without reliable verification catching it. Ask one question — "if the behavior this change is supposed to produce broke where it's actually used, would verification fail?" Do not hunt for correctness bugs, but report genuine problems you notice while tracing verification.

The main verification gap shapes are:

1. **Regression gap:** the changed code regresses where it's used, and no test covering that use would fail.
2. **Missing-adoption gap:** a place that should now use the new behavior doesn't; it handles the same case its own way, or not at all, and no test would flag the omission.
3. **Broken-verification gap:** a test appears to cover the changed behavior, but would not actually protect it because it is skipped, flaky, not run in the normal verification path, or too weak to observe the regression.

## Evidence Rules

- Read a test before claiming what it covers, runs, asserts, or misses.
- Before claiming no test exists, search the whole repo by the symbol under test and by import references; expected file locations are not enough.
- Never assert what you did not verify. If a finding cannot be grounded, drop it.
- In a finding, say what you actually checked — "none of the tests I read cover this" — and show how far you looked. Say a test doesn't exist anywhere only when the symbol/import-reference search actually shows that.
- Do not assign severity, confidence, priority, or ranking.

## Review Sequence

### Step 1: Screen for behavioral change

Screen each part of the change separately. If a part is non-behavioral, skip it. Call a part non-behavioral only when the changed code does not alter return values, thrown errors, caller-visible side effects, or observable state (including iteration order and emitted messages). Once a part meets that test, move on; do not inspect callers or tests for extra confirmation.

Common non-behavioral examples: formatting, comments, whitespace; pure renames; trivial getters/setters and pass-throughs; type-only or compiler-enforced changes with no runtime effect; etc.

Only outcomes produced by deterministic code are worth automatically testing; tests are useless on static source text and brittle on LLM output. Skip those parts.

If every part is skipped, output the clean result (see Output Format).

### Step 2: Find the behavior that changed

Identify what behavior changed compared to the previous version: output, side effect, branch, error path, schema/event shape, config default, validation/authorization rule, external contract, etc. If the change affects more than one behavior, handle each separately.

Treat broad-impact changes as behavioral even when no single changed line looks important: dependency, toolchain, build/config, data-file, etc.

### Step 3: Trace where that behavior is used

Trace the changed behavior to the places that observe it. Start with direct callers and registered entry points (routes, commands, DI), contract consumers (schemas, events, APIs, database readers), and reverse-dependency info if already available.

Follow a path only while the changed behavior is reachable and unverified. Stop when a test at that boundary would fail, the consumer does not observe the changed behavior, or the next hop is guesswork (dynamic dispatch, reflection, outside-repo consumers, etc.). Prefer the nearest observable boundary, often one to three hops away, especially across contract, integration, or service edges. If there are more than five similar consumers, group obvious repeats and check representative paths; expand only when a consumer observes the behavior differently.

### Step 4: Qualify the consumer, then check its test

For each consumer, name the smallest realistic regression this consumer would observe: invert the branch, drop the default, omit the field, return the old error code, skip the integration call, etc. This is the Demonstration. If no such regression exists, drop the path; untested downstream code is not a finding.

A `Missing-adoption gap` qualifies not by the adoption failure alone but by a supersession signal: the change gives clear evidence the new behavior is meant to replace the local one — PR intent, naming or docs, a replaced sibling site, deleted duplicate logic, or a test defining the new rule — and the local site shares the same observable contract. Without a supersession signal and a shared observable contract, it is a refactor suggestion, not a verification-gap finding. Once both hold, check whether any test for that site would flag the non-adoption; missing coverage of the non-adoption is the gap itself, not a disqualifier.

Find and read the relevant test. Ask whether the Demonstration would make an assertion fail.

- If yes, the behavior is verified. No finding.
- For a regression-style Demonstration: if no test runs the path, the test is skipped/flaky/not run normally, or the test runs the code without checking the changed result, report a `Regression gap` or `Broken-verification gap`.
- For a qualifying Missing-adoption case: if none of the site tests you found assert it adopts the new behavior, report a `Missing-adoption gap`.

A test counts only if it runs normally and an assertion observes the changed output, branch, or contract. These do not count: no execution; source-text assertions that match a file's wording instead of running it; success/no-throw/snapshot-only checks; mock/log-call checks; human-only checks; tests that mock away the integration; e2e tests that pass through without checking the changed output; stale assertions or fixtures.

For example, `expect(x ?? DEFAULT).toBe(DEFAULT)` passes when `x` is missing.

Common patterns:

- **Caller-path gap** — helper test covers the branch, but caller values skip it.
- **Contract drift** — payload/schema/event changes must be verified at the consumer.
- **Migration compatibility** — tests only create new-format rows or fresh schemas.
- **Phantom exception** — handled partial-failure path has no test.
- **Missing-adoption gap** — sibling site should use the new rule/helper and does not.
- **Removed verification** — deleted test or weakened assertion leaves behavior unpinned; removing a source-text assertion is not this, since it never counted.

### Step 5: Confirm each finding is real

Before writing a finding, re-open the specific tests or search results the finding relies on. Verify the Demonstration would not make any test you checked fail, or that the absence claim is backed by the symbol/import-reference search. Do not claim more than you verified; drop any finding you cannot ground.

Explain why the test misses the bug using what the test sets up and checks.

Do not report: compiler/type-checker-enforced cases; behavior already verified by an integration, contract, or e2e test; implementation-detail or mock-only tests; low coverage or a missing test file by itself; legacy untested code the change did not affect.

Report genuine problems you noticed while tracing verification, even if they are not verification gaps. Put them under `Other findings` in the output. This permits reporting what you already reached, not extra hunting.

## OUTPUT FORMAT

Emit each verification-gap finding as one block. No general advice, no severity or confidence.

```markdown
### <one-line title naming the gap>

- **Changed surface:** the exact behavior or contract that changed — `file:line`.
- **Impacted consumer or site:** named concretely with `file:line` (e.g. "the `createInvoice` mutation used by the billing dashboard at `billing/dashboard.ts:88`," not "callers of this function").
- **Existing test evidence:**
  - `Regression gap`: what the relevant test actually asserts, with `file:line`; or, if none, the symbol/import-reference searches run and their result.
  - `Missing-adoption gap`: tests for the impacted site, and whether any assert it adopts the new behavior.
  - `Broken-verification gap`: the apparent test or verification path, and why it does not count.
- **Missing verification:** the precise assertion or check that's absent.
- **Demonstration:**
  - `Regression gap` / `Broken-verification gap`: the concrete regression that would ship undetected, and why the tests you checked would not fail.
  - `Missing-adoption gap`: the case the site mishandles by not adopting the new behavior, and that none of the tests you read assert adoption.
- **Consequence:** the concrete thing that ships wrong — a regression the checked evidence would not catch, or a site that should use the new behavior and doesn't.
- **Suggested test shape:** (optional) the kind of test that would close the gap, fit to the repo's own way of verifying — don't impose a generic test pyramid.
```

If you noticed genuine non-gap problems while tracing verification, append:

```markdown
## Other findings

- <description only; no severity, confidence, priority, or ranking>
```

When you find no verification gaps and no other findings, output exactly this single line, not an empty response:

`No verification gaps found.`

## CONTENT SOURCE

Review the content supplied under "Review content:" in the message that launched you. If none is supplied, stop with exactly: `No verification gaps found.`


Review content:

diff --git a/_bmad-output/implementation-artifacts/spec-1-1-inicializacao-monorepo-schema-identidade-geografia.md b/_bmad-output/implementation-artifacts/spec-1-1-inicializacao-monorepo-schema-identidade-geografia.md
index cd17367..c25d5a9 100644
--- a/_bmad-output/implementation-artifacts/spec-1-1-inicializacao-monorepo-schema-identidade-geografia.md
+++ b/_bmad-output/implementation-artifacts/spec-1-1-inicializacao-monorepo-schema-identidade-geografia.md
@@ -2,7 +2,8 @@
 title: 'Story 1.1: Inicialização do Monorepo e Schema de Identidade & Geografia com RLS'
 type: 'feature'
 created: '2026-09-04'
-status: 'ready-for-dev'
+status: 'in-review'
+baseline_commit: '4c12dc81d62884ec4edba5a9f69c17a553dbf780'
 review_loop_iteration: 0
 context:
   - '_bmad-output/planning-artifacts/architecture/architecture-deLIVREry-2026-08-21/ARCHITECTURE-SPINE.md'
@@ -61,16 +62,16 @@ context:
 ## Tasks & Acceptance
 
 **Execution:**
-- [ ] `package.json` -- Criar package.json raiz com workspaces npm e scripts de validação -- Estruturar monorepo conforme arquitetura.
-- [ ] `.gitignore` -- Criar .gitignore unificado para o monorepo -- Evitar versionamento de arquivos efêmeros e segredos.
-- [ ] `apps/pwa/package.json` -- Inicializar package.json do PWA -- Isolar dependências e scripts do app PWA.
-- [ ] `apps/landing-pages/package.json` -- Inicializar package.json das Landing Pages -- Isolar dependências e scripts das landing pages.
-- [ ] `apps/developer-portal/package.json` -- Inicializar package.json do Developer Portal -- Isolar dependências do portal.
-- [ ] `packages/embed-widget/package.json` -- Inicializar package.json do embed-widget -- Isolar dependências do Web Component.
-- [ ] `packages/api-client-sdk/package.json` -- Inicializar package.json do SDK -- Isolar dependências do SDK da API.
-- [ ] `supabase/config.toml` -- Gerar configuração do Supabase -- Habilitar compatibilidade com Supabase CLI e ambiente local.
-- [ ] `supabase/migrations/20260904143000_init_identity_geography_schema.sql` -- Implementar DDL completo de tabelas, constraints de unicidade/check, índices e políticas RLS -- Cumprir requisitos de dados e segurança do Epic 1.
-- [ ] `tests/schema-validation.test.js` -- Criar teste automatizado para validação de schema e regras DDL -- Prover feedback imediato e regressão automatizada.
+- [x] `package.json` -- Criar package.json raiz com workspaces npm e scripts de validação -- Estruturar monorepo conforme arquitetura.
+- [x] `.gitignore` -- Criar .gitignore unificado para o monorepo -- Evitar versionamento de arquivos efêmeros e segredos.
+- [x] `apps/pwa/package.json` -- Inicializar package.json do PWA -- Isolar dependências e scripts do app PWA.
+- [x] `apps/landing-pages/package.json` -- Inicializar package.json das Landing Pages -- Isolar dependências e scripts das landing pages.
+- [x] `apps/developer-portal/package.json` -- Inicializar package.json do Developer Portal -- Isolar dependências do portal.
+- [x] `packages/embed-widget/package.json` -- Inicializar package.json do embed-widget -- Isolar dependências do Web Component.
+- [x] `packages/api-client-sdk/package.json` -- Inicializar package.json do SDK -- Isolar dependências do SDK da API.
+- [x] `supabase/config.toml` -- Gerar configuração do Supabase -- Habilitar compatibilidade com Supabase CLI e ambiente local.
+- [x] `supabase/migrations/20260904143000_init_identity_geography_schema.sql` -- Implementar DDL completo de tabelas, constraints de unicidade/check, índices e políticas RLS -- Cumprir requisitos de dados e segurança do Epic 1.
+- [x] `tests/schema-validation.test.js` -- Criar teste automatizado para validação de schema e regras DDL -- Prover feedback imediato e regressão automatizada.
 
 **Acceptance Criteria:**
 - Given a raiz do projeto deLIVREry, when inspecionada a árvore de diretórios, then devem existir as pastas `apps/pwa`, `apps/landing-pages`, `apps/developer-portal`, `packages/embed-widget`, `packages/api-client-sdk` e `supabase/migrations`.
diff --git a/_bmad-output/implementation-artifacts/sprint-status.yaml b/_bmad-output/implementation-artifacts/sprint-status.yaml
index 3c7b527..4adbd16 100644
--- a/_bmad-output/implementation-artifacts/sprint-status.yaml
+++ b/_bmad-output/implementation-artifacts/sprint-status.yaml
@@ -29,14 +29,14 @@
 # - Dev moves story to 'review', then runs code-review (fresh context, different LLM recommended)
 # - Retrospective appends its action items to action_items; the status view surfaces open ones
 generated: 09-04-2026 14:24
-last_updated: 09-04-2026 14:24
+last_updated: 09-04-2026 14:35
 project: deLIVREry
 project_key: NOKEY
 tracking_system: file-system
 story_location: _bmad-output/implementation-artifacts
 development_status:
-  epic-1: backlog
-  1-1-inicialização-do-monorepo-e-schema-de-identidade-geografia-c: backlog
+  epic-1: in-progress
+  1-1-inicialização-do-monorepo-e-schema-de-identidade-geografia-c: in-progress
   1-2-autenticação-passwordless-via-magic-link-com-sessão-persiste: backlog
   1-3-cadastro-e-perfil-universal-com-validação-rigorosa-de-cpf-e: backlog
   1-4-termômetro-de-desbloqueio-regional-e-mecânica-de-indicação-v: backlog

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000..86aa399
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,56 @@
+# Dependencies
+node_modules/
+.pnp
+.pnp.js
+
+# Testing and Coverage
+coverage/
+
+# Production Builds
+dist/
+build/
+out/
+
+# Environment Variables and Secrets
+.env
+.env.local
+.env.development.local
+.env.test.local
+.env.production.local
+*.env
+!.env.example
+
+# Logs
+npm-debug.log*
+yarn-debug.log*
+yarn-error.log*
+pnpm-debug.log*
+lerna-debug.log*
+
+# Supabase Local Runtime
+.supabase/
+supabase/.branches/
+supabase/.temp/
+
+# OS Metadata
+.DS_Store
+Thumbs.db
+
+# Editor & IDE
+.vscode/*
+!.vscode/extensions.json
+!.vscode/settings.json
+.idea/
+*.suo
+*.ntvs*
+*.njsproj
+*.sln
+*.sw?
+
+# Python Cache (BMad tooling)
+__pycache__/
+*.py[cod]
+*$py.class
+.venv/
+env/
+venv/

diff --git a/package.json b/package.json
new file mode 100644
index 0000000..cc17457
--- /dev/null
+++ b/package.json
@@ -0,0 +1,24 @@
+{
+  "name": "delivrery-monorepo",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "description": "deLIVREry - Logística Livre e Descentralizada",
+  "workspaces": [
+    "apps/*",
+    "packages/*"
+  ],
+  "scripts": {
+    "test": "node --test tests/*.test.js",
+    "test:schema": "node tests/schema-validation.test.js"
+  },
+  "keywords": [
+    "delivery",
+    "logistica-livre",
+    "open-source",
+    "monorepo",
+    "supabase"
+  ],
+  "author": "deLIVREry Community",
+  "license": "MIT"
+}

diff --git a/apps/pwa/package.json b/apps/pwa/package.json
new file mode 100644
index 0000000..5a1ef77
--- /dev/null
+++ b/apps/pwa/package.json
@@ -0,0 +1,12 @@
+{
+  "name": "@delivrery/pwa",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "description": "PWA Oficial de Referência deLIVREry para Lojistas e Entregadores",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc && vite build",
+    "preview": "vite preview"
+  }
+}

diff --git a/apps/landing-pages/package.json b/apps/landing-pages/package.json
new file mode 100644
index 0000000..fb14527
--- /dev/null
+++ b/apps/landing-pages/package.json
@@ -0,0 +1,12 @@
+{
+  "name": "@delivrery/landing-pages",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "description": "Landing Pages Universais e Regionais deLIVREry",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc && vite build",
+    "preview": "vite preview"
+  }
+}

diff --git a/apps/developer-portal/package.json b/apps/developer-portal/package.json
new file mode 100644
index 0000000..2f6b90b
--- /dev/null
+++ b/apps/developer-portal/package.json
@@ -0,0 +1,12 @@
+{
+  "name": "@delivrery/developer-portal",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "description": "Portal do Desenvolvedor deLIVREry (/developers com Swagger UI)",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc && vite build",
+    "preview": "vite preview"
+  }
+}

diff --git a/packages/embed-widget/package.json b/packages/embed-widget/package.json
new file mode 100644
index 0000000..a70f82f
--- /dev/null
+++ b/packages/embed-widget/package.json
@@ -0,0 +1,10 @@
+{
+  "name": "@delivrery/embed-widget",
+  "version": "0.1.0",
+  "private": true,
+  "main": "src/delivrery-button.js",
+  "description": "Web Component nativo embutível <delivrery-button /> para cardápios e PDVs",
+  "scripts": {
+    "build": "node -e \"console.log('Embed widget scaffold ready')\""
+  }
+}

diff --git a/packages/api-client-sdk/package.json b/packages/api-client-sdk/package.json
new file mode 100644
index 0000000..fef8bf6
--- /dev/null
+++ b/packages/api-client-sdk/package.json
@@ -0,0 +1,12 @@
+{
+  "name": "@delivrery/api-client-sdk",
+  "version": "0.1.0",
+  "private": true,
+  "main": "dist/index.js",
+  "module": "dist/index.mjs",
+  "types": "dist/index.d.ts",
+  "description": "SDK cliente TypeScript/JavaScript para consumo da Headless API deLIVREry",
+  "scripts": {
+    "build": "node -e \"console.log('API Client SDK scaffold ready')\""
+  }
+}

diff --git a/supabase/config.toml b/supabase/config.toml
new file mode 100644
index 0000000..6b4e3a8
--- /dev/null
+++ b/supabase/config.toml
@@ -0,0 +1,35 @@
+# Supabase Local Configuration for deLIVREry
+project_id = "delivrery"
+
+[api]
+enabled = true
+port = 54321
+schemas = ["public", "storage", "graphql_public"]
+extra_search_path = ["public", "extensions"]
+max_rows = 1000
+
+[db]
+port = 54322
+shadow_port = 54320
+major_version = 15
+
+[studio]
+enabled = true
+port = 54323
+
+[auth]
+enabled = true
+site_url = "http://localhost:5173"
+additional_redirect_urls = ["https://localhost:5173"]
+jwt_expiry = 3600
+enable_signup = true
+
+[auth.email]
+enable_signup = true
+double_confirm_changes = true
+enable_confirmations = false
+secure_password_change = false
+
+[storage]
+enabled = true
+file_size_limit = "50MiB"

diff --git a/supabase/migrations/20260904143000_init_identity_geography_schema.sql b/supabase/migrations/20260904143000_init_identity_geography_schema.sql
new file mode 100644
index 0000000..95a69a6
--- /dev/null
+++ b/supabase/migrations/20260904143000_init_identity_geography_schema.sql
@@ -0,0 +1,219 @@
+-- ==============================================================================
+-- Migration: 20260904143000_init_identity_geography_schema.sql
+-- Description: Schema inicial de Identidade (users, courier_profiles, store_profiles)
+--              e Geografia/Quórum Regional (region_unlocks) com RLS ativado.
+-- Architecture: Hexagonal / Supabase PostgreSQL 15+
+-- ==============================================================================
+
+-- 1. Extensões Essenciais
+CREATE EXTENSION IF NOT EXISTS "pgcrypto";
+
+-- Função utilitária para atualização automática de updated_at
+CREATE OR REPLACE FUNCTION public.handle_updated_at()
+RETURNS TRIGGER AS $$
+BEGIN
+    NEW.updated_at = timezone('utc'::text, now());
+    RETURN NEW;
+END;
+$$ LANGUAGE plpgsql;
+
+-- ==============================================================================
+-- 2. Tabela: users (Identidade Civil e Autenticação)
+-- ==============================================================================
+CREATE TABLE IF NOT EXISTS public.users (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    cpf VARCHAR(14) NOT NULL,
+    email VARCHAR(255) NOT NULL,
+    phone_number VARCHAR(20) NOT NULL,
+    user_type VARCHAR(20) NOT NULL,
+    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
+    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
+
+    CONSTRAINT users_cpf_key UNIQUE (cpf),
+    CONSTRAINT users_email_key UNIQUE (email),
+    CONSTRAINT check_user_type CHECK (user_type IN ('courier', 'store'))
+);
+
+CREATE INDEX IF NOT EXISTS idx_users_cpf ON public.users(cpf);
+CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
+CREATE INDEX IF NOT EXISTS idx_users_user_type ON public.users(user_type);
+
+DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
+CREATE TRIGGER trg_users_updated_at
+    BEFORE UPDATE ON public.users
+    FOR EACH ROW
+    EXECUTE FUNCTION public.handle_updated_at();
+
+-- ==============================================================================
+-- 3. Tabela: courier_profiles (Perfil de Entregador / Motoboy)
+-- ==============================================================================
+CREATE TABLE IF NOT EXISTS public.courier_profiles (
+    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
+    transport_modal VARCHAR(30) NOT NULL,
+    base_daily_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
+    base_delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
+    xp_points INTEGER NOT NULL DEFAULT 0,
+    level VARCHAR(20) NOT NULL DEFAULT 'Bronze',
+    referral_code VARCHAR(32) NOT NULL,
+    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
+    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
+
+    CONSTRAINT check_transport_modal CHECK (transport_modal IN ('motorcycle', 'bicycle', 'ebike_scooter')),
+    CONSTRAINT check_base_daily_rate CHECK (base_daily_rate >= 0),
+    CONSTRAINT check_base_delivery_fee CHECK (base_delivery_fee >= 0),
+    CONSTRAINT check_xp_points CHECK (xp_points >= 0),
+    CONSTRAINT check_courier_level CHECK (level IN ('Bronze', 'Prata', 'Ouro')),
+    CONSTRAINT courier_profiles_referral_code_key UNIQUE (referral_code)
+);
+
+CREATE INDEX IF NOT EXISTS idx_courier_profiles_referral_code ON public.courier_profiles(referral_code);
+CREATE INDEX IF NOT EXISTS idx_courier_profiles_transport_modal ON public.courier_profiles(transport_modal);
+
+DROP TRIGGER IF EXISTS trg_courier_profiles_updated_at ON public.courier_profiles;
+CREATE TRIGGER trg_courier_profiles_updated_at
+    BEFORE UPDATE ON public.courier_profiles
+    FOR EACH ROW
+    EXECUTE FUNCTION public.handle_updated_at();
+
+-- ==============================================================================
+-- 4. Tabela: store_profiles (Perfil do Lojista / Comerciante)
+-- ==============================================================================
+CREATE TABLE IF NOT EXISTS public.store_profiles (
+    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
+    store_name VARCHAR(150) NOT NULL,
+    state_id VARCHAR(2) NOT NULL,
+    city_id VARCHAR(100) NOT NULL,
+    neighborhood_id VARCHAR(100) NOT NULL,
+    address_street VARCHAR(255),
+    address_number VARCHAR(30),
+    latitude NUMERIC(10, 7),
+    longitude NUMERIC(10, 7),
+    reputation_score NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
+    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
+    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
+
+    CONSTRAINT check_reputation_score CHECK (reputation_score >= 0.00 AND reputation_score <= 5.00)
+);
+
+CREATE INDEX IF NOT EXISTS idx_store_profiles_geography ON public.store_profiles(state_id, city_id, neighborhood_id);
+
+DROP TRIGGER IF EXISTS trg_store_profiles_updated_at ON public.store_profiles;
+CREATE TRIGGER trg_store_profiles_updated_at
+    BEFORE UPDATE ON public.store_profiles
+    FOR EACH ROW
+    EXECUTE FUNCTION public.handle_updated_at();
+
+-- ==============================================================================
+-- 5. Tabela: region_unlocks (Controle de Quórum Hiperlocal e Ativação Territorial)
+-- ==============================================================================
+CREATE TABLE IF NOT EXISTS public.region_unlocks (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    state_id VARCHAR(2) NOT NULL,
+    city_id VARCHAR(100) NOT NULL,
+    neighborhood_id VARCHAR(100) NOT NULL,
+    couriers_count INTEGER NOT NULL DEFAULT 0,
+    stores_count INTEGER NOT NULL DEFAULT 0,
+    is_unlocked BOOLEAN NOT NULL DEFAULT false,
+    unlocked_at TIMESTAMPTZ,
+    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
+    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
+
+    CONSTRAINT uq_region_geography UNIQUE (state_id, city_id, neighborhood_id),
+    CONSTRAINT check_couriers_count CHECK (couriers_count >= 0),
+    CONSTRAINT check_stores_count CHECK (stores_count >= 0)
+);
+
+CREATE INDEX IF NOT EXISTS idx_region_unlocks_lookup ON public.region_unlocks(state_id, city_id, neighborhood_id);
+CREATE INDEX IF NOT EXISTS idx_region_unlocks_status ON public.region_unlocks(is_unlocked);
+
+DROP TRIGGER IF EXISTS trg_region_unlocks_updated_at ON public.region_unlocks;
+CREATE TRIGGER trg_region_unlocks_updated_at
+    BEFORE UPDATE ON public.region_unlocks
+    FOR EACH ROW
+    EXECUTE FUNCTION public.handle_updated_at();
+
+-- ==============================================================================
+-- 6. Row Level Security (RLS) - Isolamento e Governança de Dados
+-- ==============================================================================
+
+-- Habilitação obrigatória de RLS em todas as tabelas
+ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
+ALTER TABLE public.courier_profiles ENABLE ROW LEVEL SECURITY;
+ALTER TABLE public.store_profiles ENABLE ROW LEVEL SECURITY;
+ALTER TABLE public.region_unlocks ENABLE ROW LEVEL SECURITY;
+
+-- Políticas para: public.users
+DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
+CREATE POLICY "Users can read own profile"
+    ON public.users
+    FOR SELECT
+    USING (auth.uid() = id);
+
+DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
+CREATE POLICY "Users can insert own profile"
+    ON public.users
+    FOR INSERT
+    WITH CHECK (auth.uid() = id);
+
+DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
+CREATE POLICY "Users can update own profile"
+    ON public.users
+    FOR UPDATE
+    USING (auth.uid() = id)
+    WITH CHECK (auth.uid() = id);
+
+-- Políticas para: public.courier_profiles
+DROP POLICY IF EXISTS "Couriers can read own profile" ON public.courier_profiles;
+CREATE POLICY "Couriers can read own profile"
+    ON public.courier_profiles
+    FOR SELECT
+    USING (auth.uid() = user_id);
+
+DROP POLICY IF EXISTS "Couriers can insert own profile" ON public.courier_profiles;
+CREATE POLICY "Couriers can insert own profile"
+    ON public.courier_profiles
+    FOR INSERT
+    WITH CHECK (auth.uid() = user_id);
+
+DROP POLICY IF EXISTS "Couriers can update own profile" ON public.courier_profiles;
+CREATE POLICY "Couriers can update own profile"
+    ON public.courier_profiles
+    FOR UPDATE
+    USING (auth.uid() = user_id)
+    WITH CHECK (auth.uid() = user_id);
+
+-- Políticas para: public.store_profiles
+DROP POLICY IF EXISTS "Stores can read own profile" ON public.store_profiles;
+CREATE POLICY "Stores can read own profile"
+    ON public.store_profiles
+    FOR SELECT
+    USING (auth.uid() = user_id);
+
+DROP POLICY IF EXISTS "Stores can insert own profile" ON public.store_profiles;
+CREATE POLICY "Stores can insert own profile"
+    ON public.store_profiles
+    FOR INSERT
+    WITH CHECK (auth.uid() = user_id);
+
+DROP POLICY IF EXISTS "Stores can update own profile" ON public.store_profiles;
+CREATE POLICY "Stores can update own profile"
+    ON public.store_profiles
+    FOR UPDATE
+    USING (auth.uid() = user_id)
+    WITH CHECK (auth.uid() = user_id);
+
+-- Políticas para: public.region_unlocks
+-- Leitura pública para exibição universal do termômetro de quórum em PWA e Landing Pages
+DROP POLICY IF EXISTS "Public can view region unlocks quorum" ON public.region_unlocks;
+CREATE POLICY "Public can view region unlocks quorum"
+    ON public.region_unlocks
+    FOR SELECT
+    USING (true);
+
+-- Escrita e atualização restrita ao backend / service_role
+DROP POLICY IF EXISTS "Service role manages region unlocks" ON public.region_unlocks;
+CREATE POLICY "Service role manages region unlocks"
+    ON public.region_unlocks
+    FOR ALL
+    USING (auth.jwt()->>'role' = 'service_role' OR auth.role() = 'service_role')
+    WITH CHECK (auth.jwt()->>'role' = 'service_role' OR auth.role() = 'service_role');

diff --git a/tests/schema-validation.test.js b/tests/schema-validation.test.js
new file mode 100644
index 0000000..bdac0af
--- /dev/null
+++ b/tests/schema-validation.test.js
@@ -0,0 +1,119 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import fs from 'node:fs';
+import path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+const __filename = fileURLToPath(import.meta.url);
+const __dirname = path.dirname(__filename);
+const rootDir = path.resolve(__dirname, '..');
+
+test('Monorepo workspace and directories structure', (t) => {
+  const expectedDirs = [
+    'apps/pwa',
+    'apps/landing-pages',
+    'apps/developer-portal',
+    'packages/embed-widget',
+    'packages/api-client-sdk',
+    'supabase/migrations',
+  ];
+
+  for (const dir of expectedDirs) {
+    const fullPath = path.join(rootDir, dir);
+    assert.equal(fs.existsSync(fullPath), true, `Directory must exist: ${dir}`);
+  }
+
+  // Verify root package.json workspaces
+  const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
+  assert.ok(Array.isArray(rootPkg.workspaces), 'workspaces array must be defined in root package.json');
+  assert.ok(rootPkg.workspaces.includes('apps/*'), 'apps/* must be in workspaces');
+  assert.ok(rootPkg.workspaces.includes('packages/*'), 'packages/* must be in workspaces');
+});
+
+test('Supabase config.toml validation', (t) => {
+  const configPath = path.join(rootDir, 'supabase/config.toml');
+  assert.equal(fs.existsSync(configPath), true, 'supabase/config.toml must exist');
+  const configContent = fs.readFileSync(configPath, 'utf-8');
+  assert.match(configContent, /project_id\s*=\s*"delivrery"/, 'config must specify project_id delivrery');
+  assert.match(configContent, /\[api\]/, 'config must define [api] section');
+  assert.match(configContent, /\[db\]/, 'config must define [db] section');
+  assert.match(configContent, /\[auth\]/, 'config must define [auth] section');
+});
+
+test('Migration DDL file existence and basic integrity', (t) => {
+  const migrationPath = path.join(
+    rootDir,
+    'supabase/migrations/20260904143000_init_identity_geography_schema.sql'
+  );
+  assert.equal(fs.existsSync(migrationPath), true, 'Migration SQL file must exist');
+
+  const sql = fs.readFileSync(migrationPath, 'utf-8');
+  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.users/, 'Must create users table');
+  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.courier_profiles/, 'Must create courier_profiles table');
+  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.store_profiles/, 'Must create store_profiles table');
+  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.region_unlocks/, 'Must create region_unlocks table');
+});
+
+test('Matrix Scenario 1: Uniqueness constraints (CPF, Email, Referral Code)', (t) => {
+  const sql = fs.readFileSync(
+    path.join(rootDir, 'supabase/migrations/20260904143000_init_identity_geography_schema.sql'),
+    'utf-8'
+  );
+  // CPF uniqueness protects against duplicate CPF insertion
+  assert.match(sql, /CONSTRAINT\s+users_cpf_key\s+UNIQUE\s*\(\s*cpf\s*\)/, 'Must enforce UNIQUE constraint on users(cpf)');
+  assert.match(sql, /CONSTRAINT\s+users_email_key\s+UNIQUE\s*\(\s*email\s*\)/, 'Must enforce UNIQUE constraint on users(email)');
+  assert.match(sql, /CONSTRAINT\s+courier_profiles_referral_code_key\s+UNIQUE\s*\(\s*referral_code\s*\)/, 'Must enforce UNIQUE referral_code');
+});
+
+test('Matrix Scenario 2: CHECK constraints (transport_modal validation)', (t) => {
+  const sql = fs.readFileSync(
+    path.join(rootDir, 'supabase/migrations/20260904143000_init_identity_geography_schema.sql'),
+    'utf-8'
+  );
+  // transport_modal validation ensures only valid transport modes are accepted
+  assert.match(
+    sql,
+    /CONSTRAINT\s+check_transport_modal\s+CHECK\s*\(\s*transport_modal\s+IN\s*\('motorcycle',\s*'bicycle',\s*'ebike_scooter'\)\s*\)/,
+    'Must restrict transport_modal to motorcycle, bicycle, ebike_scooter'
+  );
+  assert.match(
+    sql,
+    /CONSTRAINT\s+check_user_type\s+CHECK\s*\(\s*user_type\s+IN\s*\('courier',\s*'store'\)\s*\)/,
+    'Must restrict user_type to courier, store'
+  );
+});
+
+test('Matrix Scenario 3: Row Level Security (RLS) and cross-user isolation', (t) => {
+  const sql = fs.readFileSync(
+    path.join(rootDir, 'supabase/migrations/20260904143000_init_identity_geography_schema.sql'),
+    'utf-8'
+  );
+  // All 4 tables must enable RLS
+  assert.match(sql, /ALTER\s+TABLE\s+public\.users\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/, 'users must have RLS enabled');
+  assert.match(sql, /ALTER\s+TABLE\s+public\.courier_profiles\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/, 'courier_profiles must have RLS enabled');
+  assert.match(sql, /ALTER\s+TABLE\s+public\.store_profiles\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/, 'store_profiles must have RLS enabled');
+  assert.match(sql, /ALTER\s+TABLE\s+public\.region_unlocks\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/, 'region_unlocks must have RLS enabled');
+
+  // Isolation policies using auth.uid()
+  assert.match(sql, /CREATE\s+POLICY\s+"Users can read own profile"[\s\S]*?USING\s*\(\s*auth\.uid\(\)\s*=\s*id\s*\)/, 'Users can only read own profile');
+  assert.match(sql, /CREATE\s+POLICY\s+"Couriers can read own profile"[\s\S]*?USING\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/, 'Couriers can only read own profile');
+  assert.match(sql, /CREATE\s+POLICY\s+"Stores can read own profile"[\s\S]*?USING\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/, 'Stores can only read own profile');
+});
+
+test('Matrix Scenario 4: Regional quorum and unlock query capability', (t) => {
+  const sql = fs.readFileSync(
+    path.join(rootDir, 'supabase/migrations/20260904143000_init_identity_geography_schema.sql'),
+    'utf-8'
+  );
+  // region_unlocks structure
+  assert.match(sql, /state_id\s+VARCHAR\(2\)\s+NOT\s+NULL/, 'region_unlocks must have state_id');
+  assert.match(sql, /city_id\s+VARCHAR\(100\)\s+NOT\s+NULL/, 'region_unlocks must have city_id');
+  assert.match(sql, /neighborhood_id\s+VARCHAR\(100\)\s+NOT\s+NULL/, 'region_unlocks must have neighborhood_id');
+  assert.match(sql, /couriers_count\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/, 'region_unlocks must track couriers_count');
+  assert.match(sql, /stores_count\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/, 'region_unlocks must track stores_count');
+  assert.match(sql, /is_unlocked\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+false/, 'region_unlocks must track is_unlocked flag');
+  assert.match(sql, /CONSTRAINT\s+uq_region_geography\s+UNIQUE\s*\(\s*state_id,\s*city_id,\s*neighborhood_id\s*\)/, 'Composite unique key on geography');
+
+  // Public policy for quorum thermometer
+  assert.match(sql, /CREATE\s+POLICY\s+"Public can view region unlocks quorum"[\s\S]*?USING\s*\(\s*true\s*\)/, 'Quorum status must be readable publicly');
+});


Do not invoke any skill. If the instruction file is unreadable, report that exact failure and stop. Return only the review result.