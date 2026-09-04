---
title: 'Story 2.4: Fechamento de Matching, Liberação de Contatos e Gestão de Reputação/XP'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'fa1db392ae4a7d1606be33bc2e02731a87dcd6b5'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Quando o lojista recebe propostas (bids) para suas vagas de turno, ele precisa aceitar a melhor proposta com 1 clique, rejeitando automaticamente as propostas concorrentes e liberando os dados de contato telefônico recíprocos (WhatsApp e chamada direta) sem intermediários ou custódia financeira. Ao término do turno operacional, ambas as partes precisam formalizar a conclusão para receber bônus de XP e avaliar mutuamente a reputação (1 a 5 estrelas), com mecanismos anti-abandono que penalizam cancelamentos tardios (< 2h).

**Approach:** Criar o fluxo completo de aceitação de matching pelo lojista, visualização segura dos contatos diretos no card do turno em status `matched`, botão de contato rápido WhatsApp (`https://wa.me/55...`) e discagem (`tel:...`), rotina de conclusão de turno com concessão de XP (+20 XP entregador, +10 XP lojista), sistema de avaliação mútua e reputação (`job_ratings`), e regra de cancelamento tardio com penalidade de reputação e XP (-30 XP).

## Boundaries & Constraints

**Always:**
- O aceite de matching com 1 clique pelo lojista atualiza a vaga para `matched`, o bid aceito para `accepted` e todos os demais bids concorrentes para `rejected` (FR-6).
- Os contatos telefônicos (celular com DDD) e nomes só são liberados reciprocamente após o status da vaga atingir `matched`, `in_progress` ou `completed` (AD-10).
- Avaliações de reputação devem ser estritamente de 1 a 5 estrelas e associadas ao turno concluído, impedindo avaliações duplicadas do mesmo usuário na mesma vaga (`UNIQUE(job_id, rater_id)`).
- Conclusão do turno formaliza o ciclo operacional e bonifica os participantes com XP (+20 XP entregador, +10 XP lojista) (FR-14).
- Cancelamentos realizados com menos de 2 horas do início do turno aplicam penalidade de -30 XP ao usuário causador (FR-14).
- Todos os botões e alvos de toque na interface touch-friendly devem ter dimensões mínimas $\ge 48\text{px}$ e feedback tátil (`navigator.vibrate`) (NFR-9).
- Zero custódia financeira: a plataforma nunca retém pagamentos ou cobra comissões (AD-2).

**Ask First:**
- Permitir edição de avaliação após submissão inicial (recomendado: imutável após submissão para evitar coerção).

