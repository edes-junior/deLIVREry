---
title: 'Story 3.3: Trava de Velocidade Tarifária no Perfil do Usuário (Anti-Manipulação)'
type: 'feature'
created: '2026-09-04'
status: 'review'
baseline_commit: '79043fe'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Em ecossistemas descentralizados sem intermediação central de preços, agentes mal-intencionados podem tentar manipular o balizador regional ou praticar dumping predatório ou cartelização através de oscilações abruptas e repetidas de tarifas base em seus perfis.

**Approach:** Implementar uma trava de velocidade tarifária (rate limit de preços) no banco de dados (trigger e constraint no PostgreSQL) e na camada de domínio (`ProfileService` / `PricingService`) que restringe qualquer alteração na diária ou taxa base a no máximo $\pm 30\%$ em uma janela móvel de 12 horas baseada no timestamp `rate_updated_at`. Tentativas de violação são rejeitadas com erro HTTP 400 Bad Request detalhando o teto máximo permitido, o piso mínimo permitido e o tempo de espera restante.

## Boundaries & Constraints

**Always:**
- A janela móvel de controle de velocidade é de exatamente 12 horas (`12 hours`).
- O percentual máximo de variação tarifária permitido dentro da janela é de $\pm 30\%$ ($\text{limite} = 0.30$).
- O controle se aplica tanto a diárias (`base_daily_rate` / `default_daily_rate`) quanto a taxas de entrega (`base_delivery_fee` / `default_delivery_fee`).
- Violações devem ser rejeitadas com erro explicativo em PT-BR indicando claramente o teto máximo, piso mínimo e tempo restante em horas/minutos.
- Quando uma alteração válida for aceita, o campo `rate_updated_at` deve ser atualizado para o timestamp UTC corrente (`now()`).
- Se a última alteração tiver ocorrido há mais de 12 horas, o usuário tem liberdade total de reconfiguração sem bloqueio de 30%.
- A primeira definição de tarifa em perfis recém-criados não sofre bloqueio por não possuir tarifa pregressa.

**Ask First:**
- Alterar o percentual padrão de 30% ou o período de 12 horas.
- Criar exceções permanentes para categorias de usuários sem passar por aprovação de produto.

**Never:**
- Nunca permitir valores negativos para tarifas ($P_{base} \ge 0$).
- Nunca silenciar o erro da trava de velocidade tarifária sem feedback claro ao usuário.
- Nunca bloquear a edição de outros dados cadastrais não relacionados a tarifas (ex: telefone, modal, nome) caso a tarifa não tenha sido alterada.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Variação Permitida ($\le 30\%$) em $< 12\text{h}$ | Diária atual: R$ 100. Nova diária: R$ 125 (+25%). Atualizada há 2h | Tarifa atualizada com sucesso para R$ 125, `rate_updated_at` renovado | N/A |
| Aumento Abusivo ($> 30\%$) em $< 12\text{h}$ | Diária atual: R$ 100. Nova diária: R$ 150 (+50%). Atualizada há 2h | Rejeição imediata (400 Bad Request) informando teto de R$ 130 e piso de R$ 70 | Erro com mensagem em PT-BR e detalhes de piso/teto |
| Redução Abusiva (Dumping predatório) em $< 12\text{h}$ | Diária atual: R$ 100. Nova diária: R$ 60 (-40%). Atualizada há 2h | Rejeição imediata (400 Bad Request) informando piso mínimo de R$ 70 | Erro com mensagem em PT-BR e detalhes de piso/teto |
| Alteração Tempestiva ($\ge 12\text{h}$) | Diária atual: R$ 100. Nova diária: R$ 200. Atualizada há 14h | Tarifa atualizada com sucesso, `rate_updated_at` renovado | N/A |
| Edição de Outros Campos no Perfil | Usuário altera modal de moto para bicicleta sem mudar diária | Perfil atualizado com sucesso sem disparar bloqueio tarifário | N/A |
| Primeira Configuração de Tarifa | Usuário recém-cadastrado configurando tarifas pela primeira vez | Cadastro concluído normalmente | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260904220000_rate_limit_velocity_lock.sql` -- Trigger e função PL/pgSQL `check_rate_velocity_lock` e adição de campos de taxa base e `rate_updated_at` em `store_profiles`.
- `apps/pwa/src/profile/profile-service.ts` -- Métodos `validateRateVelocity`, `updateCourierRates`, `updateStoreRates` e validação prévia na camada de domínio.
- `apps/pwa/src/profile/types.ts` (ou extensão em `profile-service.ts`) -- Interfaces `RateVelocityValidationResult` e parâmetros de atualização de tarifas.
- `tests/rate-velocity-lock.test.js` -- Suíte de testes automatizados com Node test runner validando todas as regras da matriz de I/O e integridade de migration DDL.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260904220000_rate_limit_velocity_lock.sql` -- Criar migration com triggers PostgreSQL para validação de velocidade tarifária em `courier_profiles` e `store_profiles`.
- [x] `apps/pwa/src/profile/profile-service.ts` -- Implementar funções `validateRateVelocity`, `updateCourierRates`, `updateStoreRates` com cálculos precisos de teto, piso e tempo restante.
- [x] `tests/rate-velocity-lock.test.js` -- Implementar suíte de testes completa cobrindo aumento abusivo, dumping predatório, janela móvel de 12h, atualização tempestiva e migration DDL.

**Acceptance Criteria:**
- Given uma alteração de diária ou taxa base em intervalo $< 12$ horas com variação $> 30\%$, when o usuário tentar salvar, then o sistema deve rejeitar com erro 400 Bad Request indicando piso, teto e tempo restante.
- Given uma alteração com variação $\le 30\%$ em intervalo $< 12$ horas, when o usuário submeter, then a tarifa deve ser salva e `rate_updated_at` atualizado.
- Given uma alteração após $\ge 12$ horas, when o usuário submeter nova tarifa, then o valor deve ser atualizado sem restrição de 30%.

## Verification

**Commands:**
- `npm test` -- expected: Todos os testes anteriores + novos testes da Story 3.3 passando com 100% de sucesso.
- `git status` -- expected: Branch `feat/story-3-3-rate-velocity-lock` com código versionado.
