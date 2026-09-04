import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { validateRateVelocity, ProfileService } from '../apps/pwa/src/profile/profile-service.ts';

describe('Story 3.3: Trava de Velocidade Tarifária - Algoritmo e Regras de Negócio (FR-9)', () => {
  it('deve permitir variação tarifária dentro do limite de ±30% em menos de 12 horas (Matriz Linha 1)', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Aumento de 25% (R$ 100 -> R$ 125)
    const increaseResult = validateRateVelocity(100, 125, twoHoursAgo);
    assert.strictEqual(increaseResult.allowed, true);
    assert.strictEqual(increaseResult.minAllowed, 70);
    assert.strictEqual(increaseResult.maxAllowed, 130);

    // Redução de 20% (R$ 100 -> R$ 80)
    const decreaseResult = validateRateVelocity(100, 80, twoHoursAgo);
    assert.strictEqual(decreaseResult.allowed, true);
    assert.strictEqual(decreaseResult.minAllowed, 70);
    assert.strictEqual(decreaseResult.maxAllowed, 130);
  });

  it('deve bloquear aumento abusivo (> 30%) em menos de 12 horas informando teto e tempo restante (Matriz Linha 2)', () => {
    // Atualizado há 3 horas (restam 9 horas)
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    // Tentativa de aumento de 50% (R$ 100 -> R$ 150)
    const result = validateRateVelocity(100, 150, threeHoursAgo);

    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.maxAllowed, 130);
    assert.strictEqual(result.minAllowed, 70);
    assert.ok(result.timeRemainingHours >= 8.9 && result.timeRemainingHours <= 9.1);
    assert.ok(result.message.includes('superior ao teto permitido de R$ 130.00 (+30%)'));
    assert.ok(result.message.includes('Aguarde 9h para alterações livres'));
  });

  it('deve bloquear redução abusiva / dumping predatório (> 30%) em menos de 12 horas (Matriz Linha 3)', () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    // Tentativa de redução de 40% (R$ 100 -> R$ 60)
    const result = validateRateVelocity(100, 60, oneHourAgo);

    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.minAllowed, 70);
    assert.strictEqual(result.maxAllowed, 130);
    assert.ok(result.message.includes('inferior ao piso permitido de R$ 70.00 (-30%)'));
    assert.ok(result.message.includes('Aguarde 11h para alterações livres'));
  });

  it('deve permitir alteração livre de tarifa após transcorridas 12 horas (Matriz Linha 4)', () => {
    // Atualizado há 13 horas
    const thirteenHoursAgo = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();

    // Reajuste expressivo de 100% após janela de carência
    const result = validateRateVelocity(100, 200, thirteenHoursAgo);

    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.timeRemainingMinutes, 0);
    assert.strictEqual(result.timeRemainingHours, 0);
  });

  it('deve permitir primeira definição de tarifa sem histórico prévio (Matriz Linha 6)', () => {
    // Perfil recém-criado sem tarifa anterior
    const firstRate = validateRateVelocity(0, 120, null);
    assert.strictEqual(firstRate.allowed, true);

    const firstFee = validateRateVelocity(0, 8, undefined);
    assert.strictEqual(firstFee.allowed, true);
  });

  it('deve rejeitar valores negativos de tarifas na validação do serviço', async () => {
    await assert.rejects(
      async () => {
        await ProfileService.updateCourierRates({
          userId: 'usr-1',
          baseDailyRate: -50,
          baseDeliveryFee: 5
        });
      },
      /As tarifas não podem ter valores negativos/
    );

    await assert.rejects(
      async () => {
        await ProfileService.updateStoreRates({
          userId: 'usr-1',
          defaultDailyRate: 100,
          defaultDeliveryFee: -10
        });
      },
      /As tarifas não podem ter valores negativos/
    );
  });

  it('deve rejeitar atualização de tarifa sem identificador de usuário', async () => {
    await assert.rejects(
      async () => {
        await ProfileService.updateCourierRates({
          userId: '',
          baseDailyRate: 120,
          baseDeliveryFee: 8
        });
      },
      /Identificador do usuário é obrigatório/
    );
  });
});

describe('Story 3.3: Integridade da Migration DDL de Trava de Velocidade Tarifária', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260904220000_rate_limit_velocity_lock.sql'
  );

  it('deve verificar a existência do arquivo SQL de migration', () => {
    assert.ok(fs.existsSync(migrationPath), 'Arquivo 20260904220000_rate_limit_velocity_lock.sql deve existir');
  });

  it('deve conter a expansão de store_profiles com campos padrão de tarifa e rate_updated_at', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.ok(sql.includes('ALTER TABLE public.store_profiles'), 'Deve alterar store_profiles');
    assert.ok(sql.includes('default_daily_rate NUMERIC(10, 2)'), 'Deve conter default_daily_rate');
    assert.ok(sql.includes('default_delivery_fee NUMERIC(10, 2)'), 'Deve conter default_delivery_fee');
    assert.ok(sql.includes('rate_updated_at TIMESTAMPTZ'), 'Deve conter rate_updated_at em store_profiles');
    assert.ok(sql.includes('check_store_default_rates_positive'), 'Deve conter check de tarifas positivas');
  });

  it('deve conter a função PL/pgSQL check_rate_velocity_lock com janela de 12 horas e corte de 30%', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.check_rate_velocity_lock'), 'Deve criar a função PL/pgSQL');
    assert.ok(sql.includes("interval '12 hours'"), 'Deve definir janela de 12 horas');
    assert.ok(sql.includes('0.30'), 'Deve definir variação de 30%');
    assert.ok(sql.includes('ERRCODE = \'P0001\''), 'Deve lançar erro com SQLSTATE P0001');
    assert.ok(sql.includes('Trava de velocidade tarifária'), 'Deve conter mensagem explicativa em PT-BR');
  });

  it('deve conter triggers para courier_profiles e store_profiles acionando a validação', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.ok(sql.includes('CREATE TRIGGER trg_courier_rate_velocity_lock'), 'Deve criar trigger em courier_profiles');
    assert.ok(sql.includes('BEFORE UPDATE ON public.courier_profiles'), 'Deve disparar BEFORE UPDATE em courier');
    assert.ok(sql.includes('CREATE TRIGGER trg_store_rate_velocity_lock'), 'Deve criar trigger em store_profiles');
    assert.ok(sql.includes('BEFORE UPDATE ON public.store_profiles'), 'Deve disparar BEFORE UPDATE em store');
  });
});
