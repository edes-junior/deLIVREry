---
title: 'Story 1.1: Inicialização do Monorepo e Schema de Identidade & Geografia com RLS'
type: 'feature'
created: '2026-09-04'
status: 'ready-for-dev'
review_loop_iteration: 0
context:
  - '_bmad-output/planning-artifacts/architecture/architecture-deLIVREry-2026-08-21/ARCHITECTURE-SPINE.md'
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O repositório está sem a estrutura de monorepo e sem as migrações SQL do Supabase necessárias para sustentar as entidades de identidade, perfis e quórum regional com segurança granular.

**Approach:** Inicializar a fundação do monorepo com workspaces npm (`apps/`, `packages/`, `supabase/`) e implementar a migration SQL do PostgreSQL contendo as tabelas `users`, `courier_profiles`, `store_profiles` e `region_unlocks` com Row Level Security (RLS) e restrições de integridade.

## Boundaries & Constraints

**Always:**
- Utilizar `snake_case` para entidades do PostgreSQL, UUIDv4 para identificadores e `TIMESTAMPTZ` para registros de data/hora.
- Habilitar `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` em 100% das tabelas criadas com políticas de isolamento de leitura e escrita.
- Aplicar constraints de unicidade (`cpf` único, `email` único, `referral_code` único) e validações de enum/check (`user_type IN ('courier', 'store')`, `transport_modal IN ('motorcycle', 'bicycle', 'ebike_scooter')`).
- Estruturar workspaces com padrão nativo npm (`workspaces: ["apps/*", "packages/*"]`) compatível com Node.js 24.x.

**Ask First:**
- Adição de ferramentas externas complexas de orquestração de monorepo (Nx, Lerna, Turborepo) caso o npm workspace atenda aos requisitos da v1.
- Alteração dos critérios de quórum regional (padrão 10 lojas e 50 entregadores).

**Never:**
- Não implementar interfaces de usuário completas, telas de autenticação ou APIs REST nesta história (escopos das Stories 1.2 a 1.4 e Épicos posteriores).
- Não desativar ou omitir RLS em nenhuma tabela do schema de dados.
- Não permitir escrita ou leitura irrestrita de dados privados de perfis entre diferentes usuários.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| :--- | :--- | :--- | :--- |
| Inserção de usuário com CPF duplicado | `INSERT INTO users (cpf, ...)` com CPF já existente na base | Rejeição da transação pelo PostgreSQL | Violação da restrição de unicidade `users_cpf_key` |
| Inserção de modal de transporte inválido | `INSERT INTO courier_profiles (transport_modal, ...)` com `'car'` | Rejeição pelo CHECK constraint `check_transport_modal` | Erro de violação de check constraint (SQLSTATE 23514) |
| Acesso a perfil de outro usuário via RLS | Usuário autenticado com ID `A` tenta `SELECT * FROM courier_profiles WHERE user_id = 'B'` | Retorno de zero registros | Bloqueio transparente imposto pela política RLS |
| Consulta de status de quórum por bairro | `SELECT * FROM region_unlocks WHERE state_id = 'SP' AND city_id = 'sao_paulo' AND neighborhood_id = 'pinheiros'` | Retorna contadores (`couriers_count`, `stores_count`) e flag `is_unlocked` | Registro retornado com dados da região consultada |

</frozen-after-approval>

## Code Map

