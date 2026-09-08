---
title: 'Story 2.3: Listagem de Vagas Filtrada por Modal e Negociação Bid/Ask (Proposta/Contraproposta)'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: '7f06c1a9c62d5ab3d20988acff113252e720c4a6'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Entregadores autônomos precisam visualizar oportunidades de turnos operacionais filtradas por seu modal de transporte e alcance físico (ex: bicicletas não devem ser submetidas a rotas longas > 3km), podendo aceitar as condições anunciadas com 1 toque ou submeter contrapropostas de diária e taxa (Bid/Ask) para negociação justa e transparente.

**Approach:** Desenvolver o Feed de Vagas no PWA com filtros automáticos por modal e raio operacional (bicicleta restrita a $\le 3\text{km}$), fornecendo botões touch-friendly com feedback tátil para aceite direto do valor anunciado ou abertura de modal para contraproposta personalizada registrada em `job_bids`.

## Boundaries & Constraints

**Always:**
- Vagas categorizadas com raio $> 3\text{km}$ são automaticamente ocultadas para entregadores cadastrados com modal bicicleta convencional (`bicycle`) (FR-5).
- Aceite direto em 1 clique registra o bid com os valores integrais anunciados pelo lojista (`bid_daily_rate = offered_daily_rate`, `bid_delivery_fee = offered_delivery_fee`) e status `pending`.
- Contrapropostas requerem validação de valores numéricos não-negativos (`>= 0`) e são persistidas em `job_bids` com status `pending` (FR-5).
- Emissão de feedback tátil (haptic feedback) via `navigator.vibrate` nos botões de aceite e contraproposta nos dispositivos móveis suportados (NFR-9).
- Alvos de toque touch-friendly com dimensões $\ge 48\text{px}$ (NFR-9).
- Telefones e contatos de lojistas permanecem estritamente isolados na listagem de vagas abertas (AD-10).

**Ask First:**
- Permitir que o entregador envie mais de uma contraproposta se a primeira ainda estiver pendente (recomendado: atualizar o bid existente ou cancelar o anterior).

**Never:**
- Nunca permitir que o entregador veja as ofertas ou contrapropostas de outros motoboys concorrentes (AD-10).
- Nunca permitir envio de propostas com valores de diária ou taxa negativos.
- Nunca cobrar comissões de negociação ou taxas de intermediação (AD-2).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Filtragem Automática para Bicicleta | Entregador com modal `bicycle` consulta feed de vagas abertas | Vagas com raio $> 3\text{km}$ são ocultadas; exibe apenas vagas com raio $\le 3\text{km}$ e que aceitam bicicleta | Exibe lista vazia com mensagem orientativa se não houver vagas curtas |
| Feed para Motocicleta / E-Bike | Entregador com modal `motorcycle` consulta feed | Exibe todas as vagas abertas compatíveis com moto na sua localidade | Filtra normalmente por `accepted_modals` |
| Aceite Direto em 1 Toque | Entregador clica no botão de aceite direto (alvo $\ge 48\text{px}$) | Dispara vibração tátil; cria `job_bids` com valor integral e status `pending`; card atualiza para "Proposta Enviada" | Exibe toast de erro caso já exista proposta do mesmo entregador |
| Submissão de Contraproposta Válida | Entregador abre modal de contraproposta, ajusta diária para R$ 90 e taxa para R$ 7 | Registra proposta em `job_bids` com novos valores; card exibe valores contrapropostos | Valida entradas impedindo valores nulos ou vazios |
| Contraproposta com Valores Negativos | Entregador digita valor negativo de diária no modal de contraproposta | Formulário bloqueia o envio com mensagem em PT-BR | Exibe erro amigável destacando o campo inválido |
| Vaga Casada Enquanto Entregador Navegava | Entregador tenta aceitar ou contrapropor em vaga que acabou de ser casada (`matched`) | Operação rejeitada; exibe toast "Esta vaga já foi preenchida por outro entregador." | Atualiza lista de vagas locais |
| Vaga Cancelada pelo Lojista | Entregador tenta enviar bid para vaga com status `cancelled` | Rejeitada com mensagem informativa amigável | Recarrega feed |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260904190000_job_posts_radius.sql` -- Adiciona coluna `delivery_radius_km NUMERIC(4, 1) DEFAULT 3.0` em `job_posts` com constraints de raio positivo.
- `apps/pwa/src/jobs/types.ts` -- Adiciona `delivery_radius_km` em `JobPost` e DTOs de criação/filtro.
- `apps/pwa/src/jobs/job-service.ts` -- Atualiza `listOpenJobs` para suportar filtro de raio máximo por modal de transporte e validação de status de vaga em `submitBid`.
- `apps/pwa/src/components/jobs/JobCard.tsx` -- Card de vaga com exibição de horários, valores, raio, botão de aceite direto e botão de contraproposta.
- `apps/pwa/src/components/jobs/CounterProposalModal.tsx` -- Modal touch-friendly para ajuste de diária e taxa com feedback tátil.
- `apps/pwa/src/components/jobs/JobFeed.tsx` -- Feed de vagas abertas filtradas por modal e localidade do entregador logado.
- `apps/pwa/src/App.tsx` -- Integração do `JobFeed` no dashboard do entregador.
- `tests/job-feed-bid-ask.test.js` -- Suíte de testes automatizados cobrindo a matriz de I/O da Story 2.3.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260904190000_job_posts_radius.sql` -- Criar migration adicionando `delivery_radius_km` em `job_posts`.
- [x] `apps/pwa/src/jobs/types.ts` -- Atualizar tipagens de `JobPost` com `delivery_radius_km`.
- [x] `apps/pwa/src/jobs/job-service.ts` -- Expandir `listOpenJobs` com regra de restrição de raio ($\le 3\text{km}$ para bicicletas).
- [x] `apps/pwa/src/components/jobs/CounterProposalModal.tsx` -- Implementar modal touch-friendly de contraproposta com feedback tátil.
- [x] `apps/pwa/src/components/jobs/JobCard.tsx` -- Implementar card de vaga com aceite direto em 1 clique e trigger de contraproposta.
- [x] `apps/pwa/src/components/jobs/JobFeed.tsx` -- Implementar feed de vagas com atualização de estado e mensagens em PT-BR.
- [x] `apps/pwa/src/App.tsx` -- Conectar o `JobFeed` na visualização de entregadores autenticados.
- [x] `tests/job-feed-bid-ask.test.js` -- Implementar testes unitários para a Matriz de I/O da Story 2.3.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Sincronizar status da Story 2.3 para `review`.

