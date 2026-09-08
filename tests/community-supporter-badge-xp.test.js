import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { DonationService } from '../apps/pwa/src/donations/donation-service.ts';

describe('Story 4.3: Integridade da Migration DDL de Apoiador e Triggers de XP', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260908120000_community_supporter_badge_xp.sql'
  );

  it('deve verificar a existência do arquivo SQL de migration', () => {
    assert.ok(fs.existsSync(migrationPath), 'Arquivo de migration deve existir');
  });

  it('deve conter expansão de courier_profiles e store_profiles com campos de apoiador', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // courier_profiles
    assert.ok(sql.includes('ALTER TABLE public.courier_profiles'), 'Deve alterar courier_profiles');
    assert.ok(sql.includes('community_supporter BOOLEAN NOT NULL DEFAULT false'), 'Deve conter community_supporter em courier_profiles');
    assert.ok(sql.includes('supporter_since TIMESTAMPTZ'), 'Deve conter supporter_since em courier_profiles');
    assert.ok(sql.includes('last_donation_at TIMESTAMPTZ'), 'Deve conter last_donation_at em courier_profiles');
    assert.ok(sql.includes('monthly_donations_count INTEGER NOT NULL DEFAULT 0'), 'Deve conter monthly_donations_count');

    // store_profiles
    assert.ok(sql.includes('ALTER TABLE public.store_profiles'), 'Deve alterar store_profiles');
  });

  it('deve conter a função process_donation_supporter_reward com regra de primeiro apoio do mês (+25 XP)', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.process_donation_supporter_reward'), 'Deve conter função trigger');
    assert.ok(sql.includes("date_trunc('month', copied_at) = date_trunc('month', NEW.copied_at)"), 'Deve checar mês calendário');
    assert.ok(sql.includes('xp_points = xp_points + 25'), 'Deve bonificar com +25 XP');
    assert.ok(sql.includes("WHEN xp_points + 25 >= 1000 THEN 'Ouro'"), 'Deve recalcular para nível Ouro');
    assert.ok(sql.includes("WHEN xp_points + 25 >= 300 THEN 'Prata'"), 'Deve recalcular para nível Prata');
    assert.ok(sql.includes('trg_donation_supporter_reward'), 'Deve criar trigger em donations_log');
  });
});

