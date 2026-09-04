---
title: 'Story 2.1: Schema de Vagas e Propostas com RLS e Isolamento de Contatos'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: '7128ecd68fc8e83847defa39377b6fc3a43399da'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Na publicação de vagas e turnos, ofertas concorrentes de entregadores não podem vazar antes da decisão do lojista, e os contatos telefônicos diretos de ambas as partes precisam permanecer protegidos até que o matching seja formalizado, evitando concorrência desleal, assédio comercial e vazamento de dados de privacidade.

**Approach:** Implementar a migration PostgreSQL com as tabelas `job_posts` e `job_bids`, constraints de integridade e políticas rigorosas de Row Level Security (RLS) no Supabase, garantindo que vagas abertas sejam públicas, propostas concorrentes fiquem isoladas e telefones/nomes civis só sejam mutuamente acessíveis após `status = 'matched'`.

## Boundaries & Constraints

**Always:**
- Row Level Security (RLS) habilitado e obrigatório por padrão em `job_posts` e `job_bids` (AD-10).
- Status de vaga restrito a `open`, `matched`, `in_progress`, `completed`, `cancelled`.
- Status de bid restrito a `pending`, `accepted`, `rejected`, `cancelled`.
- Isolamento de bids concorrentes: um entregador só tem permissão de leitura sobre suas próprias propostas (`auth.uid() = courier_id`). O lojista proprietário da vaga pode ler todas as propostas vinculadas à sua vaga (AD-10).
- Isolamento de contatos telefônicos: a listagem pública de vagas abertas não expõe telefones de lojistas; a liberação mútua de números de telefone e nomes completos ocorre exclusivamente quando `status = 'matched'` para o lojista e o entregador vencedor (AD-10, FR-6).
- Checks numéricos: `offered_daily_rate >= 0`, `offered_delivery_fee >= 0`, `bid_daily_rate >= 0`, `bid_delivery_fee >= 0` e `shift_end_time > shift_start_time`.
- Índices de performance obrigatórios: `(state_id, city_id, neighborhood_id)`, `store_id`, `status` em `job_posts`; `(job_id, courier_id)` e `status` em `job_bids`.
- Convenção de integridade: apenas 1 proposta ativa (`pending` ou `accepted`) por entregador por vaga (`UNIQUE(job_id, courier_id)`).

**Ask First:**
- Alterar as permissões de visibilidade de dados cadastrais gerais de usuários fora do escopo estrito de matching ativo.

**Never:**
- Nunca expor telefone ou contato de lojista em endpoints/queries públicas de vagas com status `open`.
- Nunca permitir que um entregador liste ou receba notificações de valores propostos por motoboys concorrentes.
- Nunca intermediar pagamentos ou reter custódia financeira (modelo P2P estrito, AD-2).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Criação de Vaga por Lojista | Lojista autenticado com perfil ativo submete turno com horários e valores válidos | Registro criado em `job_posts` com `status = 'open'` e IDs geográficos | Rejeita se horários forem inválidos ou valores negativos |
| Listagem Pública de Vagas Abertas | Entregador autenticado ou visitante consulta vagas abertas do bairro | Retorna horários, valores ofertados, modais aceitos e dados públicos da loja; `phone_number` permanece inacessível | Retorna lista filtrada por RLS |
| Submissão de Bid por Entregador | Entregador autenticado submete proposta para vaga com `status = 'open'` | Registro criado em `job_bids` com `status = 'pending'` | Rejeita se entregador já tiver bid na mesma vaga ou se vaga não estiver aberta |
| Isolamento de Bids Concorrentes | Entregador B tenta consultar bids da vaga submetidos por Entregador A | Entregador B recebe apenas seu próprio registro (ou lista vazia se não tiver proposto) via RLS | RLS bloqueia visualização de terceiros sem erro explícito (0 rows) |
| Visualização de Bids pelo Lojista | Lojista dono da vaga consulta `job_bids` para seu `job_id` | Retorna lista de todos os bids de candidatos para sua avaliação | Bloqueia outros lojistas de verem propostas alheias via RLS |
| Matching Formalizado (`matched`) | Lojista aceita proposta de Entregador A; status transiciona para `matched` | Vaga atualizada com `status = 'matched'`, `matched_courier_id` e `matched_bid_id`; contatos telefônicos de ambas as partes liberados mutuamente | Rejeita transição se proposta não pertencer à vaga |
| Tentativa de Bid em Vaga Fechada | Entregador tenta submeter proposta em vaga com status `matched`, `completed` ou `cancelled` | Inserção rejeitada pelas regras de integridade/RLS | Retorna erro de violação de política ou constraint |
| Horário Final Inválido | Lojista submete turno onde `shift_end_time <= shift_start_time` | Inserção rejeitada no PostgreSQL | Retorna erro de check constraint `check_shift_times` |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260904170000_jobs_and_bids_schema.sql` -- DDL completo das tabelas `job_posts` e `job_bids`, triggers de `updated_at`, constraints de integridade, índices geográficos e relacionais, e políticas RLS de leitura/escrita e isolamento de contatos.
- `apps/pwa/src/jobs/types.ts` -- Modelos TypeScript das entidades `JobPost`, `JobBid`, enums de status (`JobStatus`, `BidStatus`), modais de transporte e DTOs de criação/matching.
- `apps/pwa/src/jobs/job-service.ts` -- Camada de serviço desacoplada (Hexagonal) para orquestração de postagem de vagas, consulta filtrada, envio de bids e resolução segura de contatos pós-matching.
- `tests/jobs-schema-rls.test.js` -- Suíte de testes automatizados cobrindo validação estrutural DDL, integridade de constraints, isolamento RLS entre motoboys concorrentes e liberação de contatos em matching.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260904170000_jobs_and_bids_schema.sql` -- Criar DDL com tabelas `job_posts` e `job_bids`, índices, checks numéricos/temporais e políticas RLS de isolamento e contato recíproco.
- [x] `apps/pwa/src/jobs/types.ts` -- Definir tipagens e interfaces TypeScript para vagas, propostas, filtros e entidades de matching.
- [x] `apps/pwa/src/jobs/job-service.ts` -- Implementar serviço de domínio para gerenciamento de vagas e propostas com regras de privacidade e segurança.
- [x] `tests/jobs-schema-rls.test.js` -- Implementar testes unitários para a Matriz de I/O, integridade do schema SQL, regras de RLS e isolamento de contatos.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Sincronizar status da Story 2.1 para `ready-for-dev` / `in-progress`.

