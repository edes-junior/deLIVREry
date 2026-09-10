import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  listBidsForJob,
  getMatchedJobDetails
} from '../apps/pwa/src/jobs/job-service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Cria mock do Supabase com suporte a tabelas e views enriquecidas (Story 3 / CAP-3).
 */
function createMockDb(initialData = {}) {
  const storage = {
    job_posts: initialData.job_posts || [],
    job_bids: initialData.job_bids || [],
    job_bids_with_couriers: initialData.job_bids_with_couriers || [],
    job_matched_contacts: initialData.job_matched_contacts || [],
    users: initialData.users || [],
    courier_profiles: initialData.courier_profiles || [],
    store_profiles: initialData.store_profiles || []
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
          const rows = (storage[state.table] || []).filter((r) =>
            state.filters.every((f) =>
              f.op === 'neq' ? r[f.col] !== f.val : r[f.col] === f.val
            )
          );
          if (rows.length === 0) {
            return { data: null, error: { message: 'Row not found' } };
          }
          return { data: rows[0], error: null };
        },
        then(resolve) {
          if (!storage[state.table]) {
            resolve({ data: null, error: { message: `Table/View ${state.table} not found` } });
            return;
          }

          const rows = storage[state.table].filter((r) =>
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
// Testes da História 3 (CAP-3, AD-10): Visualização de Avatares dos Entregadores
// -----------------------------------------------------------------------------

test('Story 3 - Migration SQL de Avatares e Propostas: Validação Estrutural', () => {
  const migrationPath = path.join(
    rootDir,
    'supabase',
    'migrations',
    '20260909220000_bids_and_matched_courier_avatars.sql'
  );

  assert.ok(fs.existsSync(migrationPath), 'Migration 20260909220000 deve existir.');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // Verifica criação da view job_bids_with_couriers
  assert.ok(
    sql.includes('CREATE OR REPLACE VIEW public.job_bids_with_couriers'),
    'Deve definir a view segura job_bids_with_couriers.'
  );
  assert.ok(
    sql.includes('u.avatar_url AS courier_avatar_url'),
    'Deve selecionar o avatar_url do entregador.'
  );
  assert.ok(
    sql.includes('cp.transport_modal AS courier_modal'),
    'Deve selecionar o modal de transporte do entregador.'
  );
  assert.ok(
    sql.includes('cp.level AS courier_level'),
    'Deve selecionar o nível de reputação do entregador.'
  );

  // Verifica enriquecimento da view job_matched_contacts
  assert.ok(
    sql.includes('CREATE OR REPLACE VIEW public.job_matched_contacts'),
    'Deve atualizar a view job_matched_contacts.'
  );
  assert.ok(
    sql.includes('u_courier.avatar_url AS courier_avatar_url'),
    'Deve incluir courier_avatar_url em job_matched_contacts.'
  );
  assert.ok(
    sql.includes('u_store.avatar_url AS store_avatar_url'),
    'Deve incluir store_avatar_url em job_matched_contacts.'
  );

  // Verifica RLS para visualização de perfis públicos dos proponentes pelo lojista
  assert.ok(
    sql.includes('Stores can read public profiles of bidders'),
    'Deve definir política RLS em users para lojistas visualizarem proponentes.'
  );
  assert.ok(
    sql.includes('Stores can read courier profiles of bidders'),
    'Deve definir política RLS em courier_profiles para lojistas visualizarem proponentes.'
  );
});

test('Story 3 - listBidsForJob: Retorna foto de perfil, modal e reputação do entregador na view enriquecida (CAP-3)', async () => {
  const mockDb = createMockDb({
    job_bids_with_couriers: [
      {
        id: 'bid-101',
        job_id: 'job-999',
        courier_id: 'courier-uuid-1',
        bid_daily_rate: 85,
        bid_delivery_fee: 7,
        status: 'pending',
        notes: 'Tenho baú de 45L e experiência na região',
        courier_name: 'Carlos Andrade',
        courier_avatar_url: 'https://cdn.delivrery.app/storage/v1/object/public/avatars/courier-uuid-1/avatar.webp',
        courier_modal: 'motorcycle',
        courier_level: 'Ouro',
        courier_xp: 450
      },
      {
        id: 'bid-102',
        job_id: 'job-999',
        courier_id: 'courier-uuid-2',
        bid_daily_rate: 80,
        bid_delivery_fee: 6,
        status: 'pending',
        notes: null,
        courier_name: 'Beatriz Lima',
        courier_avatar_url: null, // Sem foto configurada -> fallback de iniciais
        courier_modal: 'e-bike',
        courier_level: 'Prata',
        courier_xp: 180
      }
    ]
  });

  const res = await listBidsForJob('store-owner-uuid', 'job-999', mockDb);
  assert.equal(res.success, true);
  assert.equal(res.bids.length, 2);

  // Proposta 1 (com avatar e experiência)
  const bid1 = res.bids[0];
  assert.equal(bid1.courier_name, 'Carlos Andrade');
  assert.equal(bid1.courier_avatar_url, 'https://cdn.delivrery.app/storage/v1/object/public/avatars/courier-uuid-1/avatar.webp');
  assert.equal(bid1.courier_modal, 'motorcycle');
  assert.equal(bid1.courier_level, 'Ouro');
  assert.equal(bid1.courier_xp, 450);

  // Proposta 2 (avatar null com fallback elegante)
  const bid2 = res.bids[1];
  assert.equal(bid2.courier_name, 'Beatriz Lima');
  assert.equal(bid2.courier_avatar_url, null);
  assert.equal(bid2.courier_modal, 'e-bike');
});

test('Story 3 - Privacidade AD-10: listBidsForJob NUNCA expõe telefone celular nem CPF dos proponentes', async () => {
  const mockDb = createMockDb({
    job_bids_with_couriers: [
      {
        id: 'bid-101',
        job_id: 'job-999',
        courier_id: 'courier-uuid-1',
        bid_daily_rate: 85,
        bid_delivery_fee: 7,
        status: 'pending',
        courier_name: 'Carlos Andrade',
        courier_avatar_url: 'https://cdn.delivrery.app/storage/v1/object/public/avatars/courier-uuid-1/avatar.webp',
        courier_modal: 'motorcycle'
      }
    ]
  });

  const res = await listBidsForJob('store-owner-uuid', 'job-999', mockDb);
  assert.equal(res.success, true);
  const bid = res.bids[0];

  // Invariante de Privacidade AD-10: Nenhuma informação sensível na fase de proposta
  assert.equal(bid.courier_phone_number, undefined, 'Telefone não pode existir no objeto bid.');
  assert.equal(bid.phone_number, undefined, 'Telefone não pode ser vazado.');
  assert.equal(bid.cpf, undefined, 'CPF não pode ser vazado.');
});

test('Story 3 - Fallback gracioso de listBidsForJob quando job_bids_with_couriers não existe', async () => {
  // Simula banco sem a view criada ainda (ex: ambiente legado)
  const mockDb = {
    from(table) {
      if (table === 'job_bids_with_couriers') {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return Promise.resolve({ data: null, error: { message: 'relation does not exist' } });
                  }
                };
              }
            };
          }
        };
      }
      if (table === 'job_bids') {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return Promise.resolve({
                      data: [
                        { id: 'bid-legacy-1', job_id: 'job-1', courier_id: 'c-1', bid_daily_rate: 80, status: 'pending' }
                      ],
                      error: null
                    });
                  }
                };
              }
            };
          }
        };
      }
    }
  };

  const res = await listBidsForJob('store-1', 'job-1', mockDb);
  assert.equal(res.success, true);
  assert.equal(res.bids.length, 1);
  assert.equal(res.bids[0].id, 'bid-legacy-1');
});