- `package.json` -- Configuração raiz do monorepo com workspaces (`apps/*`, `packages/*`) e scripts de build/test.
- `.gitignore` -- Exclusão de node_modules, artefatos de build, arquivos temporários e variáveis `.env*`.
- `apps/pwa/package.json` -- Scaffold base do cliente PWA oficial (React + Vite + TypeScript).
- `apps/landing-pages/package.json` -- Scaffold base das Landing Pages universais (React + Vite + TypeScript).
- `apps/developer-portal/package.json` -- Scaffold base do Portal do Desenvolvedor (Swagger UI).
- `packages/embed-widget/package.json` -- Scaffold base do Web Component nativo `<delivrery-button />`.
- `packages/api-client-sdk/package.json` -- Scaffold base do SDK de cliente de API REST.
- `supabase/config.toml` -- Arquivo de configuração padrão do projeto Supabase.
- `supabase/migrations/20260904143000_init_identity_geography_schema.sql` -- Migration DDL completa com tabelas `users`, `courier_profiles`, `store_profiles`, `region_unlocks`, índices e RLS.
- `tests/schema-validation.test.js` -- Script de validação sintática e semântica das constraints e DDL da migration.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json` -- Criar package.json raiz com workspaces npm e scripts de validação -- Estruturar monorepo conforme arquitetura.
- [ ] `.gitignore` -- Criar .gitignore unificado para o monorepo -- Evitar versionamento de arquivos efêmeros e segredos.
- [ ] `apps/pwa/package.json` -- Inicializar package.json do PWA -- Isolar dependências e scripts do app PWA.
- [ ] `apps/landing-pages/package.json` -- Inicializar package.json das Landing Pages -- Isolar dependências e scripts das landing pages.
- [ ] `apps/developer-portal/package.json` -- Inicializar package.json do Developer Portal -- Isolar dependências do portal.
- [ ] `packages/embed-widget/package.json` -- Inicializar package.json do embed-widget -- Isolar dependências do Web Component.
- [ ] `packages/api-client-sdk/package.json` -- Inicializar package.json do SDK -- Isolar dependências do SDK da API.
- [ ] `supabase/config.toml` -- Gerar configuração do Supabase -- Habilitar compatibilidade com Supabase CLI e ambiente local.
- [ ] `supabase/migrations/20260904143000_init_identity_geography_schema.sql` -- Implementar DDL completo de tabelas, constraints de unicidade/check, índices e políticas RLS -- Cumprir requisitos de dados e segurança do Epic 1.
- [ ] `tests/schema-validation.test.js` -- Criar teste automatizado para validação de schema e regras DDL -- Prover feedback imediato e regressão automatizada.

**Acceptance Criteria:**
- Given a raiz do projeto deLIVREry, when inspecionada a árvore de diretórios, then devem existir as pastas `apps/pwa`, `apps/landing-pages`, `apps/developer-portal`, `packages/embed-widget`, `packages/api-client-sdk` e `supabase/migrations`.
- Given a migration SQL `20260904143000_init_identity_geography_schema.sql`, when analisada estruturalmente, then as tabelas `users`, `courier_profiles`, `store_profiles` e `region_unlocks` contêm `ENABLE ROW LEVEL SECURITY`, `users` possui unicidade de `cpf` e `email`, `courier_profiles` possui constraint de `transport_modal` e `referral_code` único, e `region_unlocks` possui `is_unlocked` boolean com contadores de quórum.
- Given o script `tests/schema-validation.test.js`, when executado via `npm run test:schema`, then deve passar com 100% de sucesso validando a sintaxe e integridade das regras do banco.

## Spec Change Log

## Design Notes

- A tabela `users` espelha os identificadores autenticados do Supabase Auth (`id` UUIDv4 correspondente a `auth.users.id`).
- Relacionamento 1:1 entre `users` e `courier_profiles`/`store_profiles` com chave estrangeira em cascata (`ON DELETE CASCADE`).
- A tabela `region_unlocks` suporta a hierarquia geográfica universal `(state_id, city_id, neighborhood_id)` com constraint de unicidade composta, permitindo que a ativação orgânica ocorra automaticamente quando `stores_count >= 10` e `couriers_count >= 50`.
- As políticas de RLS garantem que o próprio usuário autenticado possa ler e atualizar seu próprio registro (`auth.uid() = id` ou `auth.uid() = user_id`), enquanto `region_unlocks` permite leitura pública para exibição do termômetro em landing pages e PWAs.

## Verification

**Commands:**
- `npm run test:schema` -- expected: Todos os testes de validação do schema DDL e estrutura do monorepo passam com sucesso.
- `git status` -- expected: Todos os arquivos da inicialização criados e limpos.

**Manual checks (if no CLI):**
- Inspecionar a sintaxe do arquivo de migration para garantir integridade com PostgreSQL 15+.
