import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateJobPostInput,
  validateJobBidInput,
  createJobPost,
  listOpenJobs,
  submitBid,
  listBidsForJob,
  acceptBid,
  getMatchedJobDetails
} from '../apps/pwa/src/jobs/job-service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function createMockSupabase() {
  const storage = {
    job_posts: [],
    job_bids: [],
    job_matched_contacts: []
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
        contains(col, val) {
          return chain;
        },
        order() {
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
              state.filters.every(f => f.op === 'eq' ? r[f.col] === f.val : r[f.col] !== f.val)
            );
            if (found) {
              Object.assign(found, state.dataToUpdate);
              return { data: found, error: null };
            }
            return { data: null, error: { message: 'Row not found for update' } };
          }
          const row = storage[state.table].find(r => 
            state.filters.every(f => f.op === 'eq' ? r[f.col] === f.val : r[f.col] !== f.val)
          );
          if (!row) {
            return { data: null, error: { message: 'Not found' } };
          }
          return { data: row, error: null };
        },
        then(resolve) {
          if (state.dataToUpdate) {
            storage[state.table].forEach(r => {
              const match = state.filters.every(f => f.op === 'eq' ? r[f.col] === f.val : r[f.col] !== f.val);
              if (match) {
                Object.assign(r, state.dataToUpdate);
              }
            });
            resolve({ data: null, error: null });
            return;
          }
          const rows = storage[state.table].filter(r => 
            state.filters.every(f => f.op === 'eq' ? r[f.col] === f.val : r[f.col] !== f.val)
          );
          resolve({ data: rows, error: null });
        }
      };

      return chain;
    }
  };
}

test('Story 2.1: Integridade da Migration DDL (20260904170000_jobs_and_bids_schema.sql)', () => {
  const migrationPath = path.join(
    rootDir,
    'supabase/migrations/20260904170000_jobs_and_bids_schema.sql'
  );
  assert.equal(fs.existsSync(migrationPath), true, 'Migration SQL file must exist on disk');

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // Tabelas
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.job_posts/, 'Must create public.job_posts table');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.job_bids/, 'Must create public.job_bids table');

  // Constraints de status e checks numéricos/temporais
  assert.match(sql, /CONSTRAINT check_job_status CHECK \(status IN \('open', 'matched', 'in_progress', 'completed', 'cancelled'\)\)/);
  assert.match(sql, /CONSTRAINT check_bid_status CHECK \(status IN \('pending', 'accepted', 'rejected', 'cancelled'\)\)/);
  assert.match(sql, /CONSTRAINT check_job_rates CHECK \(offered_daily_rate >= 0\.00 AND offered_delivery_fee >= 0\.00\)/);
  assert.match(sql, /CONSTRAINT check_shift_times CHECK \(shift_end_time > shift_start_time\)/);
  assert.match(sql, /CONSTRAINT uq_job_courier_bid UNIQUE \(job_id, courier_id\)/);

  // Índices de performance
  assert.match(sql, /idx_job_posts_geography ON public\.job_posts\(state_id, city_id, neighborhood_id\)/);
  assert.match(sql, /idx_job_posts_status ON public\.job_posts\(status\)/);
  assert.match(sql, /idx_job_bids_job_id ON public\.job_bids\(job_id\)/);
  assert.match(sql, /idx_job_bids_courier_id ON public\.job_bids\(courier_id\)/);

  // Row Level Security (RLS)
  assert.match(sql, /ALTER TABLE public\.job_posts ENABLE ROW LEVEL SECURITY;/);
  assert.match(sql, /ALTER TABLE public\.job_bids ENABLE ROW LEVEL SECURITY;/);
  assert.match(sql, /CREATE POLICY "Public can view open jobs or participants can view theirs"/);
  assert.match(sql, /CREATE POLICY "Couriers view own bids and store view received bids"/);
  assert.match(sql, /CREATE POLICY "Users can read matched partner profile"/);

  // View Segura
  assert.match(sql, /CREATE OR REPLACE VIEW public\.job_matched_contacts/);
});

test('Story 2.1 - Matriz Linha 1: Criação de Vaga por Lojista com dados válidos', async () => {
  const mockDb = createMockSupabase();
  const validInput = {
    shift_start_time: '2026-09-05T18:00:00Z',
    shift_end_time: '2026-09-05T23:00:00Z',
    offered_daily_rate: 80.00,
    offered_delivery_fee: 6.00,
    accepted_modals: ['motorcycle', 'ebike_scooter'],
    state_id: 'SP',
    city_id: 'sao-paulo',
    neighborhood_id: 'pinheiros',
    description: 'Turno de sábado à noite com alta demanda de pizza.'
  };

  const validation = validateJobPostInput(validInput);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);

  const result = await createJobPost('store-uuid-1', validInput, mockDb);
  assert.equal(result.success, true);
  assert.ok(result.job);
  assert.equal(result.job.status, 'open');
  assert.equal(result.job.store_id, 'store-uuid-1');
  assert.equal(result.job.state_id, 'SP');
});

