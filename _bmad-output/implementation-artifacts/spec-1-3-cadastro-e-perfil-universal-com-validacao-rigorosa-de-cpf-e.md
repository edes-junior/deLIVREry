---
title: 'Story 1.3: Cadastro e Perfil Universal com Validação Rigorosa de CPF e Geografia Brasileira'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: '8752338ca3a1ece752cc7c7cb6a1b5a2c5023ee7'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Usuários recém-autenticados via Magic Link possuem apenas e-mail registrado sem papel definido (`user_type`), dados civis ou vinculação geográfica, impedindo o matching operacional e o cálculo de quórum regional.

**Approach:** Implementar o fluxo universal de complementação cadastral no PWA com validação estrita de CPF (módulo 11), telefone com DDD, árvore geográfica dinâmica brasileira (UF/Cidade/Bairro), geração de referral code para entregadores, reputação 5.00 para lojistas e persistência com RLS.

## Boundaries & Constraints

**Always:**
- Validação matemática de CPF via algoritmo oficial dos dois dígitos verificadores (módulo 11), rejeitando números com 11 dígitos repetidos (ex: 111.111.111-11) e aplicando máscara amigável `000.000.000-00`.
- Interface e mensagens de erro estritamente em `PT-BR`.
- Garantir que `courier_profiles` e `store_profiles` estejam vinculados à hierarquia geográfica `(state_id, city_id, neighborhood_id)` e que toda tabela possua RLS ativo.
- Criação e atualização de perfil atômica respeitando a sessão autenticada do Supabase Auth.
- Geração automática de `referral_code` único em maiúsculas (ex: `LIVRE-XXXXXX`) para entregadores e reputação base de 5.00 para lojistas.

**Ask First:**
- Alterar campos obrigatórios do schema de identidade sem consulta prévia.
- Integração com serviços de API externos pagos de CEP/Geolocalização (restringir a dados locais resilientes ou API pública gratuita do IBGE).

**Never:**
- Permitir avanço do cadastro ou gravação no banco com CPF inválido ou duplicado.
- Expor dados de contato ou endereço sem sessão autenticada.
- Utilizar senhas ou mecanismos legados de autenticação no onboarding.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cadastro Entregador Válido | CPF válido, telefone DDD, modal 'motorcycle', diária R$ 120, taxa R$ 8, UF/Cidade/Bairro | `users` atualizado (`courier`), `courier_profiles` criado com `referral_code` único e nível 'Bronze' | N/A |
| Cadastro Lojista Válido | CPF válido, telefone DDD, nome da loja, endereço, UF/Cidade/Bairro | `users` atualizado (`store`), `store_profiles` criado com `reputation_score = 5.00` | N/A |
| CPF com Dígitos Verificadores Inválidos | `123.456.789-00` | Bloqueio imediato no client e rejeição no backend; exibe "CPF inválido. Verifique os números digitados." | Formulário exibe erro inline e impede submissão |
| CPF com Dígitos Iguais | `111.111.111-11` | Bloqueio imediato; exibe "CPF inválido." | Formulário exibe erro inline e impede submissão |
| Telefone Celular sem DDD ou Inválido | `9999-9999` ou DDD inválido | Rejeição no client; exibe "Telefone deve conter DDD e 9 dígitos (ex: (11) 98765-4321)" | Erro inline no campo telefone |
| Seleção Geográfica em Cascata | Usuário seleciona UF 'SP' | Campo de cidades preenche municípios de SP; ao selecionar cidade, carrega bairros correspondentes | Fallback gracioso com campo livre se bairro não listado |
| Tentativa de Cadastro sem Autenticação | Usuário anônimo acessa formulário | Redirecionamento para a tela de autenticação Magic Link | Redireciona para `/auth` |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260904160000_update_courier_profiles_geography.sql` -- Adiciona colunas geográficas (`state_id`, `city_id`, `home_neighborhood_id`), `referred_by_id` e trigger de quórum regional para `courier_profiles`.
- `apps/pwa/src/profile/cpf-validator.ts` -- Algoritmo canônico de validação módulo 11 de CPF, formatação/máscara de CPF e validação/formatação de telefone celular com DDD.
- `apps/pwa/src/geography/geography-service.ts` -- Provedor da árvore geográfica brasileira (UFs, municípios e bairros) com dados offline resilientes e suporte dinâmico.
- `apps/pwa/src/profile/profile-service.ts` -- Camada de serviço desacoplada para persistência de perfis de entregadores e lojistas no Supabase, geração de referral code e consulta de perfil.
- `apps/pwa/src/components/profile/ProfileCompletionForm.tsx` -- Componente React mobile-first para preenchimento de perfil com alternância entre Entregador e Lojista, máscaras dinâmicas e validação reativa.
- `apps/pwa/src/App.tsx` -- Atualização do fluxo principal para rotear usuários autenticados sem perfil para `ProfileCompletionForm`.
- `tests/profile-validation.test.js` -- Suíte de testes automatizados cobrindo cálculo módulo 11 do CPF, máscaras, geografia e regras de negócio de perfil.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260904160000_update_courier_profiles_geography.sql` -- Criar migration adicionando geografia em `courier_profiles` e trigger de atualização de quórum em `region_unlocks` -- Alinhar banco ao AD-8 e Addendum.
- [x] `apps/pwa/src/profile/cpf-validator.ts` -- Implementar validação módulo 11 de CPF, máscaras e validação de telefone -- Garantir integridade de FR-2 sem dependências pesadas.
- [x] `apps/pwa/src/geography/geography-service.ts` -- Implementar serviço de geografia brasileira com lista dos 27 estados e cidades/bairros com busca resiliente -- Viabilizar cascata UF -> Cidade -> Bairro.
- [x] `apps/pwa/src/profile/profile-service.ts` -- Implementar funções `completeCourierProfile`, `completeStoreProfile` e gerador determinístico de `referral_code` -- Persistir dados nas tabelas com RLS.
- [x] `apps/pwa/src/components/profile/ProfileCompletionForm.tsx` -- Criar formulário mobile-first de complementação cadastral com acessibilidade (alvos >= 48px) -- Entregar UX fluida e validada em PT-BR.
- [x] `apps/pwa/src/App.tsx` -- Integrar checagem de perfil ao estado de autenticação, exibindo o formulário quando o usuário ainda não tiver completado o cadastro -- Conectar Magic Link à ativação do perfil.
- [x] `tests/profile-validation.test.js` -- Criar suíte completa de testes unitários para validação de CPF, máscaras, geografia e regras de perfil -- Assegurar regressão zero e cobertura dos critérios de aceite.