describe('Story 4.3: Regras de Negócio e Bonificação de XP no Serviço de Domínio (DonationService)', () => {
  beforeEach(() => {
    DonationService.clearInMemoryLogs();
  });

  it('deve conceder +25 XP e ativar a badge de apoiador no primeiro apoio do mês (Critério de Aceitação 1)', async () => {
    const testUserId = 'user-supporter-1';
    DonationService.setInitialSupporterState(testUserId, {
      xpPoints: 100,
      level: 'Bronze',
      communitySupporter: false,
    });

    const res = await DonationService.logDonationCopy({
      userId: testUserId,
      triggerMoment: 'shift_completed',
      suggestedAmount: 5.0,
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.reward, 'Deve retornar recompensa calculada');
    assert.strictEqual(res.reward.isFirstOfMonth, true, 'Deve ser identificado como 1º apoio do mês');
    assert.strictEqual(res.reward.xpAwarded, 25, 'Deve conceder exatamente +25 XP');
    assert.strictEqual(res.reward.communitySupporter, true, 'Badge de apoiador deve ser ativada');
    assert.strictEqual(res.reward.totalXp, 125, 'Total de XP deve ser 100 + 25 = 125');

    const status = await DonationService.getUserSupporterStatus(testUserId);
    assert.strictEqual(status.communitySupporter, true);
    assert.strictEqual(status.xpPoints, 125);
    assert.strictEqual(status.monthlyDonationsCount, 1);
  });

  it('não deve conceder XP duplicado em doações subsequentes no mesmo mês (Anti-Farming)', async () => {
    const testUserId = 'user-supporter-2';
    DonationService.setInitialSupporterState(testUserId, {
      xpPoints: 50,
      level: 'Bronze',
      communitySupporter: false,
    });

    // 1ª doação do mês -> +25 XP
    const firstRes = await DonationService.logDonationCopy({
      userId: testUserId,
      triggerMoment: 'level_up',
      suggestedAmount: 2.0,
    });
    assert.strictEqual(firstRes.reward?.xpAwarded, 25);
    assert.strictEqual(firstRes.reward?.totalXp, 75);

    // 2ª doação no mesmo mês -> 0 XP (apenas preserva e atualiza contadores)
    const secondRes = await DonationService.logDonationCopy({
      userId: testUserId,
      triggerMoment: 'manual_donation',
      suggestedAmount: 10.0,
    });
    assert.strictEqual(secondRes.reward?.isFirstOfMonth, false, 'Não é primeiro apoio do mês');
    assert.strictEqual(secondRes.reward?.xpAwarded, 0, 'Não deve conceder XP duplicado no mesmo mês');
    assert.strictEqual(secondRes.reward?.totalXp, 75, 'XP deve permanecer inalterado em 75');
    assert.strictEqual(secondRes.reward?.communitySupporter, true, 'Badge permanece ativa');

    const status = await DonationService.getUserSupporterStatus(testUserId);
    assert.strictEqual(status.xpPoints, 75);
    assert.strictEqual(status.monthlyDonationsCount, 2);
  });

  it('deve promover o nível de gamificação quando o bônus de XP atingir os thresholds (Bronze -> Prata -> Ouro)', async () => {
    // Caso 1: Promoção para Prata (threshold 300 XP)
    const courierPrata = 'courier-near-prata';
    DonationService.setInitialSupporterState(courierPrata, {
      xpPoints: 285,
      level: 'Bronze',
    });

    const resPrata = await DonationService.logDonationCopy({
      userId: courierPrata,
      triggerMoment: 'emergency_matched',
      suggestedAmount: 5.0,
    });

    // 285 + 25 = 310 XP -> sobe para 'Prata'
    assert.strictEqual(resPrata.reward?.totalXp, 310);
    assert.strictEqual(resPrata.reward?.newLevel, 'Prata');

    // Caso 2: Promoção para Ouro (threshold 1000 XP)
    const courierOuro = 'courier-near-ouro';
    DonationService.setInitialSupporterState(courierOuro, {
      xpPoints: 980,
      level: 'Prata',
    });

    const resOuro = await DonationService.logDonationCopy({
      userId: courierOuro,
      triggerMoment: 'rating_5_stars',
      suggestedAmount: 10.0,
    });

    // 980 + 25 = 1005 XP -> sobe para 'Ouro'
    assert.strictEqual(resOuro.reward?.totalXp, 1005);
    assert.strictEqual(resOuro.reward?.newLevel, 'Ouro');
  });

  it('não deve falhar nem conceder recompensa de usuário para doações anônimas', async () => {
    const res = await DonationService.logDonationCopy({
      userId: null,
      triggerMoment: 'manual_donation',
      suggestedAmount: 5.0,
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.reward, undefined, 'Doação anônima não possui recompensa de usuário');
  });
});

describe('Story 4.3: Exibição Visual da Badge de Apoiador nos Componentes do PWA', () => {
  it('deve conter selo de apoiador da comunidade no cabeçalho do App.tsx', () => {
    const appPath = path.resolve(process.cwd(), 'apps/pwa/src/App.tsx');
    const code = fs.readFileSync(appPath, 'utf8');

    assert.ok(code.includes('data-testid="badge-community-supporter"'), 'Header deve ter badge de apoiador');
    assert.ok(code.includes('Apoiador da Comunidade'), 'Deve exibir texto Apoiador da Comunidade');
    assert.ok(code.includes('data-testid="badge-user-level"'), 'Header deve ter badge de nível e XP');
  });

  it('deve conter selo de apoiador no card de vagas publicadas (JobCard.tsx)', () => {
    const cardPath = path.resolve(process.cwd(), 'apps/pwa/src/components/jobs/JobCard.tsx');
    const code = fs.readFileSync(cardPath, 'utf8');

    assert.ok(code.includes('data-testid="badge-job-supporter"'), 'JobCard deve conter badge-job-supporter');
    assert.ok(code.includes('💚'), 'Deve conter ícone de coração verde');
    assert.ok(code.includes('Apoiador'), 'Deve exibir texto Apoiador');
  });

  it('deve conter selo de apoiador nas propostas recebidas (StoreJobManagementCard.tsx)', () => {
    const storeCardPath = path.resolve(process.cwd(), 'apps/pwa/src/components/jobs/StoreJobManagementCard.tsx');
    const code = fs.readFileSync(storeCardPath, 'utf8');

    assert.ok(code.includes('data-testid="badge-bid-supporter"'), 'StoreJobManagementCard deve conter badge-bid-supporter');
  });

  it('deve exibir mensagem comemorativa de +25 XP no toast do DonationBottomSheet', () => {
    const sheetPath = path.resolve(process.cwd(), 'apps/pwa/src/components/donations/DonationBottomSheet.tsx');
    const code = fs.readFileSync(sheetPath, 'utf8');

    assert.ok(code.includes('+25 XP e Selo de Apoiador da Comunidade Ativado!'), 'Toast deve celebrar +25 XP e selo ativado');
  });
});