**Acceptance Criteria:**
- Given a migration SQL `20260904170000_jobs_and_bids_schema.sql`, when aplicada ao PostgreSQL, then as tabelas `job_posts` e `job_bids` devem existir com constraints de status, checks de valores positivos, foreign keys com `store_profiles`/`courier_profiles` e índices em `city_id` e `neighborhood_id`.
- Given uma vaga com status `open`, when um entregador consultar as vagas disponíveis, then ele pode visualizar os detalhes operacionais do turno, mas não tem acesso ao número de telefone do lojista nem aos valores de propostas concorrentes.
- Given múltiplas propostas submetidas em uma vaga aberta, when um motoboy consultar os bids, then o RLS deve retornar exclusivamente suas próprias propostas, isolando as ofertas concorrentes.
- Given o aceite de uma proposta consolidando o status `matched`, when o lojista e o motoboy vencedor consultarem o registro do turno, then o sistema deve liberar mutuamente seus telefones celulares e nomes para alinhamento operacional direto.

## Spec Change Log

_Vazia até o primeiro loopback de review._

## Design Notes

A liberação mútua de contatos é implementada no PostgreSQL através de uma política RLS recíproca em `users` condicionada à existência de matching ativo entre as partes:
```sql
CREATE POLICY "Users can read matched partner profile"
ON public.users
FOR SELECT
USING (
    auth.uid() = id
    OR EXISTS (
        SELECT 1 FROM public.job_posts jp
        WHERE jp.status IN ('matched', 'in_progress', 'completed')
          AND (
            (jp.store_id = auth.uid() AND jp.matched_courier_id = public.users.id)
            OR
            (jp.matched_courier_id = auth.uid() AND jp.store_id = public.users.id)
          )
    )
);
```
Adicionalmente, uma view de conveniência `job_matched_details` com RLS ativado permite consultar o turno com dados de contato apenas para os atores envolvidos (`store_id = auth.uid()` ou `matched_courier_id = auth.uid()`).

## Verification

**Commands:**
- `npm test` -- expected: 100% dos testes passando, incluindo a nova suíte `tests/jobs-schema-rls.test.js`.

## Suggested Review Order

**PostgreSQL Schema & Row Level Security**

- DDL das tabelas job_posts e job_bids com constraints e políticas RLS de isolamento
  [`jobs_and_bids_schema.sql:1`](../../supabase/migrations/20260904170000_jobs_and_bids_schema.sql#L1)

**Application Domain & Privacy Service**

- Modelos de tipagem TypeScript para vagas, propostas e contatos em matching
  [`types.ts:1`](../../apps/pwa/src/jobs/types.ts#L1)

- Serviço de validações de input, listagem pública segura e liberação mútua de contatos
  [`job-service.ts:1`](../../apps/pwa/src/jobs/job-service.ts#L1)

**Automated Test Suite & Matrix Audit**

- Suíte de 57 testes cobrindo integridade DDL, matriz de I/O e regras de isolamento RLS
  [`jobs-schema-rls.test.js:1`](../../tests/jobs-schema-rls.test.js#L1)

