import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  cancelJobWithPenaltyCheck,
  cancelJob
} from '../apps/pwa/src/jobs/job-service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Mock em memória do Supabase para testes de cancelamento de turno
 */
function createMockSupabase(initialData = {}) {
  const storage = {
    job_posts: JSON.parse(JSON.stringify(initialData.job_posts || [])),
    job_bids: JSON.parse(JSON.stringify(initialData.job_bids || [])),
    store_profiles: JSON.parse(JSON.stringify(initialData.store_profiles || [])),
    courier_profiles: JSON.parse(JSON.stringify(initialData.courier_profiles || []))
  };

  return {
    storage,
    from(tableName) {
      const state = {
        table: tableName,
        filters: [],
        dataToInsert: null,
        dataToUpdate: null
      };

      const chain = {
        insert(payload) {
          state.dataToInsert = payload;
          return chain;
        },
        update(payload) {
          state.dataToUpdate = payload;
          return chain;
        },
        select() {
          return chain;
        },
        eq(col, val) {
          state.filters.push({ col, val, op: 'eq' });
          return chain;
        },
        neq(col, val) {
          state.filters.push({ col, val, op: 'neq' });
          return chain;
        },
        order() {
          return chain;
        },
        async single() {
          if (state.dataToUpdate) {
            const found = (storage[state.table] || []).find((r) =>
              state.filters.every((f) => (f.op === 'neq' ? r[f.col] !== f.val : r[f.col] === f.val))
            );
            if (found) {
              Object.assign(found, state.dataToUpdate);
              return { data: found, error: null };
            }
          }

          const row = (storage[state.table] || []).find((r) =>
            state.filters.every((f) => (f.op === 'neq' ? r[f.col] !== f.val : r[f.col] === f.val))
          );
          if (!row) {
            return { data: null, error: { message: 'Not found' } };
          }
          return { data: row, error: null };
        },
        then(resolve) {
          if (state.dataToUpdate) {
            (storage[state.table] || []).forEach((r) => {
              const match = state.filters.every((f) =>
                f.op === 'neq' ? r[f.col] !== f.val : r[f.col] === f.val
              );
              if (match) {
                Object.assign(r, state.dataToUpdate);
              }
            });
            resolve({ data: null, error: null });
            return;
          }

          const rows = (storage[state.table] || []).filter((r) =>
            state.filters.every((f) =>
              f.op === 'neq' ? r[f.col] !== f.val : r[f.col] === f.val
            )
          );
          resolve({ data: rows, error: null });
        }
      };

      return chain;
    }
  };
}

// -----------------------------------------------------------------------------
// Testes Automatizados da Regra de Cancelamento de Turnos pelo Lojista
// -----------------------------------------------------------------------------

test('Cancelamento Lojista: Isenção de penalidade dentro de 1h da publicação mesmo com propostas', async () => {
  // Publicado há 20 minutos com 2 propostas pendentes
  const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-1',
        store_id: 'store-1',
        status: 'open',
        created_at: twentyMinsAgo
      }
    ],
    job_bids: [
      { id: 'bid-1', job_id: 'job-1', courier_id: 'c-1', status: 'pending' },
      { id: 'bid-2', job_id: 'job-1', courier_id: 'c-2', status: 'pending' }
    ],
    store_profiles: [
      { user_id: 'store-1', xp_points: 100 }
    ]
  });

  const res = await cancelJobWithPenaltyCheck('store-1', 'job-1', 'Erro no horário da vaga', mockDb);

  assert.equal(res.success, true);
  assert.equal(res.penaltyApplied, false, 'Deve ser isento de penalidade dentro de 1h');
  assert.equal(res.penaltyXp, 0);
  assert.equal(res.job.status, 'cancelled');
  assert.equal(res.job.cancellation_reason, 'Erro no horário da vaga');
  assert.ok(res.job.cancelled_at, 'Deve ter gravado data de cancelamento');

  // Lances pendentes devem ter sido cancelados
  const bids = mockDb.storage.job_bids;
  assert.ok(bids.every((b) => b.status === 'cancelled'), 'Todos os lances devem ter sido cancelados');

  // XP da loja inalterado
  const store = mockDb.storage.store_profiles.find((s) => s.user_id === 'store-1');
  assert.equal(store.xp_points, 100, 'XP não deve ter sido debitado');
});

