/**
 * @file profile-validation.test.js
 * @description Suíte de testes automatizados para Story 1.3:
 * Validação rigorosa de CPF (Módulo 11), telefones com DDD, árvore geográfica nacional e regras de perfil.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

import {
  validateCPF,
  formatCPF,
  validatePhone,
  formatPhone,
  cleanDigits
} from '../apps/pwa/src/profile/cpf-validator.ts';

import {
  GeographyService,
  BRAZILIAN_STATES,
  slugify
} from '../apps/pwa/src/geography/geography-service.ts';

import {
  generateReferralCode,
  ProfileService
} from '../apps/pwa/src/profile/profile-service.ts';

// Gerador auxiliar determinístico de CPF válido para testes
function generateValidCPF() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
  
  // DV1
  let s1 = 0;
  for (let i = 0; i < 9; i++) s1 += n[i] * (10 - i);
  let r1 = (s1 * 10) % 11;
  const d1 = (r1 === 10 || r1 === 11) ? 0 : r1;
  n.push(d1);

  // DV2
  let s2 = 0;
  for (let i = 0; i < 10; i++) s2 += n[i] * (11 - i);
  let r2 = (s2 * 10) % 11;
  const d2 = (r2 === 10 || r2 === 11) ? 0 : r2;
  n.push(d2);

  return n.join('');
}

describe('Story 1.3: Validação Rigorosa de CPF (Módulo 11)', () => {
  it('deve aceitar CPFs matematicamente válidos com máscara e sem máscara', () => {
    // CPFs válidos conhecidos gerados matematicamente
    for (let i = 0; i < 5; i++) {
      const validDigits = generateValidCPF();
      assert.strictEqual(validateCPF(validDigits), true, `CPF ${validDigits} deveria ser válido`);
      const masked = formatCPF(validDigits);
      assert.strictEqual(validateCPF(masked), true, `CPF mascarado ${masked} deveria ser válido`);
    }
  });

  it('deve rejeitar CPFs com dígitos verificadores matematicamente inválidos (Matriz Linha 3)', () => {
    assert.strictEqual(validateCPF('123.456.789-00'), false);
    assert.strictEqual(validateCPF('529.982.247-24'), false);
    assert.strictEqual(validateCPF('111.444.777-34'), false);
  });

  it('deve rejeitar sequências de 11 dígitos repetidos (Matriz Linha 4)', () => {
    const invalidRepeated = [
      '000.000.000-00',
      '111.111.111-11',
      '222.222.222-22',
      '333.333.333-33',
      '444.444.444-44',
      '555.555.555-55',
      '666.666.666-66',
      '777.777.777-77',
      '888.888.888-88',
      '999.999.999-99'
    ];

    for (const cpf of invalidRepeated) {
      assert.strictEqual(validateCPF(cpf), false, `CPF repetido ${cpf} deve ser rejeitado`);
    }
  });

  it('deve rejeitar entradas vazias, nulas ou com quantidade de dígitos incorreta', () => {
    assert.strictEqual(validateCPF(''), false);
    assert.strictEqual(validateCPF(null), false);
    assert.strictEqual(validateCPF(undefined), false);
    assert.strictEqual(validateCPF('123'), false);
    assert.strictEqual(validateCPF('123456789012'), false); // 12 dígitos
    assert.strictEqual(validateCPF('abcdefghijk'), false);
  });

  it('deve formatar CPF progressivamente com a máscara 000.000.000-00', () => {
    assert.strictEqual(formatCPF('1'), '1');
    assert.strictEqual(formatCPF('123'), '123');
    assert.strictEqual(formatCPF('1234'), '123.4');
    assert.strictEqual(formatCPF('123456'), '123.456');
    assert.strictEqual(formatCPF('1234567'), '123.456.7');
    assert.strictEqual(formatCPF('12345678901'), '123.456.789-01');
  });
});

describe('Story 1.3: Validação de Telefone Celular Brasileiro com DDD', () => {
  it('deve aceitar telefones celulares válidos de diferentes UFs (11 dígitos, DDD e 9 inicial)', () => {
    const validPhones = [
      '11987654321', // SP
      '21998765432', // RJ
      '31988776655', // MG
      '41991234567', // PR
      '51992345678', // RS
      '61984567890', // DF
      '71993456789'  // BA
    ];

    for (const phone of validPhones) {
      assert.strictEqual(validatePhone(phone), true, `Telefone ${phone} deveria ser válido`);
      const masked = formatPhone(phone);
      assert.strictEqual(validatePhone(masked), true, `Telefone formatado ${masked} deveria ser válido`);
    }
  });

  it('deve rejeitar telefones sem DDD, incompletos ou com DDD inexistente (Matriz Linha 5)', () => {
    assert.strictEqual(validatePhone('9999-9999'), false); // sem DDD
    assert.strictEqual(validatePhone('119876543'), false); // 9 dígitos
    assert.strictEqual(validatePhone('00987654321'), false); // DDD 00 inválido
    assert.strictEqual(validatePhone('36987654321'), false); // DDD 36 não existe no Brasil
    assert.strictEqual(validatePhone('11887654321'), false); // Não começa com 9 no celular
  });

  it('deve formatar telefone celular progressivamente no padrão (00) 00000-0000', () => {
    assert.strictEqual(formatPhone('11'), '(11');
    assert.strictEqual(formatPhone('1198765'), '(11) 98765');
    assert.strictEqual(formatPhone('11987654321'), '(11) 98765-4321');
  });
});

describe('Story 1.3: Provedor da Árvore Geográfica Nacional (Universal AD-8)', () => {
  it('deve conter as 27 Unidades Federativas do Brasil (UFs)', () => {
    const states = GeographyService.getStates();
    assert.strictEqual(states.length, 27);
    const ufs = states.map(s => s.id);
    assert.ok(ufs.includes('SP'));
    assert.ok(ufs.includes('RJ'));
    assert.ok(ufs.includes('MG'));
    assert.ok(ufs.includes('RS'));
    assert.ok(ufs.includes('BA'));
    assert.ok(ufs.includes('DF'));
    assert.ok(ufs.includes('AM'));
  });

  it('deve retornar municípios ao selecionar uma UF (Cascata Geográfica - Matriz Linha 6)', () => {
    const spCities = GeographyService.getCitiesByState('SP');
    assert.ok(spCities.length > 0);
    const names = spCities.map(c => c.name);
    assert.ok(names.includes('São Paulo'));
    assert.ok(names.includes('Campinas'));
  });

  it('deve retornar bairros ao selecionar um município (Cascata Geográfica)', () => {
    const spNeighborhoods = GeographyService.getNeighborhoodsByCity('sao-paulo');
    assert.ok(spNeighborhoods.length > 0);
    const names = spNeighborhoods.map(n => n.name);
    assert.ok(names.includes('Pinheiros'));
    assert.ok(names.includes('Vila Madalena'));
  });

  it('deve criar bairros customizados dinamicamente se não listados', () => {
    const custom = GeographyService.createCustomNeighborhood('sao-paulo', 'Jardim Primavera');
    assert.strictEqual(custom.name, 'Jardim Primavera');
    assert.strictEqual(custom.id, 'sao-paulo-jardim-primavera');
  });

  it('deve converter nomes em slugs limpos via slugify', () => {
    assert.strictEqual(slugify('São Paulo'), 'sao-paulo');
    assert.strictEqual(slugify('Barão Geraldo - Campinas'), 'barao-geraldo-campinas');
  });
});

describe('Story 1.3: Regras de Negócio e Geração de Referral Code', () => {
  it('deve gerar referral_code único no formato LIVRE-XXXXXX', () => {
    const code1 = generateReferralCode('LIVRE');
    const code2 = generateReferralCode('LIVRE');

    assert.ok(code1.startsWith('LIVRE-'));
    assert.strictEqual(code1.length, 12); // LIVRE- (6) + 6 chars
    assert.notStrictEqual(code1, code2);
    // Deve conter apenas caracteres válidos
    assert.match(code1, /^LIVRE-[A-Z0-9]{6}$/);
  });

  it('deve rejeitar cadastro sem identificador do usuário autenticado (Matriz Linha 7)', async () => {
    await assert.rejects(
      async () => {
        await ProfileService.completeCourierProfile({
          userId: '',
          fullName: 'Carlos Silva',
          cpf: generateValidCPF(),
          phoneNumber: '11987654321',
          transportModal: 'motorcycle',
          baseDailyRate: 120,
          baseDeliveryFee: 8,
          stateId: 'SP',
          cityId: 'sao-paulo',
          homeNeighborhoodId: 'pinheiros'
        });
      },
      /Identificador do usuário autenticado é obrigatório/
    );
  });

  it('deve validar dados de entrada do perfil de entregador antes da persistência', async () => {
    // CPF inválido
    await assert.rejects(
      async () => {
        await ProfileService.completeCourierProfile({
          userId: '00000000-0000-0000-0000-000000000001',
          fullName: 'Carlos Silva',
          cpf: '123.456.789-00',
          phoneNumber: '11987654321',
          transportModal: 'motorcycle',
          baseDailyRate: 120,
          baseDeliveryFee: 8,
          stateId: 'SP',
          cityId: 'sao-paulo',
          homeNeighborhoodId: 'pinheiros'
        });
      },
      /CPF inválido/
    );

    // Telefone inválido
    await assert.rejects(
      async () => {
        await ProfileService.completeCourierProfile({
          userId: '00000000-0000-0000-0000-000000000001',
          fullName: 'Carlos Silva',
          cpf: generateValidCPF(),
          phoneNumber: '12345',
          transportModal: 'motorcycle',
          baseDailyRate: 120,
          baseDeliveryFee: 8,
          stateId: 'SP',
          cityId: 'sao-paulo',
          homeNeighborhoodId: 'pinheiros'
        });
      },
      /Telefone celular inválido/
    );
  });

  it('deve validar dados de entrada do perfil de lojista antes da persistência', async () => {
    // Sem nome de loja
    await assert.rejects(
      async () => {
        await ProfileService.completeStoreProfile({
          userId: '00000000-0000-0000-0000-000000000001',
          fullName: 'Maria Lojista',
          cpf: generateValidCPF(),
          phoneNumber: '11987654321',
          storeName: '',
          stateId: 'SP',
          cityId: 'sao-paulo',
          neighborhoodId: 'pinheiros'
        });
      },
      /Informe o nome fantasia ou razão social da loja/
    );
  });
});

describe('Story 1.3: Integridade da Migration de Geografia e Quórum (20260904160000)', () => {
  it('deve validar a existência do arquivo SQL de migration e suas definições DDL', () => {
    const migrationPath = path.join(
      rootDir,
      'supabase/migrations/20260904160000_update_courier_profiles_geography.sql'
    );
    assert.ok(fs.existsSync(migrationPath), 'Arquivo de migration 20260904160000 deve existir');

    const sql = fs.readFileSync(migrationPath, 'utf-8');
    assert.match(sql, /ALTER TABLE public\.courier_profiles/i, 'Deve alterar courier_profiles');
    assert.match(sql, /ADD COLUMN IF NOT EXISTS state_id/i, 'Deve adicionar state_id');
    assert.match(sql, /ADD COLUMN IF NOT EXISTS city_id/i, 'Deve adicionar city_id');
    assert.match(sql, /ADD COLUMN IF NOT EXISTS home_neighborhood_id/i, 'Deve adicionar home_neighborhood_id');
    assert.match(sql, /ADD COLUMN IF NOT EXISTS referred_by_id/i, 'Deve adicionar referred_by_id');
    assert.match(sql, /sync_region_unlock_quorum/i, 'Deve definir função de quórum regional');
    assert.match(sql, /trg_courier_quorum_sync/i, 'Deve definir trigger para courier_profiles');
    assert.match(sql, /trg_store_quorum_sync/i, 'Deve definir trigger para store_profiles');
  });
});

