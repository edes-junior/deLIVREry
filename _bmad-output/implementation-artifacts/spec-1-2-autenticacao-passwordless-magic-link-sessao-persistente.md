---
title: 'Story 1.2: Autenticação Passwordless via Magic Link com Sessão Persistente'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'fddaafd3d8383b9693e1424b783b5c9b084868be'
review_loop_iteration: 0
context:
  - '_bmad-output/planning-artifacts/architecture/architecture-deLIVREry-2026-08-21/ARCHITECTURE-SPINE.md'
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/implementation-artifacts/spec-1-1-inicializacao-monorepo-schema-identidade-geografia.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Entregadores e lojistas precisam de um método de autenticação seguro, rápido e sem senhas no PWA, garantindo que o token JWT permaneça persistido após fechar o navegador e direcionando novos usuários automaticamente para complementação de perfil.

**Approach:** Implementar o serviço de autenticação com Supabase Auth no PWA (`apps/pwa`), configurando o disparo de Magic Link via OTP, persistência de sessão em LocalStorage, listener de ciclo de vida de autenticação e redirecionamento condicional baseado na existência de perfil em `public.users`.

## Boundaries & Constraints

**Always:**
- Utilizar exclusivamente Supabase Auth GoTrue para emissão e validação de Magic Links sem senhas (AD-7).
- Persistir os tokens JWT com chave persistente no LocalStorage do navegador, restaurando a sessão automaticamente no carregamento da aplicação (FR-1).
- Validar formato sintático de e-mail antes do disparo da requisição e exibir feedback amigável em PT-BR em tempo de resposta inferior a 2 segundos (NFR-1).
- Criar trigger de sincronização segura no banco de dados (`on_auth_user_created`) disparado na inserção em `auth.users`.

**Ask First:**
- Inclusão de provedores de login social (OAuth com Google/Apple) fora do escopo estrito de Magic Link por e-mail da v1.
- Alteração da chave de armazenamento local de tokens de sessão.

**Never:**
- Não exigir senhas alfanuméricas de nenhum usuário final.
- Não persistir tokens JWT em cookies não seguros ou variáveis voláteis de memória que se percam ao recarregar a página.
- Não permitir acesso às rotas autenticadas do dashboard sem verificação de sessão válida e confirmação de perfil completo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| :--- | :--- | :--- | :--- |
| Envio de Magic Link com e-mail válido | E-mail `motoboy@exemplo.com.br` submetido no formulário | Disparo via `supabase.auth.signInWithOtp` e exibição de mensagem de confirmação em PT-BR | Exibe toast/alerta de erro caso o provedor de e-mail falhe |
| Envio com e-mail em formato inválido | String `email_invalido@` submetida | Bloqueio client-side imediato com mensagem "Informe um e-mail válido" | Validação instantânea sem disparar requisição ao servidor |
| Abertura de link de Magic Link válido | Callback URL com hash de tokens recebida pelo PWA | Sessão estabelecida, JWT gravado no LocalStorage e redirecionamento avaliado | Exibe tela de erro amigável se o link estiver expirado ou inválido |
| Sessão iniciada para usuário sem perfil | Usuário autenticado sem registro em `courier_profiles` ou `store_profiles` | Redirecionamento automático para `/completar-cadastro` | Bloqueia acesso ao dashboard operacional até completar |
| Recarregamento do navegador com sessão ativa | Página recarregada com JWT válido em LocalStorage | Sessão restaurada transparentemente sem exigir novo envio de e-mail | Se token expirado e refresh falhar, limpa sessão e envia para login |

</frozen-after-approval>

## Code Map

- `apps/pwa/package.json` -- Adição de dependências do Supabase client (`@supabase/supabase-js`) e utilitários.
- `apps/pwa/src/lib/supabase.ts` -- Inicialização singleton do cliente Supabase configurado com persistência em LocalStorage.
- `apps/pwa/src/auth/auth-service.ts` -- Funções de negócio de autenticação: envio de Magic Link, obtenção de sessão, logout e checagem de perfil.
- `apps/pwa/src/auth/use-auth.ts` -- Hook React de estado de autenticação reativo (`user`, `session`, `loading`, `needsProfileCompletion`).
- `apps/pwa/src/components/auth/MagicLinkForm.tsx` -- Componente visual acessível e responsivo para solicitação de Magic Link com feedback em PT-BR.
- `apps/pwa/src/components/auth/AuthCallback.tsx` -- Handler do retorno do Magic Link com captura de sessão e redirecionamento inteligente.
- `supabase/migrations/20260904150000_auth_user_sync_trigger.sql` -- Trigger SQL que sincroniza `auth.users` com `public.users` garantindo integridade de foreign keys.
- `tests/auth-service.test.js` -- Testes automatizados unitários de validação de e-mail, sessão persistente e roteamento condicional.

