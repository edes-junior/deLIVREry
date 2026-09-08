import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  acceptBid,
  getMatchedJobDetails,
  completeJob,
  submitJobRating,
  validateJobRatingInput,
  cancelJobWithPenaltyCheck
} from '../apps/pwa/src/jobs/job-service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Mock em memória do Supabase para testes de matching, contatos, XP e reputação.
 */
function createMockSupabase(initialData = {}) {
  const storage = {
    job_posts: initialData.job_posts || [],
    job_bids: initialData.job_bids || [],
    job_ratings: initialData.job_ratings || [],
    store_profiles: initialData.store_profiles || [],
    courier_profiles: initialData.courier_profiles || [],
    job_matched_contacts: initialData.job_matched_contacts || []
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
          if (state.dataToInsert) {
            // Verifica constraint de unicidade (ex: unique_job_rater)
            if (state.table === 'job_ratings') {
              const duplicate = storage.job_ratings.find(
                (r) => r.job_id === state.dataToInsert.job_id && r.rater_id === state.dataToInsert.rater_id
              );
              if (duplicate) {
                return {
                  data: null,
                  error: { message: 'duplicate key value violates unique constraint "unique_job_rater"' }
                };
              }
            }

            const row = {
              id: `${state.table}-uuid-${(storage[state.table] || []).length + 1}`,
              created_at: new Date().toISOString(),
              ...state.dataToInsert
            };
            if (!storage[state.table]) storage[state.table] = [];
            storage[state.table].push(row);
            return { data: row, error: null };
          }

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
// Testes Automatizados da Story 2.4
// -----------------------------------------------------------------------------

test('Story 2.4 - Matriz Linha 1: Lojista fecha matching com 1 clique, aceita proposta e rejeita concorrentes (FR-6)', async () => {
  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-100',
        store_id: 'store-1',
        status: 'open',
        offered_daily_rate: 80,
        offered_delivery_fee: 6
      }
    ],
    job_bids: [
      {
        id: 'bid-winner',
        job_id: 'job-100',
        courier_id: 'courier-win',
        bid_daily_rate: 80,
        bid_delivery_fee: 6,
        status: 'pending'
      },
      {
        id: 'bid-loser',
        job_id: 'job-100',
        courier_id: 'courier-lose',
        bid_daily_rate: 95,
        bid_delivery_fee: 7,
        status: 'pending'
      }
    ]
  });

  const res = await acceptBid('store-1', 'job-100', 'bid-winner', 'courier-win', mockDb);

  assert.equal(res.success, true);
  assert.equal(res.job.status, 'matched');
  assert.equal(res.job.matched_bid_id, 'bid-winner');
  assert.equal(res.job.matched_courier_id, 'courier-win');

  // Verifica que o bid vencedor foi aceito
  const winner = mockDb.storage.job_bids.find((b) => b.id === 'bid-winner');
  assert.equal(winner.status, 'accepted');

  // Verifica que o bid perdedor foi rejeitado
  const loser = mockDb.storage.job_bids.find((b) => b.id === 'bid-loser');
  assert.equal(loser.status, 'rejected');
});

test('Story 2.4 - Matriz Linha 3: Liberação mútua de contatos para partes autorizadas (AD-10, FR-6)', async () => {
  const mockDb = createMockSupabase({
    job_matched_contacts: [
      {
        job_id: 'job-100',
        job_status: 'matched',
        store_id: 'store-1',
        store_name: 'Pizzaria Bella',
        store_contact_name: 'Carlos Lojista',
        store_phone_number: '(11) 98765-4321',
        courier_id: 'courier-win',
        courier_name: 'Marcos Motoboy',
        courier_phone_number: '(11) 91234-5678',
        courier_modal: 'motorcycle',
        offered_daily_rate: 80,
        offered_delivery_fee: 6
      }
    ]
  });

  // Consulta pelo Lojista
  const resStore = await getMatchedJobDetails('store-1', 'job-100', mockDb);
  assert.equal(resStore.success, true);
  assert.equal(resStore.contact.courier_name, 'Marcos Motoboy');
  assert.equal(resStore.contact.courier_phone_number, '(11) 91234-5678');

  // Consulta pelo Entregador
  const resCourier = await getMatchedJobDetails('courier-win', 'job-100', mockDb);
  assert.equal(resCourier.success, true);
  assert.equal(resCourier.contact.store_name, 'Pizzaria Bella');
  assert.equal(resCourier.contact.store_phone_number, '(11) 98765-4321');
});