**Acceptance Criteria:**
- Given um usuário autenticado no formulário de complementação cadastral, when ele submeter um CPF com dígitos verificadores matematicamente inválidos ou repetidos, then o sistema deve bloquear o envio e exibir mensagem clara em PT-BR.
- Given a seleção de localização geográfica, when o usuário seleciona um Estado (UF), then o seletor de Cidades deve listar os municípios correspondentes, e ao selecionar a Cidade, o seletor de Bairros deve disponibilizar os bairros daquela localidade.
- Given um entregador completando o cadastro, when ele seleciona seu modal (`motorcycle`, `bicycle`, `ebike_scooter`), define taxas base e informa sua localidade, then o registro é salvo em `courier_profiles` com `referral_code` único e nível 'Bronze'.
- Given um lojista completando o cadastro, when ele preenche o nome fantasia da loja, endereço e localização, then o registro é salvo em `store_profiles` com `reputation_score = 5.00`.

## Design Notes

- **Algoritmo Módulo 11 de CPF**: Multiplicação dos 9 primeiros dígitos por pesos decrescentes de 10 a 2. O resto da divisão por 11 determina o primeiro dígito verificador (se resto < 2, DV = 0; senão 11 - resto). O segundo DV usa os 10 primeiros dígitos com pesos de 11 a 2. Bloqueio prévio de sequências repetidas (`00000000000`, `11111111111`, etc.).
- **Geração de `referral_code`**: Padrão `LIVRE-` seguido por 6 caracteres alfanuméricos randômicos (ex: `LIVRE-K9X2P4`), garantindo unicidade e fácil compartilhamento via WhatsApp e redes sociais.
- **Cascata Geográfica**: Estados brasileiros canônicos (26 estados + DF) pré-indexados com siglas oficiais. Provedor resiliente com suporte offline imediato.

## Verification

**Commands:**
- `npm test` -- expected: Suíte de testes de validação de CPF, geografia e perfis executada com 100% de sucesso via Node.js test runner.
- `git status` -- expected: Arquivos criados e alterados rastreados na branch `feat/story-1-3-cadastro-perfil`.

## Suggested Review Order

**Validação Civil e Algoritmo Módulo 11**

- Algoritmo oficial de dígitos verificadores de CPF e validação de celulares com DDD
  [`cpf-validator.ts:43`](../../apps/pwa/src/profile/cpf-validator.ts#L43)

**Árvore Geográfica Nacional (AD-8)**

- Provedor universal das 27 UFs, municípios e bairros com resiliência offline
  [`geography-service.ts:170`](../../apps/pwa/src/geography/geography-service.ts#L170)

**Camada de Negócio e Persistência**

- Serviços de cadastro de entregadores/lojistas com retry anti-colisão de indicação
  [`profile-service.ts:78`](../../apps/pwa/src/profile/profile-service.ts#L78)

**Interface e UX Mobile-First**

- Formulário de complementação cadastral responsivo com alvos >= 48px
  [`ProfileCompletionForm.tsx:16`](../../apps/pwa/src/components/profile/ProfileCompletionForm.tsx#L16)

- Roteamento reativo que conecta Magic Link à ativação do perfil
  [`App.tsx:12`](../../apps/pwa/src/App.tsx#L12)

**Schema de Banco e Quórum Hiperlocal**

- Migration de colunas geográficas em courier_profiles e trigger de ativação
  [`20260904160000_update_courier_profiles_geography.sql:1`](../../supabase/migrations/20260904160000_update_courier_profiles_geography.sql#L1)

**Garantia de Qualidade e Casos de Borda**

- Suíte automatizada de testes cobrindo toda a matriz I/O & Edge-Case
  [`profile-validation.test.js:1`](../../tests/profile-validation.test.js#L1)

