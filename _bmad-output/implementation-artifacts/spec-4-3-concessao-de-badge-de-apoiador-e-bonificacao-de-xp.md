---
title: 'Story 4.3: Concessão de Badge de Apoiador e Bonificação de XP'
type: 'feature'
created: '2026-09-08'
status: 'done'
baseline_commit: '2cc5352'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A sustentabilidade de uma infraestrutura descentralizada gratuita depende de doações voluntárias recorrentes da comunidade. No entanto, a contribuição precisa ser socialmente reconhecida e celebrada sem gerar privilégios predatórios na fila de entregas. O usuário que apoia financeiramente o projeto deve ter sua atitude valorizada através de pontos de experiência (+25 XP) e uma badge comemorativa de *Apoiador da Comunidade* em seu perfil e nos cards de interação (vagas, lances e dashboard).

**Approach:** 
1. Criar a migration SQL que adiciona as colunas `community_supporter`, `supporter_since`, `last_donation_at` e `monthly_donations_count` em `public.courier_profiles` e `public.store_profiles`.
2. Implementar função trigger no PostgreSQL (`process_donation_supporter_reward`) que detecta o primeiro apoio voluntário registrado por um usuário autenticado no mês corrente em `public.donations_log`, concedendo $+25\text{ XP}$ e ativando a badge de apoiador.
3. Expor na camada de aplicação e domínio (`DonationService`) os métodos para bonificação de XP, verificação de elegibilidade do mês corrente e ativação da badge.
4. Exibir o selo visual de *Apoiador da Comunidade* (`[ 💚 Apoiador da Comunidade ]`) no cabeçalho do `App.tsx`, nos cards de vagas (`JobCard.tsx`), nas propostas do lojista (`StoreJobManagementCard.tsx`) e no toast comemorativo do `DonationBottomSheet.tsx`.

## Boundaries & Constraints

- **Não-Predatório (Regra de Neutralidade de Mercado):** A badge de apoiador confere prestígio social e pontuação de gamificação (+25 XP), mas **não altera** as regras de matching operacional nem os algoritmos de cálculo de preços (FR-7, FR-8).
- **Limite Mensal de XP:** A bonificação de $+25\text{ XP}$ é concedida **exclusivamente na primeira doação do usuário no mês corrente**. Doações subsequentes no mesmo mês mantêm a badge ativa e atualizam `last_donation_at` e a contagem mensal, sem concessão cumulativa abusiva de XP para prevenir farming de níveis.
- **Isolamento e Segurança (RLS - NFR-5):** Atualizações de pontuação e status de apoiador devem ser protegidas no banco de dados via trigger/função `SECURITY DEFINER` para impedir manipulação indevida de XP pelo cliente.
- **Ergonomia e Acessibilidade (NFR-9):** O selo visual deve possuir alto contraste, ícone legível e ser touch-friendly.

## Acceptance Criteria

1. **Migration SQL DDL e Triggers:**
   - Adicionar colunas `community_supporter BOOLEAN NOT NULL DEFAULT false`, `supporter_since TIMESTAMPTZ`, `last_donation_at TIMESTAMPTZ`, e `monthly_donations_count INTEGER NOT NULL DEFAULT 0` em `public.courier_profiles` e `public.store_profiles`.
   - Implementar trigger `trg_donation_supporter_reward` após inserção em `public.donations_log` para processar a bonificação e status do usuário autenticado.
   - Conceder $+25\text{ XP}$ e recalcular nível (Bronze $\to$ Prata $\to$ Ouro) na primeira doação do mês (`COUNT = 1` no mês).

2. **Camada de Serviço e Domínio (`DonationService`):**
   - Método `processDonationReward(userId, suggestedAmount, triggerMoment)` retornando `{ xpAwarded: 25 | 0, isFirstOfMonth: boolean, newLevel: string, communitySupporter: true }`.
   - Método `isUserFirstDonationOfMonth(userId, date?)` para checagem rápida de elegibilidade.

3. **Integração no Bottom Sheet e Toast:**
   - Ao copiar o PIX autenticado pela 1ª vez no mês, o `DonationBottomSheet` exibe toast de vitória: *"🎉 +25 XP e Selo de Apoiador da Comunidade Ativado!"*.

4. **Selo Visual de Apoiador nos Componentes do PWA:**
   - Header do `App.tsx`: Selo `[ 💚 Apoiador da Comunidade ]` ao lado do nome do usuário.
   - `JobCard.tsx`: Selo `[ 💚 Apoiador ]` ao lado do nome do lojista que publicou o turno.
   - `StoreJobManagementCard.tsx`: Selo `[ 💚 Apoiador ]` nos cards de entregadores que enviaram propostas.

5. **Suíte de Testes Automatizados:**
   - Testes unitários e de integração validando a concessão de +25 XP no 1º apoio do mês, rejeição de XP duplicado no mesmo mês, recálculo de nível e exibição visual do selo.

</frozen-after-approval>
