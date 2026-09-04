import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatPixTLV,
  calculatePixCrc16,
  generatePixBrcode,
  getPixConfig,
} from '../apps/pwa/src/donations/pix-config.ts';
import {
  DonationService,
  VALID_TRIGGER_MOMENTS,
} from '../apps/pwa/src/donations/donation-service.ts';
import { DelivreryClient } from '../packages/api-client-sdk/src/index.js';

describe('Story 4.1: Integridade da Migration DDL de Doações PIX (donations_log)', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260904230000_donations_log_schema.sql'
  );

  it('deve verificar a existência do arquivo SQL de migration', () => {
    assert.ok(fs.existsSync(migrationPath), 'Arquivo de migration deve existir');
  });

  it('deve conter a definição da tabela donations_log com constraints e campos obrigatórios', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.donations_log'), 'Deve criar a tabela donations_log');
    assert.ok(sql.includes('id UUID PRIMARY KEY'), 'Deve ter campo id UUID como PK');
    assert.ok(sql.includes('user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL'), 'Deve suportar user_id anulável para anonimato');
    assert.ok(sql.includes('trigger_moment VARCHAR(50) NOT NULL'), 'Deve conter trigger_moment');
    assert.ok(sql.includes('suggested_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00'), 'Deve conter suggested_amount');
    assert.ok(sql.includes('copied_at TIMESTAMPTZ NOT NULL'), 'Deve conter timestamp copied_at');
  });

  it('deve conter validação CHECK dos 6 momentos disparadores canônicos (FR-10)', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.ok(sql.includes('check_donations_trigger_moment'), 'Deve ter constraint de momentos');
    assert.ok(sql.includes("'shift_completed'"), 'Deve permitir shift_completed');
    assert.ok(sql.includes("'level_up'"), 'Deve permitir level_up');
    assert.ok(sql.includes("'emergency_matched'"), 'Deve permitir emergency_matched');
    assert.ok(sql.includes("'rating_5_stars'"), 'Deve permitir rating_5_stars');
    assert.ok(sql.includes("'api_1000_requests'"), 'Deve permitir api_1000_requests');
    assert.ok(sql.includes("'manual_donation'"), 'Deve permitir manual_donation');
    assert.ok(sql.includes('check_donations_amount_non_negative'), 'Deve proibir valores negativos');
  });

  it('deve conter ativação de RLS e políticas de inserção pública e leitura privada (NFR-5)', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.ok(sql.includes('ALTER TABLE public.donations_log ENABLE ROW LEVEL SECURITY;'), 'RLS deve estar habilitado');
    assert.ok(sql.includes('donations_log_insert_policy'), 'Deve ter política de inserção');
    assert.ok(sql.includes('donations_log_select_self'), 'Deve ter política de leitura própria');
    assert.ok(sql.includes('monthly_donation_stats'), 'Deve conter view para transparência pública');
    assert.ok(sql.includes('GRANT SELECT ON public.monthly_donation_stats TO anon, authenticated'), 'View deve ser legível por anon e authenticated');
  });
});

describe('Story 4.1: Configuração de Ambiente PIX e Padrão BACEN BR Code (FR-11)', () => {
  it('deve formatar blocos TLV (Tag-Length-Value) corretamente', () => {
    assert.strictEqual(formatPixTLV('00', '01'), '000201');
    assert.strictEqual(formatPixTLV('58', 'BR'), '5802BR');
    assert.strictEqual(formatPixTLV('53', '986'), '5303986');
  });

  it('deve calcular o checksum CRC16-CCITT conforme o padrão oficial do BACEN', () => {
    const samplePayload = '00020126330014br.gov.bcb.pix0111123456789005204000053039865802BR5913FULANO DE TAL6008BRASILIA62070503***6304';
    const crc = calculatePixCrc16(samplePayload);
    assert.strictEqual(crc, '3EC9');
  });

  it('deve gerar payload BR Code válido com chave estática e dados do recebedor', () => {
    const payload = generatePixBrcode({
      key: 'apoio@delivrery.org',
      recipientName: 'Comunidade deLIVREry',
      city: 'São Paulo',
      amount: 5.0,
      txid: 'APOIO01',
    });

    assert.ok(payload.startsWith('000201'), 'Deve iniciar com Tag 00 Format Indicator');
    assert.ok(payload.includes('br.gov.bcb.pix'), 'Deve conter GUI do PIX');
    assert.ok(payload.includes('apoio@delivrery.org'), 'Deve conter chave PIX');
    assert.ok(payload.includes('SAO PAULO'), 'Deve sanitizar acentos na cidade');
    assert.ok(payload.includes('54045.00'), 'Deve formatar valor quando especificado');
    assert.ok(payload.includes('6304'), 'Deve terminar com Tag 63 de CRC');
    assert.strictEqual(payload.length, payload.indexOf('6304') + 8, 'CRC deve ter exatamente 4 caracteres');
  });

  it('deve carregar configuração padrão segura na ausência de variáveis de ambiente', () => {
    const config = getPixConfig();
    assert.ok(config.key);
    assert.ok(config.recipientName);
    assert.ok(config.city);
    assert.ok(config.brCodePayload);
    assert.strictEqual(typeof config.isCustomPayload, 'boolean');
  });

  it('deve respeitar variável customizada PUBLIC_PIX_KEY e PUBLIC_PIX_BRCODE_PAYLOAD quando fornecidas', () => {
    const originalKey = process.env.PUBLIC_PIX_KEY;
    const originalPayload = process.env.PUBLIC_PIX_BRCODE_PAYLOAD;

    try {
      process.env.PUBLIC_PIX_KEY = 'minhachave@pix.com';
      process.env.PUBLIC_PIX_BRCODE_PAYLOAD = 'PAYLOAD_MOCK_TESTE_123';

      const config = getPixConfig();
      assert.strictEqual(config.key, 'minhachave@pix.com');
      assert.strictEqual(config.brCodePayload, 'PAYLOAD_MOCK_TESTE_123');
      assert.strictEqual(config.isCustomPayload, true);
    } finally {
      if (originalKey !== undefined) process.env.PUBLIC_PIX_KEY = originalKey;
      else delete process.env.PUBLIC_PIX_KEY;

      if (originalPayload !== undefined) process.env.PUBLIC_PIX_BRCODE_PAYLOAD = originalPayload;
      else delete process.env.PUBLIC_PIX_BRCODE_PAYLOAD;
    }
  });
});

