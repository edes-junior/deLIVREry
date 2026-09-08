import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DonationService } from '../apps/pwa/src/donations/donation-service.ts';
import { getServerCostBreakdown } from '../apps/pwa/src/donations/pix-config.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

describe('Story 4.4: Painel Público de Transparência de Custos do Servidor e Vitória Coletiva (FR-12, NFR-8, NFR-9, NFR-3)', () => {
  beforeEach(() => {
    DonationService.clearInMemoryLogs();
  });

  test('deve retornar detalhamento padrão transparente dos custos de infraestrutura (NFR-8)', () => {
    const breakdown = getServerCostBreakdown();

    assert.ok(breakdown, 'Breakdown de custos deve existir');
    assert.strictEqual(breakdown.currency, 'BRL');
    assert.strictEqual(breakdown.totalMonthlyTarget, 150.0);
    assert.strictEqual(breakdown.items.length, 3);

    const categories = breakdown.items.map((i) => i.category);
    assert.ok(categories.includes('database'), 'Deve conter item de banco de dados');
    assert.ok(categories.includes('hosting'), 'Deve conter item de hospedagem');
    assert.ok(categories.includes('domains'), 'Deve conter item de domínio');

    const sum = breakdown.items.reduce((acc, i) => acc + i.monthlyCostBrl, 0);
    assert.strictEqual(sum, breakdown.totalMonthlyTarget, 'Soma dos itens deve bater com a meta total');
  });

  test('deve calcular relatório com meta não-atingida e valor restante correto quando arrecadação < meta', async () => {
    // Registra R$ 45,00 em apoios voluntários
    await DonationService.logDonationCopy({
      userId: 'user-donor-1',
      triggerMoment: 'shift_completed',
      suggestedAmount: 15.0,
    });
    await DonationService.logDonationCopy({
      userId: 'user-donor-2',
      triggerMoment: 'emergency_matched',
      suggestedAmount: 30.0,
    });

    const report = await DonationService.getTransparencyReport();

    assert.strictEqual(report.totalMonthlyTarget, 150.0);
    assert.strictEqual(report.totalEstimatedAmount, 45.0);
    assert.strictEqual(report.percentage, 30.0);
    assert.strictEqual(report.isGoalReached, false, 'Meta ainda não deve constar como atingida');
    assert.strictEqual(report.remainingAmount, 105.0, 'Deve restar R$ 105,00 para bater a meta');
    assert.strictEqual(report.uniqueDonorsCount, 2);
    assert.strictEqual(report.totalIntents, 2);
  });

  test('deve ativar Vitória Coletiva (isGoalReached = true) ao atingir exatamente 100% da meta', async () => {
    await DonationService.logDonationCopy({
      userId: 'user-donor-hero',
      triggerMoment: 'manual_donation',
      suggestedAmount: 150.0,
    });

    const report = await DonationService.getTransparencyReport();

    assert.strictEqual(report.totalEstimatedAmount, 150.0);
    assert.strictEqual(report.percentage, 100.0);
    assert.strictEqual(report.isGoalReached, true, 'isGoalReached deve ser true com 100%');
    assert.strictEqual(report.remainingAmount, 0.0, 'Valor restante deve ser 0 quando atingida a meta');
  });

  test('deve suportar superação da meta (> 100%) com Vitória Coletiva ativa e restante zerado', async () => {
    await DonationService.logDonationCopy({
      userId: 'user-donor-a',
      triggerMoment: 'shift_completed',
      suggestedAmount: 100.0,
    });
    await DonationService.logDonationCopy({
      userId: 'user-donor-b',
      triggerMoment: 'rating_5_stars',
      suggestedAmount: 80.0,
    });

    const report = await DonationService.getTransparencyReport();

    assert.strictEqual(report.totalEstimatedAmount, 180.0);
    assert.strictEqual(report.percentage, 120.0);
    assert.strictEqual(report.isGoalReached, true);
    assert.strictEqual(report.remainingAmount, 0.0);
    assert.strictEqual(report.uniqueDonorsCount, 2);
  });

  test('deve contabilizar corretamente doadores únicos sem duplicidade em apoios subsequentes', async () => {
    const userId = 'same-supporter-123';

    await DonationService.logDonationCopy({
      userId,
      triggerMoment: 'shift_completed',
      suggestedAmount: 10.0,
    });
    await DonationService.logDonationCopy({
      userId,
      triggerMoment: 'level_up',
      suggestedAmount: 15.0,
    });
    await DonationService.logDonationCopy({
      userId: null, // doador anônimo
      triggerMoment: 'manual_donation',
      suggestedAmount: 5.0,
    });

    const report = await DonationService.getTransparencyReport();

    assert.strictEqual(report.totalIntents, 3);
    assert.strictEqual(report.uniqueDonorsCount, 1, 'Apenas 1 doador autenticado único deve ser contabilizado');
    assert.strictEqual(report.totalEstimatedAmount, 30.0);
  });

  test('deve responder à consulta de transparência em menos de 100ms (NFR-3)', async () => {
    const start = Date.now();
    const report = await DonationService.getTransparencyReport();
    const duration = Date.now() - start;

    assert.ok(report);
    assert.ok(duration < 100, `Consulta demorou ${duration}ms, esperado < 100ms (NFR-3)`);
  });

  test('deve verificar a existência e integridade do arquivo TransparencyPanel.tsx', () => {
    const panelPath = path.resolve(
      ROOT_DIR,
      'apps/pwa/src/components/donations/TransparencyPanel.tsx'
    );
    assert.ok(fs.existsSync(panelPath), 'TransparencyPanel.tsx deve existir');

    const content = fs.readFileSync(panelPath, 'utf8');

    // Data-testids fundamentais
    assert.ok(content.includes('data-testid="transparency-panel"'), 'Deve conter data-testid transparency-panel');
    assert.ok(content.includes('data-testid="transparency-progress-bar"'), 'Deve conter data-testid transparency-progress-bar');
    assert.ok(content.includes('data-testid="transparency-percentage"'), 'Deve conter data-testid transparency-percentage');
    assert.ok(content.includes('data-testid="transparency-collected-amount"'), 'Deve conter data-testid transparency-collected-amount');
    assert.ok(content.includes('data-testid="transparency-target-cost"'), 'Deve conter data-testid transparency-target-cost');
    assert.ok(content.includes('data-testid="collective-victory-banner"'), 'Deve conter data-testid collective-victory-banner');
    assert.ok(content.includes('data-testid="btn-support-server"'), 'Deve conter data-testid btn-support-server');
    assert.ok(content.includes('data-testid="transparency-donors-count"'), 'Deve conter data-testid transparency-donors-count');
    assert.ok(content.includes('data-testid="transparency-cost-breakdown"'), 'Deve conter data-testid transparency-cost-breakdown');
  });

  test('deve garantir alvos de toque >= 48px nos botões interativos do TransparencyPanel (NFR-9)', () => {
    const panelPath = path.resolve(
      ROOT_DIR,
      'apps/pwa/src/components/donations/TransparencyPanel.tsx'
    );
    const content = fs.readFileSync(panelPath, 'utf8');

    // Checa minHeight: '48px' no botão de apoio e no toggle de breakdown
    const occurrences = (content.match(/minHeight:\s*['"]48px['"]/g) || []).length;
    assert.ok(
      occurrences >= 2,
      `Deve conter pelo menos 2 botões com minHeight >= 48px (encontrados: ${occurrences}) para NFR-9`
    );

    // Checa feedback tátil
    assert.ok(content.includes('navigator.vibrate([15, 50, 15])'), 'Deve emitir vibração háptica no clique');
  });

  test('deve validar a integração do TransparencyPanel no App.tsx', () => {
    const appPath = path.resolve(ROOT_DIR, 'apps/pwa/src/App.tsx');
    assert.ok(fs.existsSync(appPath), 'App.tsx deve existir');

    const appContent = fs.readFileSync(appPath, 'utf8');

    assert.ok(
      appContent.includes("import { TransparencyPanel } from './components/donations/TransparencyPanel.tsx';"),
      'App.tsx deve importar o TransparencyPanel'
    );
    assert.ok(
      appContent.includes('<TransparencyPanel'),
      'App.tsx deve renderizar o componente TransparencyPanel'
    );
    assert.ok(
      appContent.includes('transparencyRefreshTrigger'),
      'App.tsx deve gerenciar o refreshTrigger da transparência'
    );
  });
});