test('Cancelamento Lojista: Isenção de penalidade após 1h quando não houver propostas de entregadores', async () => {
  // Publicado há 3 horas, porém nenhum entregador enviou proposta
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-2',
        store_id: 'store-1',
        status: 'open',
        created_at: threeHoursAgo
      }
    ],
    job_bids: [],
    store_profiles: [
      { user_id: 'store-1', xp_points: 100 }
    ]
  });

  const res = await cancelJobWithPenaltyCheck('store-1', 'job-2', 'Movimento fraco / sem demanda suficiente', mockDb);

  assert.equal(res.success, true);
  assert.equal(res.penaltyApplied, false, 'Deve ser isento de penalidade pois ninguém demonstrou interesse');
  assert.equal(res.penaltyXp, 0);
  assert.equal(res.job.status, 'cancelled');

  const store = mockDb.storage.store_profiles.find((s) => s.user_id === 'store-1');
  assert.equal(store.xp_points, 100);
});

test('Cancelamento Lojista: Aplica penalidade (-30 XP) se cancelado após 1h com propostas existentes', async () => {
  // Publicado há 2 horas e possui propostas pendentes
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-3',
        store_id: 'store-1',
        status: 'open',
        created_at: twoHoursAgo
      }
    ],
    job_bids: [
      { id: 'bid-1', job_id: 'job-3', courier_id: 'c-1', status: 'pending' }
    ],
    store_profiles: [
      { user_id: 'store-1', xp_points: 100 }
    ]
  });

  const res = await cancelJobWithPenaltyCheck('store-1', 'job-3', 'Problema operacional ou imprevisto na loja', mockDb);

  assert.equal(res.success, true);
  assert.equal(res.penaltyApplied, true, 'Deve aplicar penalidade pois passou de 1h e havia interessados');
  assert.equal(res.penaltyXp, 30);
  assert.equal(res.job.status, 'cancelled');

  const store = mockDb.storage.store_profiles.find((s) => s.user_id === 'store-1');
  assert.equal(store.xp_points, 70, 'Deve subtrair 30 XP da loja');

  const bid = mockDb.storage.job_bids.find((b) => b.id === 'bid-1');
  assert.equal(bid.status, 'cancelled');
});

test('Cancelamento Lojista: Bloqueio estrito de cancelamento após o matching', async () => {
  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-matched',
        store_id: 'store-1',
        matched_courier_id: 'courier-1',
        status: 'matched',
        created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
      }
    ],
    store_profiles: [
      { user_id: 'store-1', xp_points: 100 }
    ]
  });

  const res = await cancelJobWithPenaltyCheck('store-1', 'job-matched', 'Quero cancelar', mockDb);

  assert.equal(res.success, false);
  assert.equal(res.penaltyApplied, false);
  assert.match(res.error, /após o matching/i, 'Deve informar que cancelamento é proibido após matching');

  const store = mockDb.storage.store_profiles.find((s) => s.user_id === 'store-1');
  assert.equal(store.xp_points, 100);
});

test('Cancelamento Lojista: Rejeita tentativa de cancelamento sem motivo fornecido', async () => {
  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-4',
        store_id: 'store-1',
        status: 'open',
        created_at: new Date().toISOString()
      }
    ]
  });

  const resEmpty = await cancelJobWithPenaltyCheck('store-1', 'job-4', '', mockDb);
  assert.equal(resEmpty.success, false);
  assert.match(resEmpty.error, /motivo.*obrigatório/i);

  const resWhitespace = await cancelJobWithPenaltyCheck('store-1', 'job-4', '   ', mockDb);
  assert.equal(resWhitespace.success, false);
  assert.match(resWhitespace.error, /motivo.*obrigatório/i);
});

test('Cancelamento Lojista: Rejeita cancelamento por usuário que não é participante da vaga', async () => {
  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-5',
        store_id: 'store-1',
        status: 'open',
        created_at: new Date().toISOString()
      }
    ]
  });

  const res = await cancelJobWithPenaltyCheck('other-user', 'job-5', 'Tentativa indevida', mockDb);
  assert.equal(res.success, false);
  assert.match(res.error, /participantes deste turno/i);
});

test('Integridade da Migration SQL (20260910150000_job_cancellation_rules.sql)', () => {
  const migrationPath = path.join(rootDir, 'supabase', 'migrations', '20260910150000_job_cancellation_rules.sql');
  assert.ok(fs.existsSync(migrationPath), 'Arquivo de migration deve existir');

  const content = fs.readFileSync(migrationPath, 'utf8');
  assert.ok(content.includes('cancellation_reason TEXT'), 'Deve adicionar cancellation_reason');
  assert.ok(content.includes('cancelled_at TIMESTAMPTZ'), 'Deve adicionar cancelled_at');
  assert.ok(content.includes('idx_job_posts_cancellation_analytics'), 'Deve criar índice analítico');
});