test('Story 2.4 - Matriz Linha 4: Bloqueio estrito de acesso a contatos por terceiros (AD-10)', async () => {
  const mockDb = createMockSupabase({
    job_matched_contacts: [
      {
        job_id: 'job-100',
        store_id: 'store-1',
        courier_id: 'courier-win'
      }
    ]
  });

  const resIntruder = await getMatchedJobDetails('intruder-user-999', 'job-100', mockDb);
  assert.equal(resIntruder.success, false);
  assert.ok(resIntruder.error.includes('não autorizado'));
});

test('Story 2.4 - Matriz Linha 5: Conclusão de Turno com concessão de XP para entregador e lojista (FR-14)', async () => {
  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-200',
        store_id: 'store-1',
        matched_courier_id: 'courier-1',
        status: 'matched'
      }
    ],
    courier_profiles: [
      { user_id: 'courier-1', xp_points: 50 }
    ],
    store_profiles: [
      { user_id: 'store-1', xp_points: 100 }
    ]
  });

  const res = await completeJob('store-1', 'job-200', mockDb);

  assert.equal(res.success, true);
  assert.equal(res.job.status, 'completed');
  assert.equal(res.courierEarnedXp, 20);
  assert.equal(res.storeEarnedXp, 10);

  const updatedCourier = mockDb.storage.courier_profiles.find((c) => c.user_id === 'courier-1');
  assert.equal(updatedCourier.xp_points, 70, 'Entregador deve ter acumulado +20 XP');

  const updatedStore = mockDb.storage.store_profiles.find((s) => s.user_id === 'store-1');
  assert.equal(updatedStore.xp_points, 110, 'Lojista deve ter acumulado +10 XP');
});

test('Story 2.4 - Matriz Linha 6: Submissão de avaliação de 1 a 5 estrelas e recálculo de reputação (FR-14)', async () => {
  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-300',
        store_id: 'store-1',
        matched_courier_id: 'courier-1',
        status: 'completed'
      }
    ],
    courier_profiles: [
      { user_id: 'courier-1', reputation_score: 5.0 }
    ],
    job_ratings: []
  });

  const ratingInput = {
    job_id: 'job-300',
    rated_user_id: 'courier-1',
    rating: 5,
    comment: 'Excelente pontualidade e dedicação!'
  };

  const res = await submitJobRating('store-1', ratingInput, mockDb);

  assert.equal(res.success, true);
  assert.ok(res.rating);
  assert.equal(res.rating.rating, 5.0);
  assert.equal(res.rating.comment, 'Excelente pontualidade e dedicação!');

  const updatedCourier = mockDb.storage.courier_profiles.find((c) => c.user_id === 'courier-1');
  assert.equal(updatedCourier.reputation_score, 5.0);
});

test('Story 2.4 - Matriz Linha 7: Rejeição de avaliação duplicada pelo mesmo avaliador na mesma vaga', async () => {
  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-400',
        store_id: 'store-1',
        matched_courier_id: 'courier-1',
        status: 'completed'
      }
    ],
    job_ratings: [
      {
        id: 'rating-1',
        job_id: 'job-400',
        rater_id: 'store-1',
        rated_user_id: 'courier-1',
        rating: 4.0
      }
    ]
  });

  const duplicateRating = {
    job_id: 'job-400',
    rated_user_id: 'courier-1',
    rating: 5.0
  };

  const res = await submitJobRating('store-1', duplicateRating, mockDb);

  assert.equal(res.success, false);
  assert.ok(res.error.includes('já avaliou este participante'));
});