describe('Story 4.1: Serviço de Doações (DonationService) e Métricas de Arrecadação', () => {
  beforeEach(() => {
    DonationService.clearInMemoryLogs();
  });

  it('deve validar e reconhecer os 6 momentos disparadores permitidos', () => {
    assert.strictEqual(VALID_TRIGGER_MOMENTS.length, 6);
    assert.strictEqual(DonationService.isValidTriggerMoment('shift_completed'), true);
    assert.strictEqual(DonationService.isValidTriggerMoment('level_up'), true);
    assert.strictEqual(DonationService.isValidTriggerMoment('emergency_matched'), true);
    assert.strictEqual(DonationService.isValidTriggerMoment('rating_5_stars'), true);
    assert.strictEqual(DonationService.isValidTriggerMoment('api_1000_requests'), true);
    assert.strictEqual(DonationService.isValidTriggerMoment('manual_donation'), true);

    // Momentos inválidos
    assert.strictEqual(DonationService.isValidTriggerMoment('random_moment'), false);
    assert.strictEqual(DonationService.isValidTriggerMoment(''), false);
  });

  it('deve rejeitar momentos disparadores não autorizados', async () => {
    await assert.rejects(
      async () => {
        await DonationService.logDonationCopy({
          triggerMoment: 'momento_invalido',
          suggestedAmount: 5.0,
        });
      },
      /Momento de doação inválido/
    );
  });

  it('deve rejeitar valores de doação negativos', async () => {
    await assert.rejects(
      async () => {
        await DonationService.logDonationCopy({
          triggerMoment: 'shift_completed',
          suggestedAmount: -10,
        });
      },
      /número não-negativo/
    );
  });

  it('deve registrar com sucesso intenções anônimas de doação', async () => {
    const res = await DonationService.logDonationCopy({
      userId: null,
      triggerMoment: 'emergency_matched',
      suggestedAmount: 5.0,
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.id);

    const stats = await DonationService.getMonthlyDonationStats();
    assert.strictEqual(stats.totalIntents, 1);
    assert.strictEqual(stats.totalEstimatedAmount, 5.0);
    assert.strictEqual(stats.breakdownByMoment.emergency_matched, 1);
  });

  it('deve registrar com sucesso intenções vinculadas a usuário autenticado', async () => {
    const res = await DonationService.logDonationCopy({
      userId: 'user-uuid-12345',
      triggerMoment: 'level_up',
      suggestedAmount: 10.0,
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.id);

    const stats = await DonationService.getMonthlyDonationStats();
    assert.strictEqual(stats.totalIntents, 1);
    assert.strictEqual(stats.totalEstimatedAmount, 10.0);
    assert.strictEqual(stats.uniqueDonorsCount, 1);
    assert.strictEqual(stats.breakdownByMoment.level_up, 1);
  });

  it('deve agregar corretamente múltiplos registros no painel mensal de transparência', async () => {
    await DonationService.logDonationCopy({ userId: 'u1', triggerMoment: 'shift_completed', suggestedAmount: 2.0 });
    await DonationService.logDonationCopy({ userId: 'u2', triggerMoment: 'rating_5_stars', suggestedAmount: 5.0 });
    await DonationService.logDonationCopy({ userId: null, triggerMoment: 'manual_donation', suggestedAmount: 10.0 });
    await DonationService.logDonationCopy({ userId: 'u1', triggerMoment: 'api_1000_requests', suggestedAmount: 20.0 });

    const stats = await DonationService.getMonthlyDonationStats();
    assert.strictEqual(stats.totalIntents, 4);
    assert.strictEqual(stats.totalEstimatedAmount, 37.0);
    assert.strictEqual(stats.uniqueDonorsCount, 2); // 'u1' e 'u2'
    assert.strictEqual(stats.breakdownByMoment.shift_completed, 1);
    assert.strictEqual(stats.breakdownByMoment.rating_5_stars, 1);
    assert.strictEqual(stats.breakdownByMoment.manual_donation, 1);
    assert.strictEqual(stats.breakdownByMoment.api_1000_requests, 1);
  });
});

describe('Story 4.1: SDK Universal (@delivrery/api-client-sdk) com Suporte a PIX', () => {
  it('deve expor método getPixConfig no DelivreryClient', () => {
    const client = new DelivreryClient();
    const config = client.getPixConfig();

    assert.ok(config.key);
    assert.ok(config.recipientName);
    assert.ok(config.city);
    assert.ok(config.brCodePayload.startsWith('000201'));
  });
});
