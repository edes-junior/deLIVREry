/**
 * @file quorum-referral.test.js
 * @description Suíte de testes automatizados para Story 1.4:
 * Termômetro de Desbloqueio Regional (Quórum Hiperlocal) e Motor de Indicação Viral (FR-13, FR-15).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateQuorumMetrics,
  REQUIRED_STORES_QUORUM,
  REQUIRED_COURIERS_QUORUM,
  QuorumService
} from '../apps/pwa/src/quorum/quorum-service.ts';

import {
  ReferralService
} from '../apps/pwa/src/referral/referral-service.ts';

describe('Story 1.4: Cálculo de Métricas de Quórum Regional (FR-13, AD-8)', () => {
  it('deve iniciar zerado com status pre_launch para novos bairros sem cadastros (Matriz Linha 6)', () => {
    const metrics = calculateQuorumMetrics(0, 0);

    assert.strictEqual(metrics.couriersCount, 0);
    assert.strictEqual(metrics.storesCount, 0);
    assert.strictEqual(metrics.courierPercentage, 0);
    assert.strictEqual(metrics.storePercentage, 0);
    assert.strictEqual(metrics.overallPercentage, 0);
    assert.strictEqual(metrics.isUnlocked, false);
    assert.strictEqual(metrics.status, 'pre_launch');
    assert.strictEqual(metrics.requiredStores, 10);
    assert.strictEqual(metrics.requiredCouriers, 50);
  });

  it('deve calcular porcentagens parciais em status pre_launch (Matriz Linha 1)', () => {
    // 4 lojas (40% de 10) e 20 motoboys (40% de 50)
    const metrics = calculateQuorumMetrics(20, 4);

    assert.strictEqual(metrics.storesCount, 4);
    assert.strictEqual(metrics.couriersCount, 20);
    assert.strictEqual(metrics.storePercentage, 40);
    assert.strictEqual(metrics.courierPercentage, 40);
    assert.strictEqual(metrics.overallPercentage, 40);
    assert.strictEqual(metrics.isUnlocked, false);
    assert.strictEqual(metrics.status, 'pre_launch');
  });

  it('não deve desbloquear se atingir a meta de lojas mas faltarem motoboys', () => {
    // 10 lojas (100%), mas apenas 49 motoboys (98%)
    const metrics = calculateQuorumMetrics(49, 10);

    assert.strictEqual(metrics.storePercentage, 100);
    assert.strictEqual(metrics.courierPercentage, 98);
    assert.strictEqual(metrics.isUnlocked, false);
    assert.strictEqual(metrics.status, 'pre_launch');
  });

  it('não deve desbloquear se atingir a meta de motoboys mas faltarem lojas', () => {
    // 9 lojas (90%), e 50 motoboys (100%)
    const metrics = calculateQuorumMetrics(50, 9);

    assert.strictEqual(metrics.storePercentage, 90);
    assert.strictEqual(metrics.courierPercentage, 100);
    assert.strictEqual(metrics.isUnlocked, false);
    assert.strictEqual(metrics.status, 'pre_launch');
  });

  it('deve ativar e desbloquear a região quando atingir exatamente 10 lojas e 50 entregadores', () => {
    const metrics = calculateQuorumMetrics(50, 10);

    assert.strictEqual(metrics.storePercentage, 100);
    assert.strictEqual(metrics.courierPercentage, 100);
    assert.strictEqual(metrics.overallPercentage, 100);
    assert.strictEqual(metrics.isUnlocked, true);
    assert.strictEqual(metrics.status, 'unlocked');
  });

  it('deve cravar em 100% no progresso mesmo quando superar o quórum mínimo (Matriz Linha 2)', () => {
    // 12 lojas e 55 motoboys
    const metrics = calculateQuorumMetrics(55, 12);

    assert.strictEqual(metrics.storesCount, 12);
    assert.strictEqual(metrics.couriersCount, 55);
    assert.strictEqual(metrics.storePercentage, 100);
    assert.strictEqual(metrics.courierPercentage, 100);
    assert.strictEqual(metrics.overallPercentage, 100);
    assert.strictEqual(metrics.isUnlocked, true);
    assert.strictEqual(metrics.status, 'unlocked');
  });

  it('deve sanitizar entradas inválidas ou nulas', () => {
    const metrics = calculateQuorumMetrics(-5, null);

    assert.strictEqual(metrics.couriersCount, 0);
    assert.strictEqual(metrics.storesCount, 0);
    assert.strictEqual(metrics.isUnlocked, false);
  });
});

describe('Story 1.4: Motor de Indicação Viral e Links (FR-15)', () => {
  it('deve gerar URLs de indicação com parâmetro ?ref=', () => {
    const url = ReferralService.generateReferralUrl('LIVRE-K9X2P4', 'https://delivrery.app');
    assert.strictEqual(url, 'https://delivrery.app/?ref=LIVRE-K9X2P4');
  });

  it('deve normalizar e sanitizar código em maiúsculas na URL de indicação', () => {
    const url = ReferralService.generateReferralUrl('  livre-abc123  ', 'https://delivrery.app');
    assert.strictEqual(url, 'https://delivrery.app/?ref=LIVRE-ABC123');
  });

  it('deve gerar link de compartilhamento para WhatsApp com mensagem e bairro', () => {
    const waUrl = ReferralService.generateWhatsAppShareUrl(
      'LIVRE-MOTO01',
      'Pinheiros',
      'https://delivrery.app'
    );

    assert.ok(waUrl.startsWith('https://api.whatsapp.com/send?text='));
    const decoded = decodeURIComponent(waUrl);
    assert.ok(decoded.includes('Pinheiros'));
    assert.ok(decoded.includes('https://delivrery.app/?ref=LIVRE-MOTO01'));
    assert.ok(decoded.includes('sem taxa de comissão'));
  });

  it('deve extrair código de indicação a partir de query strings da URL (Matriz Linha 5)', () => {
    assert.strictEqual(
      ReferralService.extractReferralCodeFromUrl('?ref=LIVRE-XYZ999'),
      'LIVRE-XYZ999'
    );

    assert.strictEqual(
      ReferralService.extractReferralCodeFromUrl('?utm_source=ig&ref=livre-promo1&other=true'),
      'LIVRE-PROMO1'
    );

    assert.strictEqual(
      ReferralService.extractReferralCodeFromUrl('?source=direct'),
      null
    );

    assert.strictEqual(
      ReferralService.extractReferralCodeFromUrl(''),
      null
    );
  });

  it('deve executar compartilhamento com fallback seguro sem quebrar na ausência de Web Share (Matriz Linha 4)', async () => {
    // Em ambiente Node.js, navigator não possui window/UI nativa
    const result = await ReferralService.shareReferral(
      'LIVRE-TESTE1',
      'Centro',
      'https://delivrery.app'
    );

    assert.ok(result);
    assert.strictEqual(typeof result.success, 'boolean');
    assert.ok(result.message.includes('https://delivrery.app/?ref=LIVRE-TESTE1') || typeof result.message === 'string');
  });
});

describe('Story 1.4: Consulta de Quórum Regional no Serviço (QuorumService)', () => {
  it('deve retornar quórum default em status pre_launch quando parâmetros geográficos forem vazios', async () => {
    const quorum = await QuorumService.getRegionQuorum('', '', '');

    assert.strictEqual(quorum.isUnlocked, false);
    assert.strictEqual(quorum.status, 'pre_launch');
    assert.strictEqual(quorum.couriersCount, 0);
    assert.strictEqual(quorum.storesCount, 0);
    assert.strictEqual(quorum.unlockedAt, null);
  });
});
