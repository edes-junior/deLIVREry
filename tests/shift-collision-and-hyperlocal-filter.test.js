import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  doShiftsCollide,
  listOpenJobs,
  submitBid,
  SHIFT_COLLISION_BUFFER_MS
} from '../apps/pwa/src/jobs/job-service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Cria mock do Supabase com suporte a consultas de vagas e turnos aceitos.
 */
function createMockSupabase(initialData = {}) {
  const storage = {
    job_posts: [...(initialData.job_posts || [])],
    job_bids: [...(initialData.job_bids || [])]
  };

  return {
    storage,
    from(tableName) {
      const state = {
        table: tableName,
        filters: [],
        dataToInsert: null
      };

      const chain = {
        insert(payload) {
          state.dataToInsert = payload;
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
          state.filters.push({ col, val: vals, op: 'in' });
          return chain;
        },
        contains() {
          return chain;
        },
        order() {
          return chain;
        },
        async single() {
          if (state.dataToInsert) {
            const inserted = { id: `bid-${Date.now()}`, ...state.dataToInsert, created_at: new Date().toISOString() };
            storage[state.table].push(inserted);
            return { data: inserted, error: null };
          }
          const rows = (storage[state.table] || []).filter(r =>
            state.filters.every(f => {
              if (f.op === 'in') return f.val.includes(r[f.col]);
              if (f.op === 'neq') return r[f.col] !== f.val;
              return r[f.col] === f.val;
            })
          );
          if (rows.length === 0) {
            return { data: null, error: { message: 'Registro não encontrado' } };
          }
          return { data: rows[0], error: null };
        },
        then(resolve) {
          const rows = (storage[state.table] || []).filter(r =>
            state.filters.every(f => {
              if (f.op === 'in') return f.val.includes(r[f.col]);
              if (f.op === 'neq') return r[f.col] !== f.val;
              return r[f.col] === f.val;
            })
          );
          resolve({ data: rows, error: null });
        }
      };

      return chain;
    }
  };
}

// -----------------------------------------------------------------------------
// Testes da História 5: Colisão com Buffer de 30m e Filtro Hiperlocal (CAP-5, CAP-6)
// -----------------------------------------------------------------------------

test('Story 5 - Migration SQL de Detecção de Colisão: Validação Estrutural', () => {
  const migrationPath = path.join(
    rootDir,
    'supabase',
    'migrations',
    '20260909240000_job_shift_collision_detection.sql'
  );

  assert.ok(fs.existsSync(migrationPath), 'Migration 20260909240000 deve existir.');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // Verifica índice composto de turnos casados
  assert.ok(
    sql.includes('idx_job_posts_matched_courier_schedule'),
    'Deve criar índice idx_job_posts_matched_courier_schedule.'
  );
  assert.ok(
    sql.includes("WHERE status IN ('matched', 'in_progress')"),
    'Índice deve filtrar apenas turnos confirmados.'
  );

  // Verifica função DDL do Postgres com buffer de 30m
  assert.ok(
    sql.includes('FUNCTION public.do_shifts_collide'),
    'Deve criar a função SQL do_shifts_collide.'
  );
  assert.ok(
    sql.includes('p_buffer_minutes INT DEFAULT 30'),
    'Função SQL deve ter parâmetro de buffer padrão de 30 minutos.'
  );
});

test('Story 5 - doShiftsCollide: Algoritmo de tolerância e janela de 30 minutos', () => {
  assert.equal(SHIFT_COLLISION_BUFFER_MS, 1800000, 'Buffer deve ser exatamente 30 minutos (1.800.000 ms).');

  // Turno Confirmado A: 18:00 às 22:00
  const aStart = '2026-09-10T18:00:00Z';
  const aEnd = '2026-09-10T22:00:00Z';

  // Cenário 1: Sobreposição direta dentro do horário (19:00 às 21:00) -> COLIDE
  assert.equal(
    doShiftsCollide(aStart, aEnd, '2026-09-10T19:00:00Z', '2026-09-10T21:00:00Z'),
    true,
    'Turno interno deve colidir'
  );

  // Cenário 2: Início com apenas 15 minutos de intervalo após o fim do turno A (22:15 às 02:00) -> COLIDE (< 30 min)
  assert.equal(
    doShiftsCollide(aStart, aEnd, '2026-09-10T22:15:00Z', '2026-09-11T02:00:00Z'),
    true,
    'Intervalo de 15min após término deve colidir por violar o buffer de 30min'
  );

  // Cenário 3: Término com apenas 10 minutos antes do início do turno A (14:00 às 17:50) -> COLIDE (< 30 min)
  assert.equal(
    doShiftsCollide(aStart, aEnd, '2026-09-10T14:00:00Z', '2026-09-10T17:50:00Z'),
    true,
    'Intervalo de 10min antes do início deve colidir por violar o buffer de 30min'
  );

  // Cenário 4: Intervalo de exatamente 30 minutos (22:30 às 02:00) -> NÃO COLIDE (fronteira exata)
  assert.equal(
    doShiftsCollide(aStart, aEnd, '2026-09-10T22:30:00Z', '2026-09-11T02:00:00Z'),
    false,
    'Intervalo de exatamente 30min não deve colidir'
  );

  // Cenário 5: Intervalo confortável de 1 hora (23:00 às 03:00) -> NÃO COLIDE
  assert.equal(
    doShiftsCollide(aStart, aEnd, '2026-09-10T23:00:00Z', '2026-09-11T03:00:00Z'),
    false,
    'Intervalo de 1h não deve colidir'
  );

  // Cenário 6: Turno em outro dia -> NÃO COLIDE
  assert.equal(
    doShiftsCollide(aStart, aEnd, '2026-09-11T18:00:00Z', '2026-09-11T22:00:00Z'),
    false,
    'Turno em outro dia não deve colidir'
  );
});

