import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isJobCompatibleWithModal,
  listOpenJobs,
  submitBid,
  validateJobBidInput
} from '../apps/pwa/src/jobs/job-service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Cria um mock em memória do Supabase com suporte a filtros, queries e persistência de dados.
 */
function createMockSupabase(initialData = {}) {
  const storage = {
    job_posts: initialData.job_posts || [],
    job_bids: initialData.job_bids || []
  };

  return {
    storage,
    from(tableName) {
      const state = {
        table: tableName,
        filters: [],
        containsFilters: [],
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
        contains(col, arr) {
          state.containsFilters.push({ col, arr });
          return chain;
        },
        order() {
          return chain;
        },
        async single() {
          if (state.dataToInsert) {
            const row = {
              id: `bid-uuid-${storage[state.table].length + 1}`,
              created_at: new Date().toISOString(),
              ...state.dataToInsert
            };
            storage[state.table].push(row);
            return { data: row, error: null };
          }
          if (state.dataToUpdate) {
            const found = storage[state.table].find((r) =>
              state.filters.every((f) => r[f.col] === f.val)
            );
            if (found) {
              Object.assign(found, state.dataToUpdate);
              return { data: found, error: null };
            }
          }
          const row = storage[state.table].find((r) =>
            state.filters.every((f) => r[f.col] === f.val)
          );
          if (!row) {
            return { data: null, error: { message: 'Not found' } };
          }
          return { data: row, error: null };
        },
        then(resolve) {
          if (state.dataToUpdate) {
            storage[state.table].forEach((r) => {
              const match = state.filters.every((f) => r[f.col] === f.val);
              if (match) {
                Object.assign(r, state.dataToUpdate);
              }
            });
            resolve({ data: null, error: null });
            return;
          }
          let rows = storage[state.table].filter((r) =>
            state.filters.every((f) => r[f.col] === f.val)
          );
          if (state.containsFilters.length > 0) {
            rows = rows.filter((r) =>
              state.containsFilters.every((c) => {
                const itemVal = r[c.col];
                if (Array.isArray(itemVal)) {
                  return c.arr.every((v) => itemVal.includes(v));
                }
                return false;
              })
            );
          }
          resolve({ data: rows, error: null });
        }
      };

      return chain;
    }
  };
}

// -----------------------------------------------------------------------------
// Testes da Matriz de I/O - Story 2.3
// -----------------------------------------------------------------------------

test('Story 2.3 - Matriz Linha 1: Compatibilidade ergonômica de raio para bicicleta (FR-5)', () => {
  const shortJob = {
    id: 'job-1',
    accepted_modals: ['bicycle', 'motorcycle'],
    delivery_radius_km: 2.5
  };

  const exactJob = {
    id: 'job-2',
    accepted_modals: ['bicycle'],
    delivery_radius_km: 3.0
  };

  const longJob = {
    id: 'job-3',
    accepted_modals: ['bicycle', 'motorcycle'],
    delivery_radius_km: 4.5
  };

  const noBicycleJob = {
    id: 'job-4',
    accepted_modals: ['motorcycle'],
    delivery_radius_km: 2.0
  };

  assert.equal(isJobCompatibleWithModal(shortJob, 'bicycle'), true);
  assert.equal(isJobCompatibleWithModal(exactJob, 'bicycle'), true);
  assert.equal(isJobCompatibleWithModal(longJob, 'bicycle'), false, 'Vaga > 3km deve ser incompatível com bicicleta');
  assert.equal(isJobCompatibleWithModal(noBicycleJob, 'bicycle'), false, 'Vaga sem modal bicicleta deve ser rejeitada');
});

test('Story 2.3 - Matriz Linha 1: Filtragem automática no listOpenJobs para entregador de bicicleta', async () => {
  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-short',
        title: 'Turno Curto Centro',
        status: 'open',
        state_id: 'SP',
        city_id: 'sao-paulo',
        neighborhood_id: 'centro',
        accepted_modals: ['bicycle', 'motorcycle'],
        delivery_radius_km: 2.0,
        offered_daily_rate: 60,
        offered_delivery_fee: 5
      },
      {
        id: 'job-long',
        title: 'Turno Longo Periferia',
        status: 'open',
        state_id: 'SP',
        city_id: 'sao-paulo',
        neighborhood_id: 'centro',
        accepted_modals: ['bicycle', 'motorcycle'],
        delivery_radius_km: 5.5,
        offered_daily_rate: 90,
        offered_delivery_fee: 7
      }
    ]
  });

  const res = await listOpenJobs({
    state_id: 'SP',
    city_id: 'sao-paulo',
    modal: 'bicycle'
  }, mockDb);

  assert.equal(res.success, true);
  assert.equal(res.jobs.length, 1);
  assert.equal(res.jobs[0].id, 'job-short');
  assert.equal(res.jobs[0].delivery_radius_km, 2.0);
});

test('Story 2.3 - Matriz Linha 2: Feed para Motocicleta e E-Bike exibe vagas de longo alcance', async () => {
  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-moto-only',
        title: 'Turno Express Moto',
        status: 'open',
        state_id: 'SP',
        city_id: 'sao-paulo',
        neighborhood_id: 'pinheiros',
        accepted_modals: ['motorcycle'],
        delivery_radius_km: 8.0,
        offered_daily_rate: 100,
        offered_delivery_fee: 8
      },
      {
        id: 'job-ebike-moto',
        title: 'Turno Urbano E-Bike',
        status: 'open',
        state_id: 'SP',
        city_id: 'sao-paulo',
        neighborhood_id: 'pinheiros',
        accepted_modals: ['ebike', 'motorcycle'],
        delivery_radius_km: 5.0,
        offered_daily_rate: 80,
        offered_delivery_fee: 6
      }
    ]
  });

  // Consulta para Motocicleta
  const resMoto = await listOpenJobs({
    state_id: 'SP',
    city_id: 'sao-paulo',
    modal: 'motorcycle'
  }, mockDb);

  assert.equal(resMoto.success, true);
  assert.equal(resMoto.jobs.length, 2, 'Motocicleta deve ter acesso às duas vagas');

  // Consulta para E-Bike
  const resEbike = await listOpenJobs({
    state_id: 'SP',
    city_id: 'sao-paulo',
    modal: 'ebike'
  }, mockDb);

  assert.equal(resEbike.success, true);
  assert.equal(resEbike.jobs.length, 1);
  assert.equal(resEbike.jobs[0].id, 'job-ebike-moto');
});

