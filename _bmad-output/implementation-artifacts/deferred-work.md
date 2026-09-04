# Deferred Work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-inicializacao-monorepo-schema-identidade-geografia.md`
  summary: Implementação de trigger/função no banco para transição automática de quórum (10 lojas e 50 entregadores) e atualização de unlocked_at em region_unlocks.
  evidence: Escopo formalmente atribuído à Story 1.4 (Termômetro de Desbloqueio Regional e Mecânica de Indicação Viral).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-inicializacao-monorepo-schema-identidade-geografia.md`
  summary: Configuração de ferramentas compartilhadas de build e linting entre workspaces (TypeScript/ESLint).
  evidence: Recomendado para implementação quando os workspaces de frontend (PWA e Landing Pages) tiverem suas dependências de UI instaladas nas Stories 1.2 e 1.3.

## Deferred from: code review of Epic 1 (2026-09-04)
- [Review][Defer] Triggers de Quórum `sync_region_unlock_quorum` limitados a `AFTER INSERT` [`supabase/migrations/20260904160000_update_courier_profiles_geography.sql:98-109`] — expandir suporte para UPDATE (troca de bairro) e DELETE (exclusão de conta) quando a gestão administrativa de perfis e transferência territorial for modelada.

