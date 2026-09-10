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
  cancelJobWithPenaltyCheck,
  getPendingJobReviews
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
        inFilters: [],
        orExpr: null,
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
        in(col, vals) {
          state.inFilters.push({ col, vals });
          return chain;
        },
        or(expr) {
          state.orExpr = expr;
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
        async maybeSingle() {
          const row = (storage[state.table] || []).find((r) =>
            state.filters.every((f) => (f.op === 'neq' ? r[f.col] !== f.val : r[f.col] === f.val))
          );
          return { data: row || null, error: null };
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

          let rows = storage[state.table] || [];
          if (state.filters.length > 0) {
            rows = rows.filter((r) =>
              state.filters.every((f) => (f.op === 'neq' ? r[f.col] !== f.val : r[f.col] === f.val))
            );
          }
          if (state.inFilters && state.inFilters.length > 0) {
            rows = rows.filter((r) =>
              state.inFilters.every((f) => f.vals.includes(r[f.col]))
            );
          }
          if (state.orExpr) {
            const parts = state.orExpr.split(',');
            rows = rows.filter((r) => {
              return parts.some((p) => {
                const [col, _op, val] = p.split('.');
                return r[col] === val;
              });
            });
          }
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

test('Story 2.4 / CAP-3: Integridade da Migration DDL de Conclusão Bilateral e Avaliação Cega (20260910170000_bilateral_job_completion_and_ratings.sql)', () => {
  const migrationPath = path.join(rootDir, 'supabase', 'migrations', '20260910170000_bilateral_job_completion_and_ratings.sql');
  assert.ok(fs.existsSync(migrationPath), 'Arquivo de migration deve existir fisicamente');

  const content = fs.readFileSync(migrationPath, 'utf8');
  assert.ok(content.includes('criteria JSONB NOT NULL DEFAULT'), 'Deve conter coluna criteria em job_ratings');
  assert.ok(content.includes('idx_job_ratings_criteria'), 'Deve conter índice GIN para criteria');
  assert.ok(content.includes('Blind rating visibility on job_ratings'), 'Deve implementar política RLS de Avaliação Cega');
  assert.ok(content.includes("shift_end_time + interval '6 hours'"), 'Deve conter tolerância de 6 horas pós-término');
});

test('Story 2.4: Submissão de avaliação com critérios selecionados e bonificação de +10 XP para o avaliador', async () => {
  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-review-xp',
        store_id: 'store-1',
        matched_courier_id: 'courier-1',
        shift_end_time: new Date(Date.now() - 3600000).toISOString(),
        status: 'matched'
      }
    ],
    store_profiles: [
      { user_id: 'store-1', xp_points: 50, reputation_score: 5.0 }
    ],
    courier_profiles: [
      { user_id: 'courier-1', xp_points: 80, reputation_score: 5.0 }
    ]
  });

  // Lojista avalia o entregador com critérios
  const resStore = await submitJobRating('store-1', {
    job_id: 'job-review-xp',
    rated_user_id: 'courier-1',
    rating: 4.8,
    comment: 'Excelente atendimento e agilidade.',
    criteria: { punctuality: true, care: true, courtesy: true }
  }, mockDb);

  assert.equal(resStore.success, true);
  assert.equal(resStore.earnedXp, 10, 'Deve conceder +10 XP ao avaliador');
  assert.equal(resStore.rating.criteria.punctuality, true);
  assert.equal(resStore.rating.criteria.care, true);

  const store = mockDb.storage.store_profiles.find(s => s.user_id === 'store-1');
  assert.equal(store.xp_points, 60, 'Lojista deve ter recebido +10 XP pelo feedback');

  // Entregador avalia a loja com critérios
  const resCourier = await submitJobRating('courier-1', {
    job_id: 'job-review-xp',
    rated_user_id: 'store-1',
    rating: 5.0,
    comment: 'Ótima recepção e comida rápida.',
    criteria: { hospitality: true, speed: true }
  }, mockDb);

  assert.equal(resCourier.success, true);
  assert.equal(resCourier.earnedXp, 10, 'Entregador deve receber +10 XP');

  const courier = mockDb.storage.courier_profiles.find(c => c.user_id === 'courier-1');
  assert.equal(courier.xp_points, 90, 'Entregador deve ter recebido +10 XP pelo feedback');

  // Ambos avaliaram: o turno deve ter transitado para completed
  const job = mockDb.storage.job_posts.find(j => j.id === 'job-review-xp');
  assert.equal(job.status, 'completed', 'Turno deve transitar para completed após avaliação mútua de duas vias');
});

