import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  calculateAdvanceHours,
  isEligibleForEarlyXpBonus,
  formatJobPushPayload,
  filterCouriersForJob,
  dispatchJobWebPush
} from '../apps/pwa/src/notifications/notification-service.ts';

import {
  validateJobPostInput,
  createJobPost
} from '../apps/pwa/src/jobs/job-service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function createMockSupabase() {
  const storage = {
    job_posts: [],
    store_profiles: [
      {
        user_id: 'store-uuid-1',
        store_name: 'Pizzaria Bella',
        xp_points: 0,
        level: 'Bronze'
      }
    ]
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
          state.filters.push({ col, val });
          return chain;
        },
        async single() {
          if (state.dataToInsert) {
            const row = { id: `gen-uuid-${storage[state.table].length + 1}`, ...state.dataToInsert };
            storage[state.table].push(row);
            return { data: row, error: null };
          }
          if (state.dataToUpdate) {
            const found = storage[state.table].find(r => 
              state.filters.every(f => r[f.col] === f.val)
            );
            if (found) {
              Object.assign(found, state.dataToUpdate);
              return { data: found, error: null };
            }
          }
          const row = storage[state.table].find(r => 
            state.filters.every(f => r[f.col] === f.val)
          );
          if (!row) {
            return { data: null, error: { message: 'Not found' } };
          }
          return { data: row, error: null };
        },
        then(resolve) {
          if (state.dataToUpdate) {
            storage[state.table].forEach(r => {
              const match = state.filters.every(f => r[f.col] === f.val);
              if (match) {
                Object.assign(r, state.dataToUpdate);
              }
            });
            resolve({ data: null, error: null });
            return;
          }
          const rows = storage[state.table].filter(r => 
            state.filters.every(f => r[f.col] === f.val)
          );
          resolve({ data: rows, error: null });
        }
      };

      return chain;
    }
  };
}

test('Story 2.2: Integridade da Migration DDL (20260904180000_store_profiles_xp.sql)', () => {
  const migrationPath = path.join(
    rootDir,
    'supabase/migrations/20260904180000_store_profiles_xp.sql'
  );
  assert.equal(fs.existsSync(migrationPath), true, 'Migration SQL file must exist');

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // Adição de colunas xp_points e level em store_profiles
  assert.match(sql, /ALTER TABLE public\.store_profiles/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS xp_points INTEGER NOT NULL DEFAULT 0/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS level VARCHAR\(20\) NOT NULL DEFAULT 'Bronze'/i);

  // Constraints e checks
  assert.match(sql, /CONSTRAINT check_store_xp_points CHECK \(xp_points >= 0\)/i);
  assert.match(sql, /CONSTRAINT check_store_level CHECK \(level IN \('Bronze', 'Prata', 'Ouro'\)\)/i);

  // Trigger e função de antecedência (>48h)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.award_early_job_post_xp\(\)/i);
  assert.match(sql, /advance_interval >= INTERVAL '48 hours'/i);
  assert.match(sql, /xp_points = xp_points \+ 50/i);
  assert.match(sql, /CREATE TRIGGER trg_award_early_job_post_xp/i);
});

test('Story 2.2 - Matriz Linha 1: Publicação com antecedência > 48h concede +50 XP (FR-14)', async () => {
  const mockDb = createMockSupabase();

  // Define data de início para daqui a 72 horas (>48h)
  const futureStart = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const futureEnd = new Date(Date.now() + 77 * 60 * 60 * 1000).toISOString();

  // Teste utilitário de cálculo de horas
  const advanceHours = calculateAdvanceHours(futureStart);
  assert.ok(advanceHours >= 71.9, 'Deve calcular ~72 horas de antecedência');
  assert.equal(isEligibleForEarlyXpBonus(futureStart), true);

  const result = await createJobPost(
    'store-uuid-1',
    {
      shift_start_time: futureStart,
      shift_end_time: futureEnd,
      offered_daily_rate: 90,
      offered_delivery_fee: 7,
      accepted_modals: ['motorcycle'],
      state_id: 'SP',
      city_id: 'sao-paulo',
      neighborhood_id: 'pinheiros'
    },
    mockDb,
    'Pizzaria Bella'
  );

  assert.equal(result.success, true);
  assert.equal(result.earnedXpBonus, true, 'Deve indicar que ganhou o bônus de XP');

  // Verifica se o XP do lojista no banco aumentou em 50
  const store = mockDb.storage.store_profiles.find(s => s.user_id === 'store-uuid-1');
  assert.equal(store.xp_points, 50, 'Lojista deve ter 50 XP acumulados');
  assert.equal(store.level, 'Bronze');
});

test('Story 2.2 - Matriz Linha 2: Publicação emergencial (< 48h) não concede bônus de XP', async () => {
  const mockDb = createMockSupabase();

  // Define data de início para daqui a 12 horas (<48h)
  const soonStart = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const soonEnd = new Date(Date.now() + 17 * 60 * 60 * 1000).toISOString();

  assert.equal(isEligibleForEarlyXpBonus(soonStart), false);

  const result = await createJobPost(
    'store-uuid-1',
    {
      shift_start_time: soonStart,
      shift_end_time: soonEnd,
      offered_daily_rate: 80,
      offered_delivery_fee: 6,
      accepted_modals: ['motorcycle'],
      state_id: 'SP',
      city_id: 'sao-paulo',
      neighborhood_id: 'pinheiros'
    },
    mockDb,
    'Pizzaria Bella'
  );

  assert.equal(result.success, true);
  assert.equal(result.earnedXpBonus, false, 'Não deve pontuar XP para <48h');

  // XP permanece inalterado (0)
  const store = mockDb.storage.store_profiles.find(s => s.user_id === 'store-uuid-1');
  assert.equal(store.xp_points, 0);
});