test('Story 3 - getMatchedJobDetails: Retorna avatares do lojista e do entregador após o matching (CAP-3)', async () => {
  const mockDb = createMockDb({
    job_matched_contacts: [
      {
        job_id: 'job-matched-77',
        job_status: 'matched',
        shift_start_time: '2026-09-10T18:00:00Z',
        shift_end_time: '2026-09-10T23:00:00Z',
        offered_daily_rate: 90,
        offered_delivery_fee: 7,
        store_id: 'store-uuid-44',
        store_name: 'Pizzaria Vesúvio',
        store_contact_name: 'Giuseppe',
        store_phone_number: '11988887777',
        store_avatar_url: 'https://cdn.delivrery.app/storage/v1/object/public/avatars/store-uuid-44/avatar.webp',
        courier_id: 'courier-uuid-88',
        courier_name: 'Marcos Silveira',
        courier_phone_number: '11977778888',
        courier_avatar_url: 'https://cdn.delivrery.app/storage/v1/object/public/avatars/courier-uuid-88/avatar.webp',
        courier_modal: 'motorcycle',
        courier_level: 'Ouro',
        courier_xp: 520
      }
    ]
  });

  // Consulta feita pelo lojista
  const resStore = await getMatchedJobDetails('store-uuid-44', 'job-matched-77', mockDb);
  assert.equal(resStore.success, true);
  assert.ok(resStore.contact);
  assert.equal(resStore.contact.courier_name, 'Marcos Silveira');
  assert.equal(resStore.contact.courier_phone_number, '11977778888');
  assert.equal(resStore.contact.courier_avatar_url, 'https://cdn.delivrery.app/storage/v1/object/public/avatars/courier-uuid-88/avatar.webp');
  assert.equal(resStore.contact.store_avatar_url, 'https://cdn.delivrery.app/storage/v1/object/public/avatars/store-uuid-44/avatar.webp');
  assert.equal(resStore.contact.courier_modal, 'motorcycle');
  assert.equal(resStore.contact.courier_level, 'Ouro');

  // Consulta feita pelo entregador
  const resCourier = await getMatchedJobDetails('courier-uuid-88', 'job-matched-77', mockDb);
  assert.equal(resCourier.success, true);
  assert.equal(resCourier.contact.store_name, 'Pizzaria Vesúvio');
  assert.equal(resCourier.contact.store_avatar_url, 'https://cdn.delivrery.app/storage/v1/object/public/avatars/store-uuid-44/avatar.webp');

  // Consulta por terceiro não autorizado é bloqueada
  const resIntruder = await getMatchedJobDetails('random-intruder', 'job-matched-77', mockDb);
  assert.equal(resIntruder.success, false);
  assert.ok(resIntruder.error.includes('não autorizado'));
});
