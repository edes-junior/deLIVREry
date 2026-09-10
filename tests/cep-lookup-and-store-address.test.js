/**
 * @file tests/cep-lookup-and-store-address.test.js
 * @description Testes automatizados para serviço de consulta de CEP,
 * autocompletar de endereços, foco e persistência de CEP/complemento no perfil do lojista.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { 
  cleanCEP, 
  formatCEP, 
  validateCEP, 
  fetchAddressByCep 
} from '../apps/pwa/src/geography/cep-service.ts';
import { ProfileService } from '../apps/pwa/src/profile/profile-service.ts';

describe('Feature: Autocompletar de CEP e Endereço do Lojista', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Formatação e Validação de CEP', () => {
    test('deve limpar caracteres não numéricos do CEP', () => {
      assert.equal(cleanCEP('01310-100'), '01310100');
      assert.equal(cleanCEP('01.310-100'), '01310100');
      assert.equal(cleanCEP('abc 01310 100 xyz'), '01310100');
      assert.equal(cleanCEP(''), '');
    });

    test('deve formatar CEP na máscara brasileira 00000-000', () => {
      assert.equal(formatCEP('01310100'), '01310-100');
      assert.equal(formatCEP('01310'), '01310');
      assert.equal(formatCEP('12345678999'), '12345-678');
    });

    test('deve validar CEPs válidos e rejeitar inválidos ou homogêneos', () => {
      assert.equal(validateCEP('01310-100'), true);
      assert.equal(validateCEP('01310100'), true);
      assert.equal(validateCEP('1234567'), false); // 7 dígitos
      assert.equal(validateCEP('123456789'), false); // 9 dígitos
      assert.equal(validateCEP('00000000'), false); // homogêneo
      assert.equal(validateCEP('11111111'), false); // homogêneo
      assert.equal(validateCEP('invalid'), false);
    });
  });

  describe('Serviço de Consulta de Endereço (ViaCEP e BrasilAPI Fallback)', () => {
    test('Cenário 1: Consulta com sucesso no ViaCEP (Provedor Primário)', async () => {
      globalThis.fetch = async (url) => {
        if (url.includes('viacep.com.br')) {
          return {
            ok: true,
            json: async () => ({
              cep: '01310-100',
              logradouro: 'Avenida Paulista',
              bairro: 'Bela Vista',
              localidade: 'São Paulo',
              uf: 'SP'
            })
          };
        }
        throw new Error('Fallback não deveria ser chamado');
      };

      const res = await fetchAddressByCep('01310100');
      assert.equal(res.success, true);
      assert.equal(res.street, 'Avenida Paulista');
      assert.equal(res.neighborhood, 'Bela Vista');
      assert.equal(res.city, 'São Paulo');
      assert.equal(res.state, 'SP');
      assert.equal(res.postalCode, '01310-100');
    });

    test('Cenário 2: Falha no ViaCEP aciona fallback com sucesso na BrasilAPI', async () => {
      globalThis.fetch = async (url) => {
        if (url.includes('viacep.com.br')) {
          // Simula falha de servidor 500 no ViaCEP
          return { ok: false, status: 500 };
        }
        if (url.includes('brasilapi.com.br')) {
          return {
            ok: true,
            json: async () => ({
              cep: '20040002',
              street: 'Avenida Rio Branco',
              neighborhood: 'Centro',
              city: 'Rio de Janeiro',
              state: 'RJ'
            })
          };
        }
        throw new Error('URL inesperada: ' + url);
      };

      const res = await fetchAddressByCep('20040-002');
      assert.equal(res.success, true);
      assert.equal(res.street, 'Avenida Rio Branco');
      assert.equal(res.neighborhood, 'Centro');
      assert.equal(res.city, 'Rio de Janeiro');
      assert.equal(res.state, 'RJ');
      assert.equal(res.postalCode, '20040-002');
    });

    test('Cenário 3: CEP inexistente (ViaCEP retorna erro: true)', async () => {
      globalThis.fetch = async (url) => {
        if (url.includes('viacep.com.br')) {
          return {
            ok: true,
            json: async () => ({ erro: true })
          };
        }
        if (url.includes('brasilapi.com.br')) {
          return {
            ok: false,
            status: 404,
            json: async () => ({ errors: [{ message: 'CEP não encontrado' }] })
          };
        }
        throw new Error('URL inesperada');
      };

      const res = await fetchAddressByCep('99999998');
      assert.equal(res.success, false);
      assert.match(res.error, /Não foi possível localizar o endereço/);
    });
  });

  describe('Persistência e DTOs de Lojista com CEP e Complemento', () => {
    test('updateStoreProfile deve incluir postal_code e address_complement no update', async () => {
      let updatedPayload = null;

      const mockClient = {
        from: (table) => {
          assert.equal(table, 'store_profiles');
          return {
            update: (payload) => {
              updatedPayload = payload;
              return {
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: { user_id: 'store-1', ...payload },
                      error: null
                    })
                  })
                })
              };
            }
          };
        }
      };

      // Mock user update
      const mockUserClient = {
        from: (table) => {
          if (table === 'users') {
            return {
              update: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: { id: 'store-1', full_name: 'Loja Teste', phone_number: '(11) 98888-7777', user_type: 'store' },
                      error: null
                    })
                  })
                })
              })
            };
          }
          return mockClient.from(table);
        }
      };

      const result = await ProfileService.updateStoreProfile({
        userId: 'store-1',
        fullName: 'Responsável Loja',
        phoneNumber: '(11) 98888-7777',
        storeName: 'Hamburgueria Artesanal',
        addressStreet: 'Rua Augusta',
        addressNumber: '500',
        addressComplement: 'Sala 102 - Sobreloja',
        postalCode: '01305-000',
        stateId: 'SP',
        cityId: 'sao-paulo',
        neighborhoodId: 'consolacao'
      }, mockUserClient);

      assert.ok(result);
      assert.equal(updatedPayload.postal_code, '01305000');
      assert.equal(updatedPayload.address_complement, 'Sala 102 - Sobreloja');
      assert.equal(updatedPayload.address_street, 'Rua Augusta');
      assert.equal(updatedPayload.address_number, '500');
    });

    test('validação do arquivo SQL de migration para CEP e complemento', () => {
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/20260910100000_multi_neighborhoods_and_store_address.sql'
      );
      assert.ok(fs.existsSync(migrationPath), 'Arquivo de migration deve existir');

      const content = fs.readFileSync(migrationPath, 'utf-8');
      assert.match(content, /ALTER TABLE public\.store_profiles/);
      assert.match(content, /postal_code VARCHAR\(9\)/);
      assert.match(content, /address_complement VARCHAR\(150\)/);
      assert.match(content, /check_store_postal_code_format/);
      assert.match(content, /idx_store_profiles_postal_code/);
    });
  });
});
