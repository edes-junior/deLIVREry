# Epic 1 Context: Onboarding Universal, Identidade e Ativação Regional

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Permitir que entregadores e lojistas de qualquer município do Brasil autentiquem-se sem senhas via Magic Link, cadastrem e validem seus perfis com dados de contato e modais de transporte, selecionem sua localização geográfica precisa, acompanhem o termômetro de quórum de ativação do seu bairro e acelerem o desbloqueio operacional compartilhando links de indicação viral.

## Stories

- Story 1.1: Inicialização do Monorepo e Schema de Identidade & Geografia com RLS
- Story 1.2: Autenticação Passwordless via Magic Link com Sessão Persistente
- Story 1.3: Cadastro e Perfil Universal com Validação Rigorosa de CPF e Geografia Brasileira
- Story 1.4: Termômetro de Desbloqueio Regional e Mecânica de Indicação Viral

## Requirements & Constraints

- Autenticação passwordless via Magic Link (Supabase Auth) com persistência de sessão em LocalStorage/IndexedDB (FR-1, NFR-1 < 2s).
- Validação rigorosa de documentos e integridade: algoritmo de validação de dígitos verificadores de CPF, formato de e-mail e telefone com DDD (FR-2).
- Estrutura geográfica universal: suporte à árvore hierárquica Estado (UF) -> Cidade (`city_id`) -> Bairro (`neighborhood_id`) sem amarras a municípios específicos (FR-2, AD-8).
- Regra de Quórum Hiperlocal: ativação operacional do bairro condicionada ao atingimento de 10 lojistas e 50 entregadores (`is_unlocked = true`) (FR-13, AD-8).
- Motor de Indicação Viral: geração determinística de `referral_code` único para cada perfil e atribuição de novas contas ao indicador (FR-15).
- Segurança e Isolamento: Row Level Security (RLS) habilitado em 100% das tabelas criadas, garantindo que usuários só acessem e alterem dados autorizados (AD-10).

## Technical Decisions

- **Arquitetura Monorepo**: Estrutura organizada em `apps/` (`pwa`, `landing-pages`, `developer-portal`), `supabase/` (`migrations`, `functions`) e `packages/` (`embed-widget`, `api-client-sdk`) (AD-1).
- **Persistência e Schemas PostgreSQL**:
  - `users`: ID (UUIDv4 compatível com `auth.users`), `cpf` (UK), `email` (UK), `phone_number`, `user_type` (`courier` ou `store`).
  - `courier_profiles`: `user_id` (PK, FK `users.id`), `transport_modal` (`motorcycle`, `bicycle`, `ebike_scooter`), `base_daily_rate`, `base_delivery_fee`, `xp_points`, `level`, `referral_code` (UK).
  - `store_profiles`: `user_id` (PK, FK `users.id`), `store_name`, `neighborhood_id`, `city_id`, `state_id`, `reputation_score` (default 5.00).
  - `region_unlocks`: `id` (UUIDv4), `state_id`, `city_id`, `neighborhood_id`, `couriers_count`, `stores_count`, `is_unlocked` (boolean, default false), `unlocked_at` (TIMESTAMPTZ).
- **Convenções**: `snake_case` para tabelas/colunas, UUIDv4 para identificadores (`gen_random_uuid()`), timestamps em UTC com `TIMESTAMPTZ`.
- **Stack Base**: Supabase (PostgreSQL 15+ com RLS), React 18+ com Vite e TypeScript no cliente PWA.

## UX & Interaction Patterns

- Fluxo de Onboarding simplificado com feedback imediato de envio de e-mail.
- Validação client-side e server-side de CPF com máscara amigável.
- Seleção geográfica em cascata reativa (UF -> Cidade -> Bairro).
- Barra de progresso visual de quórum no PWA e Landing Pages com contadores em tempo real.
- Ação de cópia do link de indicação em 1 clique com toast feedback e Web Share API quando suportado.

## Cross-Story Dependencies

- **Story 1.1** é a fundação obrigatória de monorepo e schemas para todo o projeto.
- **Story 1.2** depende da estrutura de app e configuração do Supabase client da Story 1.1.
- **Story 1.3** depende da sessão autenticada da Story 1.2 e dos schemas de perfis da Story 1.1.
- **Story 1.4** depende dos perfis cadastrados da Story 1.3 e da tabela `region_unlocks` da Story 1.1.

## Review Findings

### Patches
- [x] [Review][Patch] Normalizar ID de bairro customizado via `GeographyService.slugify` em vez de texto cru [`apps/pwa/src/components/profile/ProfileCompletionForm.tsx:151`]
- [x] [Review][Patch] Preservar `referral_code` pré-existente ao re-salvar perfil de entregador [`apps/pwa/src/profile/profile-service.ts:145`]

### Deferred
- [x] [Review][Defer] Triggers de Quórum `sync_region_unlock_quorum` limitados a `AFTER INSERT` [`supabase/migrations/20260904160000_update_courier_profiles_geography.sql:98-109`] — deferred, pre-existing