test('Story 2.2 - Matriz Linha 3: Filtragem de destinatários push por modal de transporte', () => {
  const sampleJob = {
    id: 'job-sp-1',
    store_id: 'store-1',
    shift_start_time: '2026-09-06T18:00:00Z',
    shift_end_time: '2026-09-06T23:00:00Z',
    offered_daily_rate: 85,
    offered_delivery_fee: 6.5,
    accepted_modals: ['motorcycle'], // Somente moto!
    state_id: 'SP',
    city_id: 'sao-paulo',
    neighborhood_id: 'pinheiros',
    status: 'open'
  };

  const couriersList = [
    {
      userId: 'courier-moto',
      stateId: 'SP',
      cityId: 'sao-paulo',
      homeNeighborhoodId: 'pinheiros',
      transportModal: 'motorcycle'
    },
    {
      userId: 'courier-bike',
      stateId: 'SP',
      cityId: 'sao-paulo',
      homeNeighborhoodId: 'pinheiros',
      transportModal: 'bicycle' // Incompatível com a vaga!
    }
  ];

  const matched = filterCouriersForJob(couriersList, sampleJob);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].userId, 'courier-moto');
  assert.equal(matched.some(c => c.userId === 'courier-bike'), false, 'Motoboy de bicicleta não deve receber push');
});

test('Story 2.2 - Matriz Linha 4: Filtragem de destinatários push por geografia hiperlocal', () => {
  const sampleJob = {
    id: 'job-sp-1',
    store_id: 'store-1',
    shift_start_time: '2026-09-06T18:00:00Z',
    shift_end_time: '2026-09-06T23:00:00Z',
    offered_daily_rate: 85,
    offered_delivery_fee: 6.5,
    accepted_modals: ['motorcycle', 'bicycle'],
    state_id: 'SP',
    city_id: 'sao-paulo',
    neighborhood_id: 'pinheiros', // Bairro Pinheiros
    status: 'open'
  };

  const couriersList = [
    {
      userId: 'courier-pinheiros',
      stateId: 'SP',
      cityId: 'sao-paulo',
      homeNeighborhoodId: 'pinheiros', // Mesmo bairro
      transportModal: 'motorcycle'
    },
    {
      userId: 'courier-tatuape',
      stateId: 'SP',
      cityId: 'sao-paulo',
      homeNeighborhoodId: 'tatuape', // Outro bairro distante
      transportModal: 'motorcycle'
    },
    {
      userId: 'courier-rj',
      stateId: 'RJ', // Outro estado
      cityId: 'rio-de-janeiro',
      homeNeighborhoodId: 'copacabana',
      transportModal: 'motorcycle'
    }
  ];

  const matched = filterCouriersForJob(couriersList, sampleJob);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].userId, 'courier-pinheiros');
});

test('Story 2.2 - Matriz Linha 5 & 6: Rejeição de horários invertidos e valores negativos', () => {
  // Horário invertido
  const res1 = validateJobPostInput({
    shift_start_time: '2026-09-06T23:00:00Z',
    shift_end_time: '2026-09-06T18:00:00Z',
    offered_daily_rate: 80,
    offered_delivery_fee: 6,
    accepted_modals: ['motorcycle'],
    state_id: 'SP',
    city_id: 'sao-paulo',
    neighborhood_id: 'pinheiros'
  });
  assert.equal(res1.valid, false);
  assert.match(res1.errors[0], /horário de término do turno deve ser posterior ao horário de início/i);

  // Diária negativa
  const res2 = validateJobPostInput({
    shift_start_time: '2026-09-06T18:00:00Z',
    shift_end_time: '2026-09-06T23:00:00Z',
    offered_daily_rate: -10,
    offered_delivery_fee: 6,
    accepted_modals: ['motorcycle'],
    state_id: 'SP',
    city_id: 'sao-paulo',
    neighborhood_id: 'pinheiros'
  });
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.some(e => e.includes('diária ofertada não pode ser negativo')));
});

test('Story 2.2 - Matriz Linha 7: Despacho Web Push com latência < 3s e isolamento de contatos (NFR-2, AD-10)', async () => {
  const sampleJob = {
    id: 'job-123',
    store_id: 'store-1',
    shift_start_time: '2026-09-07T18:00:00Z',
    shift_end_time: '2026-09-07T23:00:00Z',
    offered_daily_rate: 90,
    offered_delivery_fee: 7,
    accepted_modals: ['motorcycle'],
    state_id: 'SP',
    city_id: 'sao-paulo',
    neighborhood_id: 'pinheiros',
    status: 'open'
  };

  const couriers = [
    {
      userId: 'c-1',
      stateId: 'SP',
      cityId: 'sao-paulo',
      homeNeighborhoodId: 'pinheiros',
      transportModal: 'motorcycle'
    }
  ];

  const dispatchResult = await dispatchJobWebPush(sampleJob, 'Pizzaria Bella', couriers);
  assert.equal(dispatchResult.success, true);
  assert.equal(dispatchResult.targetsMatched, 1);
  assert.ok(dispatchResult.latencyMs < 3000, `Latência deve ser menor que 3000ms (foi ${dispatchResult.latencyMs}ms)`);

  // Proteção de privacidade: o payload do push NÃO deve conter telefone da loja
  const payloadStr = JSON.stringify(dispatchResult.payload);
  assert.equal(payloadStr.includes('phone_number'), false, 'Push não deve expor phone_number');
  assert.equal(payloadStr.includes('store_phone_number'), false);
  assert.match(dispatchResult.payload.title, /Nova Vaga em Pinheiros/i);
});