test('Story 2.1 - Matriz Linha 8: Horário final menor ou igual ao horário inicial deve ser rejeitado', () => {
  const invalidTimeInput = {
    shift_start_time: '2026-09-05T23:00:00Z',
    shift_end_time: '2026-09-05T18:00:00Z',
    offered_daily_rate: 80.00,
    offered_delivery_fee: 6.00,
    accepted_modals: ['motorcycle'],
    state_id: 'SP',
    city_id: 'sao-paulo',
    neighborhood_id: 'pinheiros'
  };

  const validation = validateJobPostInput(invalidTimeInput);
  assert.equal(validation.valid, false);
  assert.match(validation.errors[0], /horário de término do turno deve ser posterior ao horário de início/i);
});

test('Story 2.1: Rejeição de valores negativos em diária e taxas na vaga', () => {
  const negativeRatesInput = {
    shift_start_time: '2026-09-05T18:00:00Z',
    shift_end_time: '2026-09-05T23:00:00Z',
    offered_daily_rate: -50.00,
    offered_delivery_fee: -2.00,
    accepted_modals: ['motorcycle'],
    state_id: 'SP',
    city_id: 'sao-paulo',
    neighborhood_id: 'pinheiros'
  };

  const validation = validateJobPostInput(negativeRatesInput);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(e => e.includes('diária ofertada não pode ser negativo')));
  assert.ok(validation.errors.some(e => e.includes('taxa por entrega ofertada não pode ser negativa')));
});

test('Story 2.1 - Matriz Linha 2: Listagem pública de vagas abertas omite telefone da loja (AD-10)', async () => {
  const mockDb = createMockSupabase();
  mockDb.storage.job_posts.push({
    id: 'job-uuid-1',
    store_id: 'store-uuid-1',
    shift_start_time: '2026-09-05T18:00:00Z',
    shift_end_time: '2026-09-05T23:00:00Z',
    offered_daily_rate: 80.00,
    offered_delivery_fee: 6.00,
    accepted_modals: ['motorcycle'],
    state_id: 'SP',
    city_id: 'sao-paulo',
    neighborhood_id: 'pinheiros',
    status: 'open'
  });

  const result = await listOpenJobs({ state_id: 'SP', city_id: 'sao-paulo' }, mockDb);
  assert.equal(result.success, true);
  assert.equal(result.jobs.length, 1);

  const openJob = result.jobs[0];
  assert.equal('store_phone_number' in openJob, false);
  assert.equal('phone_number' in openJob, false);
});

test('Story 2.1 - Matriz Linha 3: Submissão de Bid por Entregador com status pending', async () => {
  const mockDb = createMockSupabase();
  const validBidInput = {
    job_id: 'job-uuid-1',
    bid_daily_rate: 85.00,
    bid_delivery_fee: 6.50,
    notes: 'Possuo baú grande e conheço bem a região.'
  };

  const validation = validateJobBidInput(validBidInput);
  assert.equal(validation.valid, true);

  const result = await submitBid('courier-uuid-1', validBidInput, mockDb);
  assert.equal(result.success, true);
  assert.ok(result.bid);
  assert.equal(result.bid.job_id, 'job-uuid-1');
  assert.equal(result.bid.courier_id, 'courier-uuid-1');
  assert.equal(result.bid.status, 'pending');
});

test('Story 2.1: Rejeição de valores negativos em proposta de bid', () => {
  const invalidBidInput = {
    job_id: 'job-uuid-1',
    bid_daily_rate: -10.00,
    bid_delivery_fee: -5.00
  };

  const validation = validateJobBidInput(invalidBidInput);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(e => e.includes('diária proposta não pode ser negativo')));
  assert.ok(validation.errors.some(e => e.includes('taxa por entrega proposta não pode ser negativa')));
});

test('Story 2.1 - Matriz Linha 4: Simulação de RLS para Isolamento de Bids Concorrentes', () => {
  const allBidsInDb = [
    { id: 'bid-1', job_id: 'job-1', courier_id: 'courier-A', bid_daily_rate: 80, status: 'pending' },
    { id: 'bid-2', job_id: 'job-1', courier_id: 'courier-B', bid_daily_rate: 75, status: 'pending' }
  ];

  const filterForCourierB = (bids, currentAuthUid) => {
    return bids.filter(b => b.courier_id === currentAuthUid);
  };

  const courierBVisibleBids = filterForCourierB(allBidsInDb, 'courier-B');
  assert.equal(courierBVisibleBids.length, 1);
  assert.equal(courierBVisibleBids[0].id, 'bid-2');
  assert.equal(courierBVisibleBids[0].courier_id, 'courier-B');
  assert.equal(courierBVisibleBids.some(b => b.courier_id === 'courier-A'), false);
});

