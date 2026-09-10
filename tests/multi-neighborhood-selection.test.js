/**
 * @file tests/multi-neighborhood-selection.test.js
 * @description Testes automatizados para suporte a múltiplos bairros de atuação para entregadores,
 * preservação de bairro único para lojas e filtragem de vagas no feed.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { ProfileService } from '../apps/pwa/src/profile/profile-service.ts';
import { listOpenJobs } from '../apps/pwa/src/jobs/job-service.ts';

describe('Feature: Múltiplos Bairros de Atuação (Entregador vs Loja)', () => {
  describe('Persistência e DTOs de Entregador com Múltiplos Bairros', () => {
    test('Cenário 1: updateCourierProfile persiste array de operating_neighborhoods', async () => {
      let updatedCourierPayload = null;

      const mockClient = {
        from: (table) => {
          if (table === 'users') {
            return {
              update: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: { id: 'c-123', full_name: 'Entregador Silva', phone_number: '(11) 99999-1111', user_type: 'courier' },
                      error: null
                    })
                  })
                })
              })
            };
          }
          if (table === 'courier_profiles') {
            return {
              update: (payload) => {
                updatedCourierPayload = payload;
                return {
                  eq: () => ({
                    select: () => ({
                      single: async () => ({
                        data: { user_id: 'c-123', ...payload },
                        error: null
                      })
                    })
                  })
                };
              }
            };
          }
          throw new Error('Tabela inesperada: ' + table);
        }
      };

      const res = await ProfileService.updateCourierProfile({
        userId: 'c-123',
        fullName: 'Entregador Silva',
        phoneNumber: '(11) 99999-1111',
        transportModal: 'motorcycle',
        stateId: 'SP',
        cityId: 'sao-paulo',
        homeNeighborhoodId: 'pinheiros',
        operatingNeighborhoods: ['pinheiros', 'vila-madalena', 'itaim-bibi']
      }, mockClient);

      assert.ok(res);
      assert.deepEqual(updatedCourierPayload.operating_neighborhoods, [
        'pinheiros',
        'vila-madalena',
        'itaim-bibi'
      ]);
      assert.equal(updatedCourierPayload.home_neighborhood_id, 'pinheiros');
    });

    test('Cenário 2: Se operatingNeighborhoods estiver vazio, adota [homeNeighborhoodId] como fallback', async () => {
      let updatedCourierPayload = null;

      const mockClient = {
        from: (table) => {
          if (table === 'users') {
            return {
              update: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: { id: 'c-456', full_name: 'Entregador Santos', phone_number: '(11) 99999-2222', user_type: 'courier' },
                      error: null
                    })
                  })
                })
              })
            };
          }
          if (table === 'courier_profiles') {
            return {
              update: (payload) => {
                updatedCourierPayload = payload;
                return {
                  eq: () => ({
                    select: () => ({
                      single: async () => ({
                        data: { user_id: 'c-456', ...payload },
                        error: null
                      })
                    })
                  })
                };
              }
            };
          }
          throw new Error('Tabela inesperada');
        }
      };

      await ProfileService.updateCourierProfile({
        userId: 'c-456',
        fullName: 'Entregador Santos',
        phoneNumber: '(11) 99999-2222',
        transportModal: 'bicycle',
        stateId: 'SP',
        cityId: 'sao-paulo',
        homeNeighborhoodId: 'perdizes',
        operatingNeighborhoods: []
      }, mockClient);

      assert.deepEqual(updatedCourierPayload.operating_neighborhoods, ['perdizes']);
    });

    test('Cenário 3: Perfil do Lojista permanece estritamente com bairro único da loja', async () => {
      let updatedStorePayload = null;

      const mockClient = {
        from: (table) => {
          if (table === 'users') {
            return {
              update: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: { id: 's-789', full_name: 'Pizzaria Nobre', phone_number: '(11) 98888-3333', user_type: 'store' },
                      error: null
                    })
                  })
                })
              })
            };
          }
          if (table === 'store_profiles') {
            return {
              update: (payload) => {
                updatedStorePayload = payload;
                return {
                  eq: () => ({
                    select: () => ({
                      single: async () => ({
                        data: { user_id: 's-789', ...payload },
                        error: null
                      })
                    })
                  })
                };
              }
            };
          }
          throw new Error('Tabela inesperada');
        }
      };

      await ProfileService.updateStoreProfile({
        userId: 's-789',
        fullName: 'Gerente da Loja',
        phoneNumber: '(11) 98888-3333',
        storeName: 'Pizzaria Nobre',
        addressStreet: 'Rua Bela Cintra',
        addressNumber: '100',
        stateId: 'SP',
        cityId: 'sao-paulo',
        neighborhoodId: 'consolacao'
      }, mockClient);

      assert.equal(updatedStorePayload.neighborhood_id, 'consolacao');
      assert.equal(typeof updatedStorePayload.neighborhood_id, 'string');
      assert.equal(updatedStorePayload.operating_neighborhoods, undefined);
    });
  });

  describe('Filtragem de Vagas Abertas com Múltiplos Bairros (listOpenJobs)', () => {
    test('Cenário 4: listOpenJobs filtra corretamente por array de neighborhood_ids', async () => {
      const allJobs = [
        { id: 'job-1', neighborhood_id: 'pinheiros', status: 'open', accepted_modals: ['motorcycle'] },
        { id: 'job-2', neighborhood_id: 'vila-madalena', status: 'open', accepted_modals: ['motorcycle'] },
        { id: 'job-3', neighborhood_id: 'mooca', status: 'open', accepted_modals: ['motorcycle'] },
        { id: 'job-4', neighborhood_id: 'santana', status: 'open', accepted_modals: ['motorcycle'] }
      ];

      const mockClient = {
        from: (table) => {
          assert.equal(table, 'job_posts');
          return {
            select: () => ({
              eq: () => ({
                in: (col, values) => {
                  assert.equal(col, 'neighborhood_id');
                  return {
                    order: async () => ({
                      data: allJobs.filter((j) => values.includes(j.neighborhood_id)),
                      error: null
                    })
                  };
                }
              })
            })
          };
        }
      };

      const result = await listOpenJobs(
        {
          neighborhood_ids: ['pinheiros', 'vila-madalena']
        },
        mockClient
      );

      assert.equal(result.success, true);
      assert.equal(result.jobs.length, 2);
      assert.ok(result.jobs.some((j) => j.neighborhood_id === 'pinheiros'));
      assert.ok(result.jobs.some((j) => j.neighborhood_id === 'vila-madalena'));
      assert.ok(!result.jobs.some((j) => j.neighborhood_id === 'mooca'));
    });
  });

  describe('Integridade da Migration SQL', () => {
    test('Cenário 5: Migration contém coluna operating_neighborhoods e índice GIN', () => {
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/20260910100000_multi_neighborhoods_and_store_address.sql'
      );
      const content = fs.readFileSync(migrationPath, 'utf-8');

      assert.match(content, /ALTER TABLE public\.courier_profiles/);
      assert.match(content, /operating_neighborhoods VARCHAR\(100\)\[\]/);
      assert.match(content, /CREATE INDEX IF NOT EXISTS idx_courier_operating_neighborhoods/);
      assert.match(content, /USING GIN \(operating_neighborhoods\)/);
    });
  });
});
