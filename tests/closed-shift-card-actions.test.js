import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getRatedJobIdsForUser,
  hasUserRatedJob
} from '../apps/pwa/src/jobs/job-service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Mock em memória do Supabase para testes de status de avaliação de turnos.
 */
function createMockSupabase(initialData = {}) {
  const storage = {
    job_ratings: initialData.job_ratings || []
  };

  return {
    storage,
    from(tableName) {
      const state = {
        table: tableName,
        filters: [],
        inFilters: []
      };

      const chain = {
        select() {
          return chain;
        },
        eq(col, val) {
          state.filters.push({ col, val, op: 'eq' });
          return chain;
        },
        in(col, list) {
          state.inFilters.push({ col, list });
          return chain;
        },
        async maybeSingle() {
          const list = storage[state.table] || [];
          let filtered = list.filter((item) => {
            return state.filters.every((f) => item[f.col] === f.val);
          });
          return { data: filtered[0] || null, error: null };
        },
        then(resolve) {
          const list = storage[state.table] || [];
          let filtered = list.filter((item) => {
            const matchesEq = state.filters.every((f) => item[f.col] === f.val);
            const matchesIn = state.inFilters.every((f) => f.list.includes(item[f.col]));
            return matchesEq && matchesIn;
          });
          return Promise.resolve({ data: filtered, error: null }).then(resolve);
        }
      };

      return chain;
    }
  };
}

test('Feature: Turno Fechado - Ocultação de Ficha/Contatos/Conclusão e Exibição Apenas de Avaliação Pendente', async (t) => {

  await t.test('hasUserRatedJob deve identificar corretamente se o usuário já avaliou o turno', async () => {
    const mockDb = createMockSupabase({
      job_ratings: [
        { id: 'rate-1', job_id: 'job-100', rater_id: 'user-store', rating: 5 },
        { id: 'rate-2', job_id: 'job-200', rater_id: 'user-courier', rating: 4 }
      ]
    });

    const isRatedStore = await hasUserRatedJob('user-store', 'job-100', mockDb);
    assert.equal(isRatedStore, true, 'Deve retornar true para turno já avaliado pelo lojista');

    const isRatedStoreUnratedJob = await hasUserRatedJob('user-store', 'job-200', mockDb);
    assert.equal(isRatedStoreUnratedJob, false, 'Deve retornar false para turno que o lojista ainda não avaliou');

    const isRatedEmpty = await hasUserRatedJob('', 'job-100', mockDb);
    assert.equal(isRatedEmpty, false, 'Deve retornar false para id de usuário vazio');
  });

  await t.test('getRatedJobIdsForUser deve retornar Set com os IDs avaliados em lote', async () => {
    const mockDb = createMockSupabase({
      job_ratings: [
        { id: 'rate-1', job_id: 'job-1', rater_id: 'store-a', rating: 5 },
        { id: 'rate-2', job_id: 'job-3', rater_id: 'store-a', rating: 4 },
        { id: 'rate-3', job_id: 'job-2', rater_id: 'store-b', rating: 5 }
      ]
    });

    const ratedSet = await getRatedJobIdsForUser('store-a', ['job-1', 'job-2', 'job-3', 'job-4'], mockDb);
    assert.equal(ratedSet.has('job-1'), true);
    assert.equal(ratedSet.has('job-3'), true);
    assert.equal(ratedSet.has('job-2'), false, 'Não deve conter turno avaliado por outro usuário');
    assert.equal(ratedSet.has('job-4'), false, 'Não deve conter turno não avaliado');
    assert.equal(ratedSet.size, 2);

    const emptySet = await getRatedJobIdsForUser('store-a', [], mockDb);
    assert.equal(emptySet.size, 0);
  });

  await t.test('MatchedContactCard.tsx deve suportar jobStatus e hasRated ocultando ficha e ações em turnos fechados', () => {
    const cardPath = path.resolve(rootDir, 'apps/pwa/src/components/jobs/MatchedContactCard.tsx');
    const content = fs.readFileSync(cardPath, 'utf8');

    assert.ok(content.includes('jobStatus?: string'), 'Deve aceitar prop opcional jobStatus');
    assert.ok(content.includes('hasRated?: boolean'), 'Deve aceitar prop opcional hasRated');
    assert.ok(content.includes("isClosed = jobStatus === 'completed' || jobStatus === 'cancelled'"), 'Deve identificar turno fechado');
    assert.ok(content.includes('data-testid="shift-completed-rated"'), 'Deve conter indicador de turno finalizado e avaliado');
    assert.ok(content.includes('data-testid="shift-completed-unrated"'), 'Deve conter bloco de avaliação pendente quando não avaliado');
    assert.ok(content.includes('data-testid="btn-evaluate-closed-shift"'), 'Deve exibir botão para avaliar turno fechado pendente');
  });

  await t.test('StoreJobManagementCard.tsx deve repassar jobStatus e hasRated para MatchedContactCard', () => {
    const cardPath = path.resolve(rootDir, 'apps/pwa/src/components/jobs/StoreJobManagementCard.tsx');
    const content = fs.readFileSync(cardPath, 'utf8');

    assert.ok(content.includes('hasRated?: boolean'), 'Interface do card gerencial deve aceitar hasRated');
    assert.ok(content.includes('hasUserRatedJob'), 'Deve importar hasUserRatedJob para checagem resiliente');
    assert.ok(content.includes('jobStatus={job.status}'), 'Deve repassar jobStatus para MatchedContactCard');
    assert.ok(content.includes('hasRated={isShiftRated}'), 'Deve repassar hasRated para MatchedContactCard');
  });

  await t.test('StoreJobsList.tsx deve consultar getRatedJobIdsForUser e atualizar dinamicamente no sucesso da avaliação', () => {
    const listPath = path.resolve(rootDir, 'apps/pwa/src/components/jobs/StoreJobsList.tsx');
    const content = fs.readFileSync(listPath, 'utf8');

    assert.ok(content.includes('getRatedJobIdsForUser'), 'Deve importar getRatedJobIdsForUser');
    assert.ok(content.includes('ratedJobIds'), 'Deve manter estado de ratedJobIds');
    assert.ok(content.includes('setRatedJobIds'), 'Deve atualizar ratedJobIds no fetchJobs e handleRatingSuccess');
    assert.ok(content.includes('hasRated={ratedJobIds.has(job.id)}'), 'Deve calcular e passar hasRated para cada StoreJobManagementCard');
  });
});