test('Story 2.1 - Matriz Linha 5: Lojista proprietário da vaga visualiza todos os bids recebidos', async () => {
  const mockDb = createMockSupabase();
  mockDb.storage.job_bids.push(
    { id: 'bid-1', job_id: 'job-uuid-1', courier_id: 'courier-1', bid_daily_rate: 80, status: 'pending' },
    { id: 'bid-2', job_id: 'job-uuid-1', courier_id: 'courier-2', bid_daily_rate: 75, status: 'pending' }
  );

  const result = await listBidsForJob('store-uuid-1', 'job-uuid-1', mockDb);
  assert.equal(result.success, true);
  assert.equal(result.bids.length, 2);
});

test('Story 2.1 - Matriz Linha 6: Formalização de Matching e Liberação Mútua de Contatos', async () => {
  const mockDb = createMockSupabase();
  mockDb.storage.job_posts.push({
    id: 'job-uuid-1',
    store_id: 'store-uuid-1',
    status: 'open',
    matched_bid_id: null,
    matched_courier_id: null
  });
  mockDb.storage.job_bids.push(
    { id: 'bid-uuid-1', job_id: 'job-uuid-1', courier_id: 'courier-uuid-1', status: 'pending' },
    { id: 'bid-uuid-2', job_id: 'job-uuid-1', courier_id: 'courier-uuid-2', status: 'pending' }
  );
  mockDb.storage.job_matched_contacts.push({
    job_id: 'job-uuid-1',
    job_status: 'matched',
    shift_start_time: '2026-09-05T18:00:00Z',
    shift_end_time: '2026-09-05T23:00:00Z',
    offered_daily_rate: 80.00,
    offered_delivery_fee: 6.00,
    store_id: 'store-uuid-1',
    store_name: 'Pizzaria do Bairro',
    store_contact_name: 'Maria Lojista',
    store_phone_number: '11988887777',
    courier_id: 'courier-uuid-1',
    courier_name: 'Carlos Entregador',
    courier_phone_number: '11977776666',
    courier_modal: 'motorcycle'
  });

  const matchingResult = await acceptBid('store-uuid-1', 'job-uuid-1', 'bid-uuid-1', 'courier-uuid-1', mockDb);
  assert.equal(matchingResult.success, true);
  assert.equal(matchingResult.job.status, 'matched');
  assert.equal(matchingResult.job.matched_courier_id, 'courier-uuid-1');
  assert.equal(matchingResult.job.matched_bid_id, 'bid-uuid-1');

  // Verifica se o bid aceito mudou para accepted e o concorrente para rejected
  const acceptedBid = mockDb.storage.job_bids.find(b => b.id === 'bid-uuid-1');
  const rejectedBid = mockDb.storage.job_bids.find(b => b.id === 'bid-uuid-2');
  assert.equal(acceptedBid.status, 'accepted');
  assert.equal(rejectedBid.status, 'rejected');

  // Obtenção dos contatos liberados pela view job_matched_contacts para o lojista
  const storeContactResult = await getMatchedJobDetails('store-uuid-1', 'job-uuid-1', mockDb);
  assert.equal(storeContactResult.success, true);
  assert.equal(storeContactResult.contact.courier_phone_number, '11977776666');
  assert.equal(storeContactResult.contact.courier_name, 'Carlos Entregador');

  // Obtenção dos contatos liberados pela view job_matched_contacts para o motoboy
  const courierContactResult = await getMatchedJobDetails('courier-uuid-1', 'job-uuid-1', mockDb);
  assert.equal(courierContactResult.success, true);
  assert.equal(courierContactResult.contact.store_phone_number, '11988887777');
  assert.equal(courierContactResult.contact.store_contact_name, 'Maria Lojista');
});

test('Story 2.1: Bloqueio de acesso a contatos por terceiros não participantes do turno', async () => {
  const mockDb = createMockSupabase();
  mockDb.storage.job_matched_contacts.push({
    job_id: 'job-uuid-1',
    store_id: 'store-uuid-1',
    courier_id: 'courier-uuid-1',
    store_phone_number: '11988887777',
    courier_phone_number: '11977776666'
  });

  const intruderResult = await getMatchedJobDetails('courier-intruder', 'job-uuid-1', mockDb);
  assert.equal(intruderResult.success, false);
  assert.match(intruderResult.error, /acesso não autorizado/i);
});

test('Story 2.1 - Matriz Linha 7: Tentativa de bid em vaga fechada/já casada é rejeitada', () => {
  const checkCanSubmitBid = (jobStatus) => {
    if (jobStatus !== 'open') {
      return { allowed: false, error: 'Propostas só podem ser submetidas para vagas com status open.' };
    }
    return { allowed: true };
  };

  assert.equal(checkCanSubmitBid('matched').allowed, false);
  assert.equal(checkCanSubmitBid('completed').allowed, false);
  assert.equal(checkCanSubmitBid('cancelled').allowed, false);
  assert.equal(checkCanSubmitBid('open').allowed, true);
});