## Tasks & Acceptance

**Execution:**
- [x] `apps/pwa/package.json` -- Configurar dependência do `@supabase/supabase-js` e scripts do app PWA -- Permitir consumo da API de autenticação.
- [x] `apps/pwa/src/lib/supabase.ts` -- Criar singleton do cliente Supabase com persistência de sessão -- Centralizar configuração e chaves de ambiente.
- [x] `supabase/migrations/20260904150000_auth_user_sync_trigger.sql` -- Criar função e trigger PostgreSQL para sincronizar `auth.users` com `public.users` -- Garantir consistência imediata entre autenticação e perfil civil.
- [x] `apps/pwa/src/auth/auth-service.ts` -- Implementar serviço de envio de Magic Link, captura de sessão e verificação de perfil -- Encapsular regras de autenticação.
- [x] `apps/pwa/src/auth/use-auth.ts` -- Implementar hook de estado de autenticação reativo -- Fornecer contexto reativo de usuário para a aplicação.
- [x] `apps/pwa/src/components/auth/MagicLinkForm.tsx` -- Criar componente de formulário Magic Link com validação e UX otimizada -- Prover interface de login/cadastro simples em PT-BR.
- [x] `apps/pwa/src/components/auth/AuthCallback.tsx` -- Criar componente de callback para processar tokens do Magic Link e roteamento -- Tratar redirecionamento automático.
- [x] `tests/auth-service.test.js` -- Implementar suíte de testes automatizados cobrindo os cenários da matriz de I/O -- Garantir regressão determinística da camada de autenticação.

**Acceptance Criteria:**
- Given um endereço de e-mail no formulário do PWA, when submetido e validado sintaticamente, then a função `signInWithOtp` é disparada com `emailRedirectTo` configurado e uma mensagem de confirmação em PT-BR é exibida.
- Given o retorno de autenticação bem-sucedido com tokens JWT, when processado pelo PWA, then os tokens são persistidos no LocalStorage e a sessão é mantida mesmo após recarregar a página.
- Given um usuário autenticado cujo registro não possui perfil completo em `courier_profiles` ou `store_profiles`, when a sessão é verificada, then o status `needsProfileCompletion = true` é retornado para acionar o redirecionamento.
- Given o teste `tests/auth-service.test.js`, when executado via `npm test`, then todos os testes passam com 100% de sucesso.

## Spec Change Log

## Design Notes

- O Supabase Auth opera com tokens JWT armazenados por padrão sob a chave `sb-<project-ref>-auth-token` no LocalStorage.
- A trigger `on_auth_user_created` utiliza `SECURITY DEFINER` para permitir inserção atômica em `public.users` com `email` e `id` derivados de `new.id` e `new.email`.
- Caso o usuário não tenha `cpf` ou `user_type` preenchidos em `public.users`, a regra de negócio do PWA determina que o cadastro está incompleto e força o redirecionamento para o formulário da Story 1.3.

## Verification

**Commands:**
- `npm test` -- expected: Todos os testes de validação de schema e serviço de autenticação passam com sucesso.
- `git status` -- expected: Árvore limpa na branch `feat/story-1-2-magic-link-auth`.

**Manual checks (if no CLI):**
- Inspecionar a interface do componente `MagicLinkForm` para confirmar clareza das mensagens em PT-BR e acessibilidade de campos.

## Suggested Review Order

**Autenticação no PWA (Client-Side)**

- Inicialização singleton do Supabase com persistência de tokens
  [`supabase.ts:24`](../../apps/pwa/src/lib/supabase.ts#L24)

- Serviço de envio de Magic Link e validação de e-mail
  [`auth-service.ts:35`](../../apps/pwa/src/auth/auth-service.ts#L35)

- Hook React reativo useAuth para controle de sessão e perfil
  [`use-auth.ts:20`](../../apps/pwa/src/auth/use-auth.ts#L20)

- Formulário acessível MagicLinkForm com feedback em tempo real
  [`MagicLinkForm.tsx:15`](../../apps/pwa/src/components/auth/MagicLinkForm.tsx#L15)

- Processador de callback e roteamento inteligente para novos usuários
  [`AuthCallback.tsx:10`](../../apps/pwa/src/components/auth/AuthCallback.tsx#L10)

**Sincronização no Banco de Dados (Supabase)**

- Trigger PostgreSQL para sincronização automática de auth.users com public.users
  [`20260904150000_auth_user_sync_trigger.sql:22`](../../supabase/migrations/20260904150000_auth_user_sync_trigger.sql#L22)

**Verificação Automatizada**

- Testes unitários cobrindo todos os cenários da matriz de I/O
  [`auth-service.test.js:15`](../../tests/auth-service.test.js#L15)