test('Story 2.4: Consulta de avaliações de turnos pendentes (getPendingJobReviews)', async () => {
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const futureHour = new Date(Date.now() + 3600000).toISOString();

  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-ended-unrated',
        store_id: 'store-1',
        matched_courier_id: 'courier-1',
        shift_end_time: oneHourAgo,
        status: 'matched'
      }
    ],
    courier_profiles: [
      { user_id: 'courier-1', xp_points: 100 }
    ],
    job_matched_contacts: [
      {
        job_id: 'job-ended-unrated',
        job_status: 'matched',
        shift_start_time: new Date(Date.now() - 7200000).toISOString(),
        shift_end_time: oneHourAgo,
        offered_daily_rate: 100,
        offered_delivery_fee: 7,
        store_id: 'store-1',
        store_name: 'Pizzaria Bella',
        courier_id: 'courier-1',
        courier_name: 'João Motoboy'
      },
      {
        job_id: 'job-future',
        job_status: 'matched',
        shift_start_time: oneHourAgo,
        shift_end_time: futureHour,
        offered_daily_rate: 90,
        offered_delivery_fee: 6,
        store_id: 'store-1',
        store_name: 'Pizzaria Bella',
        courier_id: 'courier-1',
        courier_name: 'João Motoboy'
      }
    ],
    job_ratings: []
  });

  // O entregador consulta seus turnos pendentes de avaliação
  const res = await getPendingJobReviews('courier-1', mockDb);
  assert.equal(res.success, true);
  assert.equal(res.pending.length, 1, 'Apenas o turno cujo término previsto já passou deve constar');
  assert.equal(res.pending[0].job_id, 'job-ended-unrated');
  assert.equal(res.pending[0].partner_name, 'Pizzaria Bella');
  assert.equal(res.pending[0].partner_role, 'store');

  // Após submeter a avaliação, a lista de pendentes deve ficar vazia
  await submitJobRating('courier-1', {
    job_id: 'job-ended-unrated',
    rated_user_id: 'store-1',
    rating: 5.0
  }, mockDb);

  const resAfter = await getPendingJobReviews('courier-1', mockDb);
  assert.equal(resAfter.success, true);
  assert.equal(resAfter.pending.length, 0, 'Não deve mais constar como pendente');
});

test('Story 2.4: Resiliência de schema cache e fallback em submitJobRating', async () => {
  let firstInsertAttempted = false;
  let fallbackInsertPayload = null;

  const simulatedDb = {
    storage: {
      job_posts: [
        {
          id: 'job-cache-test',
          store_id: 'store-1',
          matched_courier_id: 'courier-1',
          shift_end_time: new Date(Date.now() - 3600000).toISOString(),
          status: 'matched'
        }
      ],
      courier_profiles: [{ user_id: 'courier-1', xp_points: 50 }],
      store_profiles: [{ user_id: 'store-1', xp_points: 50 }],
      job_ratings: []
    },
    from(table) {
      if (table === 'job_ratings') {
        return {
          insert(payload) {
            return {
              select() {
                return {
                  async single() {
                    if (!firstInsertAttempted && payload.criteria) {
                      firstInsertAttempted = true;
                      return {
                        data: null,
                        error: { message: "Could not find the 'criteria' column of 'job_ratings' in the schema cache" }
                      };
                    }
                    fallbackInsertPayload = payload;
                    return {
                      data: { id: 'rating-fallback-1', ...payload, created_at: new Date().toISOString() },
                      error: null
                    };
                  }
                };
              }
            };
          },
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async maybeSingle() {
                        return { data: null, error: null };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }

      if (table === 'job_posts') {
        return {
          select() {
            return {
              eq() {
                return {
                  async single() {
                    return { data: simulatedDb.storage.job_posts[0], error: null };
                  }
                };
              }
            };
          }
        };
      }

      if (table === 'store_profiles') {
        return {
          select() {
            return {
              eq() {
                return {
                  async single() {
                    return { data: simulatedDb.storage.store_profiles[0], error: null };
                  }
                };
              }
            };
          },
          update() {
            return {
              eq() {
                return Promise.resolve({ error: null });
              }
            };
          }
        };
      }

      return {
        select() { return this; },
        eq() { return this; },
        async single() { return { data: null, error: null }; }
      };
    }
  };

  const res = await submitJobRating('store-1', {
    job_id: 'job-cache-test',
    rated_user_id: 'courier-1',
    rating: 5.0,
    comment: 'Ótimo serviço!',
    criteria: { punctuality: true }
  }, simulatedDb);

  assert.equal(res.success, true, 'Deve ter sucesso recuperando do erro de cache de schema');
  assert.equal(firstInsertAttempted, true, 'Primeira tentativa deve ter ocorrido e acionado o fallback');
  assert.equal(fallbackInsertPayload.criteria, undefined, 'Payload de fallback deve ter removido criteria');
});

test('Story 2.4: Integridade da Migration 20260910170000_bilateral_job_completion_and_ratings.sql', () => {
  const migrationPath = path.join(rootDir, 'supabase', 'migrations', '20260910170000_bilateral_job_completion_and_ratings.sql');
  assert.equal(fs.existsSync(migrationPath), true, 'Arquivo de migration deve existir');

  const content = fs.readFileSync(migrationPath, 'utf8');
  assert.match(content, /ALTER TABLE public\.job_ratings/i);
  assert.match(content, /ADD COLUMN IF NOT EXISTS criteria JSONB/i);
  assert.match(content, /idx_job_ratings_criteria/i);
  assert.match(content, /CREATE OR REPLACE FUNCTION public\.check_user_rated_job/i);
  assert.match(content, /CREATE POLICY "Blind rating visibility on job_ratings"/i);
});


