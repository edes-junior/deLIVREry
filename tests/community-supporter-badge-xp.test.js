import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { DonationService } from '../apps/pwa/src/donations/donation-service.ts';

describe('Story 4.3: Integridade da Migration DDL Histórica de Apoio', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260908120000_community_supporter_badge_xp.sql'
  );

  it('deve verificar a existência do arquivo SQL de migration para fins de auditoria', () => {
    assert.ok(fs.existsSync(migrationPath), 'Arquivo de migration deve existir');
  });

  it('deve verificar colunas no arquivo de migration', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.ok(sql.includes('ALTER TABLE public.courier_profiles'), 'Deve conter referência a courier_profiles');
    assert.ok(sql.includes('ALTER TABLE public.store_profiles'), 'Deve conter referência a store_profiles');
  });
});

describe('Story 4.3: Regras de Negócio e Isonomia Radical no Serviço de Domínio (DonationService)', () => {
  beforeEach(() => {
    DonationService.clearInMemoryLogs();
  });

  it('NÃO deve conceder bonificação de XP nem ativar selos comerciais por doação (Blindagem Fiscal ADR-4.3)', async () => {
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
    assert.ok(res.reward, 'Deve retornar payload de resposta');
    assert.strictEqual(res.reward.xpAwarded, 0, 'Não deve conceder XP para não descaracterizar doação civil como serviço');
    assert.strictEqual(res.reward.communitySupporter, false, 'Badge de apoiador não deve ser concedida como produto de vaidade');
    assert.strictEqual(res.reward.totalXp, 100, 'Total de XP deve permanecer inalterado');

    const status = await DonationService.getUserSupporterStatus(testUserId);
    assert.strictEqual(status.communitySupporter, false);
    assert.strictEqual(status.xpPoints, 100);
    assert.strictEqual(status.monthlyDonationsCount, 1);
  });

  it('deve preservar o nível de gamificação sem alterações decorrentes de doação financeira', async () => {
    const testUserId = 'user-supporter-2';
    DonationService.setInitialSupporterState(testUserId, {
      xpPoints: 290,
      level: 'Bronze',
      communitySupporter: false,
    });

    const res = await DonationService.logDonationCopy({
      userId: testUserId,
      triggerMoment: 'manual_donation',
      suggestedAmount: 50.0,
    });

    assert.strictEqual(res.reward?.xpAwarded, 0);
    assert.strictEqual(res.reward?.totalXp, 290);
    assert.strictEqual(res.reward?.newLevel, 'Bronze', 'Nível de gamificação depende apenas do trabalho operacional real');
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

describe('Story 4.3: Isonomia Radical nos Componentes do PWA (Sem Selos de Casta)', () => {
  it('NÃO deve conter selo de apoiador comercial no cabeçalho do App.tsx', () => {
    const appPath = path.resolve(process.cwd(), 'apps/pwa/src/App.tsx');
    const code = fs.readFileSync(appPath, 'utf8');

    assert.ok(!code.includes('data-testid="badge-community-supporter"'), 'Header NÃO deve ter badge-community-supporter');
    assert.ok(code.includes('data-testid="badge-user-level"'), 'Header deve ter badge de nível e XP legítimo de trabalho');
  });

  it('NÃO deve conter selo de apoiador no card de vagas publicadas (JobCard.tsx)', () => {
    const cardPath = path.resolve(process.cwd(), 'apps/pwa/src/components/jobs/JobCard.tsx');
    const code = fs.readFileSync(cardPath, 'utf8');

    assert.ok(!code.includes('data-testid="badge-job-supporter"'), 'JobCard NÃO deve conter badge-job-supporter');
  });

  it('deve garantir integridade dos ícones importados no JobCard.tsx (Bike, AlertTriangle, Check)', () => {
    const cardPath = path.resolve(process.cwd(), 'apps/pwa/src/components/jobs/JobCard.tsx');
    const code = fs.readFileSync(cardPath, 'utf8');

    const importLine = code.split('\n').find(l => l.includes("from 'lucide-react'"));
    assert.ok(importLine && importLine.includes('Bike'), 'JobCard deve importar Bike de lucide-react');
    assert.ok(importLine && importLine.includes('AlertTriangle'), 'JobCard deve importar AlertTriangle de lucide-react');
    assert.ok(importLine && importLine.includes('Check'), 'JobCard deve importar Check de lucide-react');
  });

  it('NÃO deve conter selo de apoiador nas propostas recebidas (StoreJobManagementCard.tsx)', () => {
    const storeCardPath = path.resolve(process.cwd(), 'apps/pwa/src/components/jobs/StoreJobManagementCard.tsx');
    const code = fs.readFileSync(storeCardPath, 'utf8');

    assert.ok(!code.includes('data-testid="badge-bid-supporter"'), 'StoreJobManagementCard NÃO deve conter badge-bid-supporter');
  });

  it('deve exibir mensagem fraterna de logística livre sem menção a selos ativados no DonationBottomSheet', () => {
    const sheetPath = path.resolve(process.cwd(), 'apps/pwa/src/components/donations/DonationBottomSheet.tsx');
    const code = fs.readFileSync(sheetPath, 'utf8');

    assert.ok(!code.includes('+25 XP e Selo de Apoiador da Comunidade Ativado!'), 'Toast NÃO deve mencionar selo ativado');
    assert.ok(code.includes('Valeu por manter a logística livre e nas mãos de quem trabalha'), 'Deve exibir mensagem fraterna de copropriedade');
  });
});
