import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ProfileService } from '../apps/pwa/src/profile/profile-service.ts';
import { filterCouriersForJob, dispatchJobWebPush } from '../apps/pwa/src/notifications/notification-service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Cria mock do Supabase para testes de disponibilidade operacional do entregador.
 */
function createMockSupabase(initialCouriers = []) {
  const courierProfiles = [...initialCouriers];

  return {
    courierProfiles,
    from(tableName) {
      const state = {
        table: tableName,
        filters: [],
        dataToUpdate: null
      };

      const chain = {
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
        async single() {
          if (state.table === 'courier_profiles' && state.dataToUpdate) {
            const profile = courierProfiles.find(p =>
              state.filters.every(f => p[f.col] === f.val)
            );
            if (!profile) {
              return { data: null, error: { message: 'Perfil não encontrado' } };
            }
            Object.assign(profile, state.dataToUpdate);
            return { data: profile, error: null };
          }
          return { data: null, error: { message: 'Operação não suportada' } };
        }
      };

      return chain;
    }
  };
}

// -----------------------------------------------------------------------------
// Testes da História 4 (CAP-4): Controle de Disponibilidade Operacional
// -----------------------------------------------------------------------------

test('Story 4 - Migration SQL de Disponibilidade Operacional: Validação Estrutural', () => {
  const migrationPath = path.join(
    rootDir,
    'supabase',
    'migrations',
    '20260909230000_courier_availability_status.sql'
  );

  assert.ok(fs.existsSync(migrationPath), 'Migration 20260909230000 deve existir.');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // Verifica coluna is_active
  assert.ok(
    sql.includes('ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true'),
    'Deve adicionar a coluna is_active com default true em courier_profiles.'
  );

  // Verifica índice condicional
  assert.ok(
    sql.includes('idx_courier_profiles_active_region'),
    'Deve criar o índice idx_courier_profiles_active_region.'
  );
  assert.ok(
    sql.includes('WHERE is_active = true'),
    'O índice regional deve filtrar estritamente entregadores ativos.'
  );
});

test('Story 4 - ProfileService.toggleCourierAvailability: Alterna de Ativo para Pausado e Vice-Versa', async () => {
  const mockDb = createMockSupabase([
    {
      user_id: 'courier-uuid-1',
      is_active: true,
      transport_modal: 'motorcycle'
    }
  ]);

  // 1. Pausa o entregador (fica offline)
  const pauseRes = await ProfileService.toggleCourierAvailability('courier-uuid-1', false, mockDb);
  assert.equal(pauseRes.success, true);
  assert.equal(pauseRes.isActive, false);
  assert.equal(mockDb.courierProfiles[0].is_active, false);

  // 2. Reativa o entregador (volta a ficar online)
  const resumeRes = await ProfileService.toggleCourierAvailability('courier-uuid-1', true, mockDb);
  assert.equal(resumeRes.success, true);
  assert.equal(resumeRes.isActive, true);
  assert.equal(mockDb.courierProfiles[0].is_active, true);
});

test('Story 4 - ProfileService.toggleCourierAvailability: Rejeita parâmetros inválidos', async () => {
  const mockDb = createMockSupabase();

  const res = await ProfileService.toggleCourierAvailability('', true, mockDb);
  assert.equal(res.success, false);
  assert.equal(res.isActive, false);
  assert.ok(res.error.includes('obrigatório'));
});

test('Story 4 - filterCouriersForJob: Suprime notificações push quando o entregador está pausado (isActive = false)', () => {
  const job = {
    id: 'job-10',
    store_id: 'store-1',
    state_id: 'SP',
    city_id: 'sao-paulo',
    neighborhood_id: 'pinheiros',
    accepted_modals: ['motorcycle', 'bicycle'],
    shift_start_time: '2026-09-10T14:00:00Z',
    shift_end_time: '2026-09-10T18:00:00Z',
    offered_daily_rate: 90,
    offered_delivery_fee: 7,
    status: 'open'
  };

  const couriers = [
    {
      userId: 'courier-active-1',
      stateId: 'SP',
      cityId: 'sao-paulo',
      homeNeighborhoodId: 'pinheiros',
      transportModal: 'motorcycle',
      isActive: true
    },
    {
      userId: 'courier-paused-2',
      stateId: 'SP',
      cityId: 'sao-paulo',
      homeNeighborhoodId: 'pinheiros',
      transportModal: 'motorcycle',
      isActive: false // Entregador em pausa
    },
    {
      userId: 'courier-active-diff-region-3',
      stateId: 'SP',
      cityId: 'sao-paulo',
      homeNeighborhoodId: 'moema', // Outro bairro
      transportModal: 'motorcycle',
      isActive: true
    }
  ];

  const matched = filterCouriersForJob(couriers, job);

  // Apenas courier-active-1 deve ser elegível; o pausado e o de outro bairro são suprimidos
  assert.equal(matched.length, 1);
  assert.equal(matched[0].userId, 'courier-active-1');
  assert.equal(matched.some(c => c.userId === 'courier-paused-2'), false);
});

test('Story 4 - dispatchJobWebPush: Respeita supressão para motoboys pausados no envio ponta-a-ponta', async () => {
  const job = {
    id: 'job-20',
    store_id: 'store-2',
    state_id: 'SP',
    city_id: 'sao-paulo',
    neighborhood_id: 'itaim',
    accepted_modals: ['bicycle'],
    shift_start_time: '2026-09-11T12:00:00Z',
    shift_end_time: '2026-09-11T16:00:00Z',
    offered_daily_rate: 70,
    offered_delivery_fee: 5,
    status: 'open'
  };

  const couriersAllPaused = [
    {
      userId: 'c-1',
      stateId: 'SP',
      cityId: 'sao-paulo',
      homeNeighborhoodId: 'itaim',
      transportModal: 'bicycle',
      isActive: false
    }
  ];

  const result = await dispatchJobWebPush(job, 'Hamburgueria Livre', couriersAllPaused);
  assert.equal(result.success, true);
  assert.equal(result.targetsMatched, 0);
  assert.equal(result.dispatchedCount, 0);
});

test('Story 4 - App.tsx: Contém alternador visual de disponibilidade e banner de pausa', () => {
  const appPath = path.join(rootDir, 'apps', 'pwa', 'src', 'App.tsx');
  const appCode = fs.readFileSync(appPath, 'utf-8');

  assert.ok(
    appCode.includes('data-testid="btn-toggle-availability"'),
    'App.tsx deve conter o botão de alternância de disponibilidade.'
  );
  assert.ok(
    appCode.includes('data-testid="courier-paused-banner"'),
    'App.tsx deve conter o banner de aviso quando o entregador estiver pausado.'
  );
  assert.ok(
    appCode.includes('handleToggleCourierAvailability'),
    'App.tsx deve conter o handler de clique para alternar disponibilidade.'
  );
});