**Acceptance Criteria:**
- Given um entregador com modal cadastrado como bicicleta convencional (`bicycle`), when ele abrir a listagem de vagas abertas, then o sistema deve ocultar automaticamente vagas categorizadas como de longo alcance (> 5km) e exibir apenas chamadas com raio $\le 3\text{km}$.
- Given uma vaga aberta exibida no feed do PWA, when o entregador clicar no botão de aceite direto (alvo de toque $\ge 48\text{px}$), then o sistema deve emitir vibração tátil (haptic feedback) e registrar a proposta pelo valor integral anunciado.
- Given o entregador optando por contrapropor valores, when ele informar um novo valor de diária e/ou taxa por entrega e submeter, then o registro deve ser inserido em `job_bids` com status `pending` e o lojista notificado.

## Suggested Review Order

1. `supabase/migrations/20260904190000_job_posts_radius.sql` -- Validar DDL que adiciona `delivery_radius_km NUMERIC(4, 1) DEFAULT 3.0` e constraint `CHECK (delivery_radius_km > 0.0 AND delivery_radius_km <= 100.0)`.
2. `apps/pwa/src/jobs/types.ts` -- Verificar novos campos de raio nas interfaces TypeScript.
3. `apps/pwa/src/jobs/job-service.ts` -- Validar função ergonômica `isJobCompatibleWithModal`, filtragem em `listOpenJobs` e verificação de status (`matched`/`cancelled`) em `submitBid`.
4. `apps/pwa/src/components/jobs/CounterProposalModal.tsx` -- Modal touch-friendly com microajustes incrementais (+/- R$ 5 diária, +/- R$ 0.50 taxa) e feedback tátil.
5. `apps/pwa/src/components/jobs/JobCard.tsx` e `apps/pwa/src/components/jobs/JobFeed.tsx` -- Componentes de interface do feed do entregador com alvos de toque $\ge 48\text{px}$.
6. `apps/pwa/src/App.tsx` -- Ponto de montagem no dashboard do entregador logado.
7. `tests/job-feed-bid-ask.test.js` -- Suíte de 9 testes automatizados cobrindo todos os cenários da Matriz de I/O.

## Design Notes

A regra de compatibilidade de raio para bicicletas opera da seguinte forma:
```typescript
export function isJobCompatibleWithModal(job: JobPost, modal: TransportModal): boolean {
  if (!job.accepted_modals.includes(modal)) return false;
  if (modal === 'bicycle') {
    const radius = job.delivery_radius_km ?? 3.0;
    return radius <= 3.0;
  }
  return true;
}
```
Isso garante integridade ergonômica e segurança para os ciclistas na plataforma.

## Verification

**Commands:**
- `npm test` -- 100% dos testes passando (73 testes executados com sucesso).