**Never:**
- Nunca exibir o telefone de uma parte antes da confirmação do matching.
- Nunca permitir que usuários alheios ao turno acessem os telefones de contato (AD-10).
- Nunca permitir notas fora da escala de 1 a 5 estrelas.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Lojista Aceita Proposta (1 Clique) | Lojista clica em "Aceitar Proposta" de um bid específico | Vaga vira `matched`, bid vira `accepted`, outros bids viram `rejected`; contatos liberados na view `job_matched_contacts` | Rejeita se o lojista não for o dono da vaga |
| Tentativa de Aceitar Bid em Vaga Já Casada | Lojista tenta aceitar um segundo bid em vaga já em `matched` | Operação bloqueada; exibe mensagem amigável em PT-BR | "Esta vaga já foi preenchida." |
| Liberação e Acesso a Contatos Autorizados | Lojista ou entregador vencedor consulta `getMatchedJobDetails` | Retorna nomes e telefones com links para WhatsApp e discagem direta | Exibe cards com botões de chamada imediata |
| Tentativa de Acesso a Contatos por Terceiro | Usuário não participante do turno tenta consultar contatos | Acesso estritamente negado via RLS e serviço de domínio (AD-10) | Erro "Acesso não autorizado aos contatos deste turno." |
| Conclusão de Turno e Concessão de XP | Lojista ou entregador clica em "Concluir Turno" | Vaga vira `completed`; soma +20 XP ao entregador e +10 XP ao lojista; abre modal de avaliação | Rejeita se vaga não estiver em `matched` ou `in_progress` |
| Submissão de Avaliação Válida | Usuário envia nota 5 estrelas com comentário elogioso | Registra em `job_ratings`; recalcula `reputation_score` do parceiro avaliado | Valida nota entre 1 e 5 |
| Avaliação Duplicada | Usuário tenta avaliar o parceiro uma segunda vez para a mesma vaga | Rejeita submissão duplicada via constraint de unicidade | "Você já avaliou este participante neste turno." |
| Cancelamento Tardio (< 2h do início) | Usuário cancela turno a menos de 2 horas do horário inicial | Vaga vira `cancelled`; aplica penalidade de -30 XP ao usuário causador | Notifica a outra parte imediatamente |
| Cancelamento Tempestivo (>= 2h) | Usuário cancela com antecedência superior a 2 horas | Vaga vira `cancelled` sem penalidade de XP | Notifica a contraparte amigavelmente |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260904200000_job_ratings_and_completion.sql` -- Schema DDL para `job_ratings`, adição de `reputation_score` em `courier_profiles`, índices e RLS.
- `apps/pwa/src/jobs/types.ts` -- Novas tipagens e interfaces para matching, contatos, avaliações (`JobRating`, `CreateJobRatingDTO`, `JobCompletionResult`).
- `apps/pwa/src/jobs/job-service.ts` -- Funções de domínio para `listStoreJobs`, `completeJob`, `submitJobRating`, `cancelJobWithPenaltyCheck`.
- `apps/pwa/src/components/jobs/StoreJobManagementCard.tsx` -- Card gerencial do lojista para acompanhar suas vagas, revisar propostas recebidas e aceitar matching com 1 clique.
- `apps/pwa/src/components/jobs/StoreJobsList.tsx` -- Painel de listagem de vagas do lojista.
- `apps/pwa/src/components/jobs/MatchedContactCard.tsx` -- Componente de exibição de contatos liberados com botões diretos de WhatsApp (`wa.me`) e discagem telefônica (`tel:`).
- `apps/pwa/src/components/jobs/JobRatingModal.tsx` -- Modal touch-friendly de avaliação de turno com estrelas (1 a 5), feedback tátil e comentário.
- `apps/pwa/src/App.tsx` -- Integração da gestão de vagas do lojista e exibição de turnos casados no dashboard de ambos os perfis.
- `tests/job-matching-ratings.test.js` -- Suíte de testes automatizados cobrindo a matriz completa de I/O da Story 2.4.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260904200000_job_ratings_and_completion.sql` -- Criar migration com tabela `job_ratings`, constraints e `reputation_score` em `courier_profiles`.
- [x] `apps/pwa/src/jobs/types.ts` -- Expandir tipos com DTOs de rating, conclusão e cancelamento.
- [x] `apps/pwa/src/jobs/job-service.ts` -- Implementar `completeJob`, `submitJobRating`, `cancelJobWithPenaltyCheck` e `listStoreJobs`.
- [x] `apps/pwa/src/components/jobs/MatchedContactCard.tsx` -- Implementar card de contatos recíprocos com atalhos para WhatsApp e chamada telefônica.
- [x] `apps/pwa/src/components/jobs/JobRatingModal.tsx` -- Implementar modal de avaliação por estrelas com haptic feedback.
- [x] `apps/pwa/src/components/jobs/StoreJobManagementCard.tsx` -- Implementar card de gestão de vagas para lojistas com aceite em 1 toque.
- [x] `apps/pwa/src/components/jobs/StoreJobsList.tsx` -- Implementar lista de vagas do lojista integrado ao dashboard.
- [x] `apps/pwa/src/App.tsx` -- Integrar componentes gerenciais no painel de lojistas e entregadores.
- [x] `tests/job-matching-ratings.test.js` -- Implementar testes unitários para a Matriz de I/O da Story 2.4.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Atualizar status da Story 2.4 para `review`.

**Acceptance Criteria:**
- Given um lojista com propostas recebidas em sua vaga, when ele clicar em aceitar proposta com 1 clique, then a vaga é casada (`matched`), o entregador vencedor é associado, os demais bids são rejeitados e os contatos telefônicos recíprocos são liberados.
- Given um turno com status `matched`, when lojista ou entregador acessarem os detalhes da vaga, then os contatos diretos (nome e telefone com links de WhatsApp e ligação) devem ser exibidos e protegidos contra acesso por terceiros (RLS).
- Given um turno concluído, when os participantes submeterem avaliação de 1 a 5 estrelas, then a reputação média ponderada deve ser recalculada e o XP de turno concedido.
- Given o cancelamento de um turno casado com antecedência inferior a 2 horas, then uma penalidade de -30 XP deve ser aplicada ao perfil do usuário causador.

## Suggested Review Order

1. `supabase/migrations/20260904200000_job_ratings_and_completion.sql` -- Validar tabela `job_ratings`, RLS, trigger de média de reputação e `courier_profiles.reputation_score`.
2. `apps/pwa/src/jobs/types.ts` -- Interfaces para ratings, completion e cancelamento com penalidade.
3. `apps/pwa/src/jobs/job-service.ts` -- Funções de domínio `completeJob` (concessão de XP), `submitJobRating` (validações e recálculo), `cancelJobWithPenaltyCheck` (regra anti-abandono < 2h) e `listStoreJobs`.
4. `apps/pwa/src/components/jobs/MatchedContactCard.tsx` -- Exibição segura dos contatos diretos com links `wa.me` e `tel:`.
5. `apps/pwa/src/components/jobs/JobRatingModal.tsx` -- Modal com seletor touch-friendly de estrelas (1 a 5) e feedback tátil.
6. `apps/pwa/src/components/jobs/StoreJobManagementCard.tsx` e `StoreJobsList.tsx` -- Gestão de turnos do lojista e aceite com 1 toque.
7. `apps/pwa/src/App.tsx` -- Integração com o painel do lojista.
8. `tests/job-matching-ratings.test.js` -- 10 testes cobrindo toda a matriz de I/O da história.

## Verification

**Commands:**
- `npm test` -- 100% dos testes passando (83 testes executados com sucesso no monorepo).
