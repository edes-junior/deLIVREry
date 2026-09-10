---
title: 'Correção de Schema Cache e Coluna criteria em job_ratings'
type: 'bugfix'
created: '2026-09-10'
status: 'done'
route: 'one-shot'
---

# Correção de Schema Cache e Coluna criteria em job_ratings

## Intent

**Problem:** A submissão de avaliação de turnos falhava com o erro `Could not find the 'criteria' column of 'job_ratings' in the schema cache` porque a migration de critérios e conclusão bilateral não havia sido aplicada ao banco Supabase.

**Approach:** Aplicar a migration DDL `20260910170000_bilateral_job_completion_and_ratings.sql` no banco Supabase com política de blind review otimizada (via função SECURITY DEFINER) e adicionar fallback defensivo em `job-service.ts` para tolerância a eventuais atrasos de cache de schema.

## Suggested Review Order

**Schema & DDL Migration**

- Adição da coluna `criteria JSONB`, índice GIN e política de blind review otimizada no Supabase.
  [`20260910170000_bilateral_job_completion_and_ratings.sql:10`](../../supabase/migrations/20260910170000_bilateral_job_completion_and_ratings.sql#L10)

**Service Resilience & Fallback**

- Tratamento de retry gracioso caso ocorra incompatibilidade temporária no cache de schema do PostgREST.
  [`job-service.ts:740`](../../apps/pwa/src/jobs/job-service.ts#L740)

**Automated Tests**

- Validação da resiliência a erros de schema cache e integridade da migration DDL.
  [`job-matching-ratings.test.js:602`](../../tests/job-matching-ratings.test.js#L602)