test('Story 2.3 - Matriz Linha 3: Aceite direto em 1 toque com valor integral e status pending', async () => {
  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-open-1',
        title: 'Turno Noturno Pizzaria',
        status: 'open',
        offered_daily_rate: 80.00,
        offered_delivery_fee: 6.00
      }
    ]
  });

  const directAcceptDTO = {
    job_id: 'job-open-1',
    bid_daily_rate: 80.00,
    bid_delivery_fee: 6.00,
    notes: 'Aceite do valor integral anunciado.'
  };

  const res = await submitBid('courier-123', directAcceptDTO, mockDb);

  assert.equal(res.success, true);
  assert.ok(res.bid);
  assert.equal(res.bid.job_id, 'job-open-1');
  assert.equal(res.bid.courier_id, 'courier-123');
  assert.equal(res.bid.bid_daily_rate, 80.00);
  assert.equal(res.bid.bid_delivery_fee, 6.00);
  assert.equal(res.bid.status, 'pending');
});

test('Story 2.3 - Matriz Linha 4: Submissão de contraproposta com valores customizados (Bid/Ask)', async () => {
  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-open-2',
        title: 'Turno Almoço Hamburgueria',
        status: 'open',
        offered_daily_rate: 70.00,
        offered_delivery_fee: 5.00
      }
    ]
  });

  const counterProposalDTO = {
    job_id: 'job-open-2',
    bid_daily_rate: 90.00,
    bid_delivery_fee: 7.00,
    notes: 'Possuo baú térmico e conheço a região comercial.'
  };

  const res = await submitBid('courier-456', counterProposalDTO, mockDb);

  assert.equal(res.success, true);
  assert.ok(res.bid);
  assert.equal(res.bid.bid_daily_rate, 90.00);
  assert.equal(res.bid.bid_delivery_fee, 7.00);
  assert.equal(res.bid.notes, 'Possuo baú térmico e conheço a região comercial.');
  assert.equal(res.bid.status, 'pending');
});

test('Story 2.3 - Matriz Linha 5: Rejeição de contraproposta com valores negativos', () => {
  const negativeDaily = {
    job_id: 'job-open-1',
    bid_daily_rate: -20.00,
    bid_delivery_fee: 5.00
  };

  const validationDaily = validateJobBidInput(negativeDaily);
  assert.equal(validationDaily.valid, false);
  assert.ok(validationDaily.errors.some(e => e.includes('diária proposta não pode ser negativo')));

  const negativeFee = {
    job_id: 'job-open-1',
    bid_daily_rate: 70.00,
    bid_delivery_fee: -1.00
  };

  const validationFee = validateJobBidInput(negativeFee);
  assert.equal(validationFee.valid, false);
  assert.ok(validationFee.errors.some(e => e.includes('taxa por entrega proposta não pode ser negativa')));
});

test('Story 2.3 - Matriz Linha 6: Rejeição de proposta em vaga já casada (matched)', async () => {
  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-matched-1',
        title: 'Turno Já Preenchido',
        status: 'matched'
      }
    ]
  });

  const bidInput = {
    job_id: 'job-matched-1',
    bid_daily_rate: 80.00,
    bid_delivery_fee: 6.00
  };

  const res = await submitBid('courier-789', bidInput, mockDb);

  assert.equal(res.success, false);
  assert.ok(res.error?.includes('já foi preenchida'));
});

test('Story 2.3 - Matriz Linha 7: Rejeição de proposta em vaga cancelada pelo lojista (cancelled)', async () => {
  const mockDb = createMockSupabase({
    job_posts: [
      {
        id: 'job-cancelled-1',
        title: 'Turno Cancelado',
        status: 'cancelled'
      }
    ]
  });

  const bidInput = {
    job_id: 'job-cancelled-1',
    bid_daily_rate: 80.00,
    bid_delivery_fee: 6.00
  };

  const res = await submitBid('courier-789', bidInput, mockDb);

  assert.equal(res.success, false);
  assert.ok(res.error?.includes('cancelada pelo lojista'));
});

test('Story 2.3: Integridade da Migration DDL de Raio de Entrega (20260904190000_job_posts_radius.sql)', () => {
  const migrationPath = path.join(rootDir, 'supabase', 'migrations', '20260904190000_job_posts_radius.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration de raio deve existir fisicamente');

  const content = fs.readFileSync(migrationPath, 'utf8');
  assert.ok(content.includes('delivery_radius_km NUMERIC(4, 1)'), 'Deve adicionar delivery_radius_km NUMERIC(4, 1)');
  assert.ok(content.includes('DEFAULT 3.0'), 'Deve definir DEFAULT 3.0');
  assert.ok(content.includes('delivery_radius_km > 0'), 'Deve conter check constraint de raio estritamente positivo');
  assert.ok(content.includes('Story: 2.3') || content.includes('FR-5'), 'Deve citar a Story 2.3');
  assert.ok(content.includes('3km'), 'Deve citar o teto de esforço ergonômico de 3km para bicicletas');
});
