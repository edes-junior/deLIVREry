---
title: 'Story 2.2: Publicação de Vagas de Turno e Notificações Web Push (FCM)'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'c522782d76962efa5c3e46ef251c52cfc9c809ef'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Lojistas precisam de uma interface ágil e amigável no PWA para cadastrar vagas e turnos com modais aceitos e valores de diária/taxa, e necessitam engajar motoboys compatíveis instantaneamente via alertas em tempo real (< 3s), além de incentivos práticos (+50 XP) para planejarem suas escalas com antecedência.

**Approach:** Criar o formulário touch-friendly de publicação de vagas no PWA com cálculo dinâmico de bonificação de +50 XP para publicações com antecedência > 48h, integrado ao serviço de orquestração de notificações Web Push (FCM gratuito / AD-6) com filtragem hiperlocal por bairro e modal de transporte.

## Boundaries & Constraints

**Always:**
- Vagas persistidas com status inicial `open` e IDs geográficos herdados do perfil do lojista (ou customizados para o turno).
- Bonificação automática de +50 XP ao perfil do lojista (`store_profiles.xp_points`) quando o início do turno for agendado com mais de 48 horas de antecedência (`shift_start_time > now() + 48h`) (FR-14).
- Notificações Web Push direcionadas exclusivamente a entregadores do mesmo bairro/cidade e com modal de transporte compatível com `accepted_modals` (AD-6).
- Latência de disparo e simulação de entrega Web Push inferior a 3 segundos (NFR-2).
- Controles de interface no padrão touch-friendly (alvos de toque ≥ 48px) e feedback tátil (haptic feedback) via `navigator.vibrate` nos dispositivos suportados (NFR-9).
- Comunicação e mensagens de interface integralmente em PT-BR.

**Ask First:**
- Permitir que lojistas alterem o bairro da vaga para uma região diferente do seu endereço cadastrado.

**Never:**
- Nunca expor o número de telefone do lojista no payload da notificação push ou no card público da vaga aberta (AD-10).
- Nunca cobrar tarifas ou reter pagamentos (modelo P2P estrito, AD-2).
- Nunca bloquear a criação da vaga caso o envio da notificação push falhe ou o navegador recuse permissão (degradação graciosa).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Publicação com Antecedência > 48h | Lojista submete vaga para daqui a 3 dias | Vaga criada com `status = 'open'`; lojista recebe +50 XP; push enviado a motoboys compatíveis | Exibe toast de sucesso e badge de +50 XP |
| Publicação de Emergência (< 48h) | Lojista submete vaga para o mesmo dia ou dia seguinte | Vaga criada com `status = 'open'`; nenhuma pontuação de XP concedida; push disparado em tempo real | Alerta lojista que publicações com >48h geram XP |
| Filtragem de Destinatários Push por Modal | Vaga aceita apenas `motorcycle`; base possui motoboy de bike e de moto no bairro | Notificação push é despachada apenas para o motoboy de moto | Motoboys com modais incompatíveis não recebem push |
| Filtragem de Destinatários por Geografia | Vaga aberta no bairro A; entregador cadastrado no bairro B distante | Push é disparado somente para entregadores com `home_neighborhood_id = 'A'` | Entregadores de outras regiões não recebem alerta |
| Horário Final Anterior ao Inicial | Lojista define término às 18:00 e início às 22:00 | Formulário bloqueia o envio com mensagem de validação clara | Exibe erro amigável impedindo request |
| Valores Negativos de Diária / Taxa | Lojista digita -50 na diária | Formulário e serviço rejeitam valores negativos | Exibe mensagem de erro no campo |
| Permissão de Push Negada / Offline | Lojista ou entregador com notificações bloqueadas no navegador | Vaga é salva com sucesso no banco; log de notificação in-app gerado sem travar o app | Feedback não-bloqueante no console/UI |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260904180000_store_profiles_xp.sql` -- Adiciona `xp_points` e `level` em `store_profiles` com suporte à pontuação de gamificação.
- `apps/pwa/src/notifications/notification-service.ts` -- Camada de orquestração de notificações Web Push (FCM / in-app) com filtragem geográfica e de modais com latência < 3s.
- `apps/pwa/src/components/jobs/JobPublishModal.tsx` -- Modal touch-friendly de publicação de vagas com cálculo dinâmico de antecedência (>48h) e preview de XP.
- `apps/pwa/src/jobs/job-service.ts` -- Expansão da lógica de criação de vaga para invocar atribuição de XP por antecedência e despacho de push.
- `apps/pwa/src/App.tsx` -- Integração do botão de ação primária `+ Publicar Nova Vaga` e exibição de XP no painel do lojista.
- `tests/job-publishing-push.test.js` -- Suíte de testes automatizados cobrindo a matriz de I/O, cálculo de antecedência de 48h para XP e filtragem de push.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260904180000_store_profiles_xp.sql` -- Criar migration adicionando campos de XP e nível para lojistas.
- [x] `apps/pwa/src/notifications/notification-service.ts` -- Implementar serviço de notificações Web Push FCM com regras de compatibilidade modal/geográfica e SLA < 3s.
- [x] `apps/pwa/src/jobs/job-service.ts` -- Atualizar criação de vaga com regra de bonificação de +50 XP (>48h) e integração com notification-service.
- [x] `apps/pwa/src/components/jobs/JobPublishModal.tsx` -- Criar modal touch-friendly de publicação de vagas com feedback tátil e badge de bônus de XP.
- [x] `apps/pwa/src/App.tsx` -- Conectar o modal ao painel do lojista e exibir XP atualizado.
- [x] `tests/job-publishing-push.test.js` -- Implementar testes unitários para a Matriz de I/O da Story 2.2.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Sincronizar status da Story 2.2 para `ready-for-dev` / `in-progress`.