test('Story 5 - listOpenJobs: Exclui vagas conflitantes com a agenda aceita do entregador (CAP-5)', async () => {
  const courierId = 'courier-uuid-1';

  const mockDb = createMockSupabase({
    job_posts: [
      // 1. Turno já confirmado do entregador (18:00 às 22:00)
      {
        id: 'job-confirmed-1',
        store_id: 'store-a',
        matched_courier_id: courierId,
        status: 'matched',
        shift_start_time: '2026-09-10T18:00:00Z',
        shift_end_time: '2026-09-10T22:00:00Z',
        state_id: 'SP',
        city_id: 'sao-paulo',
        neighborhood_id: 'pinheiros'
      },
      // 2. Vaga aberta que colide diretamente (19:00 às 23:00) -> DEVE SER EXCLUÍDA
      {
        id: 'job-open-conflicting-direct',
        store_id: 'store-b',
        status: 'open',
        shift_start_time: '2026-09-10T19:00:00Z',
        shift_end_time: '2026-09-10T23:00:00Z',
        state_id: 'SP',
        city_id: 'sao-paulo',
        neighborhood_id: 'pinheiros'
      },
      // 3. Vaga aberta que colide com o buffer de 30m (22:15 às 01:00) -> DEVE SER EXCLUÍDA
      {
        id: 'job-open-conflicting-buffer',
        store_id: 'store-c',
        status: 'open',
        shift_start_time: '2026-09-10T22:15:00Z',
        shift_end_time: '2026-09-11T01:00:00Z',
        state_id: 'SP',
        city_id: 'sao-paulo',
        neighborhood_id: 'pinheiros'
      },
      // 4. Vaga aberta compatível com >30 min de folga (23:00 às 02:00) -> DEVE APARECER
      {
        id: 'job-open-compatible',
        store_id: 'store-d',
        status: 'open',
        shift_start_time: '2026-09-10T23:00:00Z',
        shift_end_time: '2026-09-11T02:00:00Z',
        state_id: 'SP',
        city_id: 'sao-paulo',
        neighborhood_id: 'pinheiros'
      }
    ]
  });

  const res = await listOpenJobs({
    state_id: 'SP',
    city_id: 'sao-paulo',
    courier_user_id: courierId
  }, mockDb);

  assert.equal(res.success, true);
  // Deve conter apenas job-open-compatible
  assert.equal(res.jobs.length, 1);
  assert.equal(res.jobs[0].id, 'job-open-compatible');
  assert.equal(res.jobs.some(j => j.id === 'job-open-conflicting-direct'), false);
  assert.equal(res.jobs.some(j => j.id === 'job-open-conflicting-buffer'), false);
});

test('Story 5 - submitBid: Rejeita proposta para vaga conflitante com SCHEDULE_CONFLICT (CAP-5)', async () => {
  const courierId = 'courier-uuid-1';

  const mockDb = createMockSupabase({
    job_posts: [
      // Turno aceito pelo entregador
      {
        id: 'job-accepted-10',
        store_id: 'store-x',
        matched_courier_id: courierId,
        status: 'matched',
        shift_start_time: '2026-09-12T12:00:00Z',
        shift_end_time: '2026-09-12T16:00:00Z'
      },
      // Vaga aberta que colide com o turno aceito (15:30 às 19:30)
      {
        id: 'job-target-conflict',
        store_id: 'store-y',
        status: 'open',
        shift_start_time: '2026-09-12T15:30:00Z',
        shift_end_time: '2026-09-12T19:30:00Z'
      },
      // Vaga aberta compatível (20:00 às 23:00)
      {
        id: 'job-target-valid',
        store_id: 'store-z',
        status: 'open',
        shift_start_time: '2026-09-12T20:00:00Z',
        shift_end_time: '2026-09-12T23:00:00Z'
      }
    ]
  });

  // 1. Tentativa de bid em vaga conflitante -> BLOQUEADA
  const conflictRes = await submitBid(courierId, {
    job_id: 'job-target-conflict',
    bid_daily_rate: 80,
    bid_delivery_fee: 6
  }, mockDb);

  assert.equal(conflictRes.success, false);
  assert.ok(conflictRes.error.includes('SCHEDULE_CONFLICT'));

  // 2. Tentativa de bid em vaga válida sem colisão -> APROVADA
  const validRes = await submitBid(courierId, {
    job_id: 'job-target-valid',
    bid_daily_rate: 80,
    bid_delivery_fee: 6
  }, mockDb);

  assert.equal(validRes.success, true);
  assert.ok(validRes.bid);
  assert.equal(validRes.bid.job_id, 'job-target-valid');
});

test('Story 5 - JobFeed.tsx: Filtro de Bairro Cadastrado é ativo por padrão (CAP-6)', () => {
  const feedPath = path.join(rootDir, 'apps', 'pwa', 'src', 'components', 'jobs', 'JobFeed.tsx');
  const feedCode = fs.readFileSync(feedPath, 'utf-8');

  assert.ok(
    feedCode.includes('useState(true)'),
    'JobFeed deve inicializar o filtro de bairro como true por padrão.'
  );
  assert.ok(
    feedCode.includes('courier_user_id: courierUserId'),
    'JobFeed deve passar courier_user_id para excluir vagas com colisão.'
  );
});