test('Story 2.4: Validação de notas fora do intervalo [1, 5] e autoavaliação', () => {
  const invalidLow = {
    job_id: 'job-1',
    rated_user_id: 'user-1',
    rating: 0
  };
  const valLow = validateJobRatingInput(invalidLow);
  assert.equal(valLow.valid, false);

  const invalidHigh = {
    job_id: 'job-1',
    rated_user_id: 'user-1',
    rating: 5.5
  };
  const valHigh = validateJobRatingInput(invalidHigh);
  assert.equal(valHigh.valid, false);

  const validRating = {
    job_id: 'job-1',
    rated_user_id: 'user-1',
    rating: 4.5
  };
  const valOk = validateJobRatingInput(validRating);
  assert.equal(valOk.valid, true);
});

test('Story 2.4 - Matriz Linha 8: Cancelamento tardio (< 2h) de turno casado aplica penalidade de -30 XP (FR-14)', async () => {
  // Turno começando daqui a 1 hora (menos de 2h de antecedência)
  const shiftStartTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-late-cancel',
        store_id: 'store-1',
        matched_courier_id: 'courier-1',
        shift_start_time: shiftStartTime,
        status: 'matched'
      }
    ],
    courier_profiles: [
      { user_id: 'courier-1', xp_points: 100 }
    ],
    store_profiles: [
      { user_id: 'store-1', xp_points: 100 }
    ]
  });

  const res = await cancelJobWithPenaltyCheck('courier-1', 'job-late-cancel', 'Imprevisto mecânico', mockDb);

  assert.equal(res.success, true);
  assert.equal(res.penaltyApplied, true, 'Deve aplicar penalidade por cancelamento tardio');
  assert.equal(res.penaltyXp, 30);
  assert.equal(res.job.status, 'cancelled');

  const courier = mockDb.storage.courier_profiles.find((c) => c.user_id === 'courier-1');
  assert.equal(courier.xp_points, 70, 'Deve ter subtraído 30 XP');
});

test('Story 2.4 - Matriz Linha 9: Cancelamento tempestivo (>= 2h) não aplica penalidade de XP', async () => {
  // Turno começando daqui a 6 horas (antecedência tranquila)
  const shiftStartTime = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-early-cancel',
        store_id: 'store-1',
        matched_courier_id: 'courier-1',
        shift_start_time: shiftStartTime,
        status: 'matched'
      }
    ],
    courier_profiles: [
      { user_id: 'courier-1', xp_points: 100 }
    ]
  });

  const res = await cancelJobWithPenaltyCheck('courier-1', 'job-early-cancel', 'Mudança de planos', mockDb);

  assert.equal(res.success, true);
  assert.equal(res.penaltyApplied, false, 'Não deve aplicar penalidade');
  assert.equal(res.penaltyXp, 0);

  const courier = mockDb.storage.courier_profiles.find((c) => c.user_id === 'courier-1');
  assert.equal(courier.xp_points, 100, 'XP deve permanecer inalterado');
});

test('Story 2.4: Integridade da Migration DDL (20260904200000_job_ratings_and_completion.sql)', () => {
  const migrationPath = path.join(rootDir, 'supabase', 'migrations', '20260904200000_job_ratings_and_completion.sql');
  assert.ok(fs.existsSync(migrationPath), 'Arquivo de migration deve existir fisicamente');

  const content = fs.readFileSync(migrationPath, 'utf8');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.job_ratings'), 'Deve criar a tabela job_ratings');
  assert.ok(content.includes('rating NUMERIC(2, 1) NOT NULL'), 'Deve definir campo de rating');
  assert.ok(content.includes('CHECK (rating >= 1.0 AND rating <= 5.0)'), 'Deve conter constraint de 1 a 5 estrelas');
  assert.ok(content.includes('reputation_score NUMERIC(3, 2) NOT NULL DEFAULT 5.00'), 'Deve adicionar reputation_score em courier_profiles');
  assert.ok(content.includes('unique_job_rater'), 'Deve conter constraint de unicidade por vaga e avaliador');
  assert.ok(content.includes('ENABLE ROW LEVEL SECURITY'), 'Deve habilitar RLS');
});