**Acceptance Criteria:**
- Given um lojista autenticado no PWA com perfil ativo, when ele preencher o formulário de nova vaga com horários válidos e valores de diária/taxa e submeter, then a vaga deve ser persistida com status `open` e o lojista deve visualizar a confirmação no painel.
- Given a publicação de uma vaga com mais de 48 horas de antecedência em relação ao início do turno, when a criação for confirmada, then o sistema deve conceder automaticamente +50 XP ao perfil do lojista.
- Given a criação de uma nova vaga em um bairro ativo, when o disparo for acionado, then o sistema deve filtrar e enviar notificações Web Push para entregadores com modal compatível e cadastrados no mesmo bairro/cidade em latência < 3s (NFR-2).

## Spec Change Log

_Vazia até o primeiro loopback de review._

## Design Notes

O cálculo de antecedência de 48 horas é determinado a partir do timestamp UTC do início do turno:
```typescript
export function calculateAdvanceHours(shiftStartTime: string, referenceTime = new Date()): number {
  const start = new Date(shiftStartTime).getTime();
  const ref = referenceTime.getTime();
  return (start - ref) / (1000 * 60 * 60);
}
export const QUALIFIES_FOR_EARLY_XP_BONUS = (hours: number) => hours >= 48;
```
Quando qualificado, +50 XP é adicionado atômico ao perfil do lojista em `store_profiles`.

## Verification

**Commands:**
- `npm test` -- expected: 100% dos testes passando, incluindo a nova suíte `tests/job-publishing-push.test.js`.

## Suggested Review Order

**Gamification Schema & Early Bonus Migration**

- DDL adicionando campos xp_points e level a store_profiles e trigger de +50 XP
  [`store_profiles_xp.sql:1`](../../supabase/migrations/20260904180000_store_profiles_xp.sql#L1)

**Notification Service & Hyperlocal Dispatch**

- Orquestrador de notificações Web Push FCM com cálculo de antecedência e filtro por modal/bairro
  [`notification-service.ts:1`](../../apps/pwa/src/notifications/notification-service.ts#L1)

- Integração de bônus de XP e despacho de notificações no serviço de vagas
  [`job-service.ts:100`](../../apps/pwa/src/jobs/job-service.ts#L100)

**PWA UI & Touch-Friendly Job Publishing Form**

- Modal touch-friendly de publicação de vagas com badge de antecedência e haptic feedback
  [`JobPublishModal.tsx:1`](../../apps/pwa/src/components/jobs/JobPublishModal.tsx#L1)

- Conexão do botão de publicação e visualização de nível/XP no dashboard do lojista
  [`App.tsx:360`](../../apps/pwa/src/App.tsx#L360)

**Automated Test Suite & Matrix Audit**

- Suíte de testes com cobertura de matriz de I/O, cálculo de 48h e isolamento de privacidade
  [`job-publishing-push.test.js:1`](../../tests/job-publishing-push.test.js#L1)

