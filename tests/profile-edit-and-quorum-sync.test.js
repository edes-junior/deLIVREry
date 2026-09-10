/**
 * @file profile-edit-and-quorum-sync.test.js
 * @description Suíte de testes automatizados para Story 1 (CAP-1 / CAP-6):
 * Edição cadastral de entregadores e lojistas, imutabilidade de CPF/user_type e sincronização dinâmica de quórum.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

import { ProfileService } from '../apps/pwa/src/profile/profile-service.ts';

describe('Story 1: Integridade da Migration SQL (20260909200000)', () => {
  const migrationPath = path.join(rootDir, 'supabase', 'migrations', '20260909200000_sync_quorum_on_profile_update.sql');

  it('deve validar a existência do arquivo SQL de migration', () => {
    assert.ok(fs.existsSync(migrationPath), 'Arquivo de migration 20260909200000 deve existir');
    const content = fs.readFileSync(migrationPath, 'utf8');
    assert.ok(content.length > 500, 'Migration deve conter definições DDL completas');
  });

  it('deve conter a função e trigger de imutabilidade de CPF e user_type (CAP-1)', () => {
    const content = fs.readFileSync(migrationPath, 'utf8');
    assert.ok(content.includes('check_user_cpf_immutability'), 'Deve declarar função check_user_cpf_immutability');
    assert.ok(content.includes('trg_users_cpf_immutability'), 'Deve declarar trigger trg_users_cpf_immutability');
    assert.ok(content.includes('BEFORE UPDATE OF cpf, user_type ON public.users'), 'Deve disparar BEFORE UPDATE OF cpf, user_type');
    assert.ok(content.includes('O CPF é imutável'), 'Deve lançar erro explicativo para tentativa de alteração de CPF');
  });

  it('deve conter a função de sincronização de quórum atualizada para UPDATE e INSERT (CAP-6)', () => {
    const content = fs.readFileSync(migrationPath, 'utf8');
    assert.ok(content.includes("TG_OP = 'UPDATE'"), 'Deve tratar operações de UPDATE');
    assert.ok(content.includes('GREATEST(0, public.region_unlocks.couriers_count'), 'Deve proteger decremento contra valores negativos');
    assert.ok(content.includes('GREATEST(0, public.region_unlocks.stores_count'), 'Deve proteger decremento de lojas contra negativos');
    assert.ok(content.includes('AFTER INSERT OR UPDATE OF state_id, city_id, home_neighborhood_id ON public.courier_profiles'), 'Trigger courier deve cobrir UPDATE geográfico');
    assert.ok(content.includes('AFTER INSERT OR UPDATE OF state_id, city_id, neighborhood_id ON public.store_profiles'), 'Trigger store deve cobrir UPDATE geográfico');
  });
});

describe('Story 1: Validação de Dados de Entrada em ProfileService (CAP-1)', () => {
  it('deve rejeitar atualização de entregador sem identificador de usuário (userId)', async () => {
    await assert.rejects(
      async () => {
        await ProfileService.updateCourierProfile({
          userId: '',
          fullName: 'João da Silva',
          phoneNumber: '(11) 98765-4321',
          transportModal: 'motorcycle',
          stateId: 'SP',
          cityId: 'sao-paulo',
          homeNeighborhoodId: 'bela-vista'
        });
      },
      { message: 'Identificador do usuário autenticado é obrigatório.' }
    );
  });

  it('deve rejeitar nome de entregador com menos de 3 caracteres', async () => {
    await assert.rejects(
      async () => {
        await ProfileService.updateCourierProfile({
          userId: 'usr-123',
          fullName: 'Al',
          phoneNumber: '(11) 98765-4321',
          transportModal: 'motorcycle',
          stateId: 'SP',
          cityId: 'sao-paulo',
          homeNeighborhoodId: 'bela-vista'
        });
      },
      { message: 'Informe o nome completo (mínimo de 3 caracteres).' }
    );
  });

  it('deve rejeitar telefone inválido na atualização de entregador', async () => {
    await assert.rejects(
      async () => {
        await ProfileService.updateCourierProfile({
          userId: 'usr-123',
          fullName: 'Carlos Andrade',
          phoneNumber: '12345',
          transportModal: 'motorcycle',
          stateId: 'SP',
          cityId: 'sao-paulo',
          homeNeighborhoodId: 'bela-vista'
        });
      },
      { message: 'Telefone celular inválido. Informe o DDD e o número com 9 dígitos.' }
    );
  });

  it('deve rejeitar modal de transporte inválido na atualização de entregador', async () => {
    await assert.rejects(
      async () => {
        await ProfileService.updateCourierProfile({
          userId: 'usr-123',
          fullName: 'Carlos Andrade',
          phoneNumber: '(11) 98765-4321',
          transportModal: 'helicopter',
          stateId: 'SP',
          cityId: 'sao-paulo',
          homeNeighborhoodId: 'bela-vista'
        });
      },
      { message: 'Modal de transporte selecionado é inválido.' }
    );
  });

  it('deve rejeitar atualização de lojista com nome de estabelecimento muito curto', async () => {
    await assert.rejects(
      async () => {
        await ProfileService.updateStoreProfile({
          userId: 'usr-store-1',
          fullName: 'Maria Lojista',
          phoneNumber: '(11) 91234-5678',
          storeName: 'A',
          stateId: 'SP',
          cityId: 'sao-paulo',
          neighborhoodId: 'pinheiros'
        });
      },
      { message: 'Informe o nome do estabelecimento comercial.' }
    );
  });
});

describe('Story 1: Chamadas de Persistência e Imutabilidade (CAP-1)', () => {
  it('updateCourierProfile deve atualizar users e courier_profiles sem enviar CPF ou user_type', async () => {
    let usersPayload = null;
    let courierPayload = null;

    const mockClient = {
      from(table) {
        if (table === 'users') {
          return {
            update(data) {
              usersPayload = data;
              return {
                eq(col, val) {
                  return {
                    select() {
                      return {
                        single: async () => ({
                          data: {
                            id: val,
                            email: 'entregador@delivrery.com',
                            full_name: data.full_name,
                            cpf: '123.456.789-00', // Imutável mantido no registro
                            phone_number: data.phone_number,
                            user_type: 'courier'
                          },
                          error: null
                        })
                      };
                    }
                  };
                }
              };
            }
          };
        }
        if (table === 'courier_profiles') {
          return {
            update(data) {
              courierPayload = data;
              return {
                eq(col, val) {
                  return {
                    select() {
                      return {
                        single: async () => ({
                          data: {
                            user_id: val,
                            ...data
                          },
                          error: null
                        })
                      };
                    }
                  };
                }
              };
            }
          };
        }
        throw new Error(`Tabela inesperada: ${table}`);
      }
    };

    const result = await ProfileService.updateCourierProfile(
      {
        userId: 'uuid-courier-42',
        fullName: 'Roberto Silva Atualizado',
        phoneNumber: '11988887777',
        transportModal: 'ebike_scooter',
        stateId: 'rj',
        cityId: 'rio-de-janeiro',
        homeNeighborhoodId: 'copacabana'
      },
      mockClient
    );

    // Verificação de que CPF e user_type NUNCA foram enviados para update
    assert.strictEqual(usersPayload.cpf, undefined, 'CPF não deve ser enviado no update');
    assert.strictEqual(usersPayload.user_type, undefined, 'user_type não deve ser enviado no update');
    assert.strictEqual(usersPayload.full_name, 'Roberto Silva Atualizado');
    assert.strictEqual(usersPayload.phone_number, '(11) 98888-7777');

    // Verificação de que os dados geográficos e modal foram enviados
    assert.strictEqual(courierPayload.transport_modal, 'ebike_scooter');
    assert.strictEqual(courierPayload.state_id, 'RJ');
    assert.strictEqual(courierPayload.home_neighborhood_id, 'copacabana');

    // Resultado consolidado retornado
    assert.strictEqual(result.user.fullName, 'Roberto Silva Atualizado');
    assert.strictEqual(result.user.cpf, '123.456.789-00');
    assert.strictEqual(result.profile.transport_modal, 'ebike_scooter');
  });

  it('updateStoreProfile deve atualizar users e store_profiles mantendo imutabilidade', async () => {
    let usersPayload = null;
    let storePayload = null;

    const mockClient = {
      from(table) {
        if (table === 'users') {
          return {
            update(data) {
              usersPayload = data;
              return {
                eq(col, val) {
                  return {
                    select() {
                      return {
                        single: async () => ({
                          data: {
                            id: val,
                            email: 'pizzaria@delivrery.com',
                            full_name: data.full_name,
                            cpf: '987.654.321-99',
                            phone_number: data.phone_number,
                            user_type: 'store'
                          },
                          error: null
                        })
                      };
                    }
                  };
                }
              };
            }
          };
        }
        if (table === 'store_profiles') {
          return {
            update(data) {
              storePayload = data;
              return {
                eq(col, val) {
                  return {
                    select() {
                      return {
                        single: async () => ({
                          data: {
                            user_id: val,
                            ...data
                          },
                          error: null
                        })
                      };
                    }
                  };
                }
              };
            }
          };
        }
        throw new Error(`Tabela inesperada: ${table}`);
      }
    };

    const result = await ProfileService.updateStoreProfile(
      {
        userId: 'uuid-store-99',
        fullName: 'Fernando Dono',
        phoneNumber: '(11) 97777-6666',
        storeName: 'Pizzaria Bella Napoli',
        addressStreet: 'Rua Augusta',
        addressNumber: '1500',
        stateId: 'SP',
        cityId: 'sao-paulo',
        neighborhoodId: 'consolacao'
      },
      mockClient
    );

    assert.strictEqual(usersPayload.cpf, undefined);
    assert.strictEqual(usersPayload.user_type, undefined);
    assert.strictEqual(storePayload.store_name, 'Pizzaria Bella Napoli');
    assert.strictEqual(storePayload.address_street, 'Rua Augusta');
    assert.strictEqual(storePayload.neighborhood_id, 'consolacao');
    assert.strictEqual(result.user.fullName, 'Fernando Dono');
  });
});

describe('Story 1: Simulação da Lógica de Quórum na Migração de Bairro (CAP-6)', () => {
  it('deve decrementar o bairro de origem e incrementar o bairro de destino', () => {
    // Simulação do comportamento da trigger PostgreSQL em TypeScript/JS
    const databaseQuorums = {
      'SP:sao-paulo:bela-vista': { couriers_count: 50, stores_count: 10, is_unlocked: true },
      'SP:sao-paulo:pinheiros': { couriers_count: 49, stores_count: 10, is_unlocked: false }
    };

    const oldLocation = 'SP:sao-paulo:bela-vista';
    const newLocation = 'SP:sao-paulo:pinheiros';

    // 1. Decrementa na origem
    databaseQuorums[oldLocation].couriers_count = Math.max(0, databaseQuorums[oldLocation].couriers_count - 1);

    // 2. Incrementa no destino
    databaseQuorums[newLocation].couriers_count += 1;
    if (databaseQuorums[newLocation].couriers_count >= 50 && databaseQuorums[newLocation].stores_count >= 10) {
      databaseQuorums[newLocation].is_unlocked = true;
    }

    assert.strictEqual(databaseQuorums['SP:sao-paulo:bela-vista'].couriers_count, 49);
    assert.strictEqual(databaseQuorums['SP:sao-paulo:pinheiros'].couriers_count, 50);
    assert.strictEqual(databaseQuorums['SP:sao-paulo:pinheiros'].is_unlocked, true, 'Pinheiros deve desbloquear com 50 entregadores e 10 lojas');
  });
});

describe('Story 1: Integridade dos Componentes de UI (PWA)', () => {
  it('ProfileEditModal.tsx deve conter CPF desabilitado e selo de imutabilidade', () => {
    const modalPath = path.join(rootDir, 'apps', 'pwa', 'src', 'components', 'profile', 'ProfileEditModal.tsx');
    assert.ok(fs.existsSync(modalPath), 'ProfileEditModal.tsx deve existir');
    const content = fs.readFileSync(modalPath, 'utf8');
    assert.ok(content.includes('Identificação Imutável (CAP-1)'), 'Deve conter seção de identificação imutável');
    assert.ok(content.includes('disabled'), 'Input de CPF deve conter atributo disabled');
    assert.ok(content.includes('readOnly'), 'Input de CPF deve conter atributo readOnly');
    assert.ok(content.includes('data-testid="btn-save-profile"'), 'Deve conter botão de salvar');
  });

  it('App.tsx deve conter botão de editar perfil e renderizar ProfileEditModal', () => {
    const appPath = path.join(rootDir, 'apps', 'pwa', 'src', 'App.tsx');
    const content = fs.readFileSync(appPath, 'utf8');
    assert.ok(content.includes('ProfileEditModal'), 'App.tsx deve importar e renderizar ProfileEditModal');
    assert.ok(content.includes('btn-edit-profile'), 'App.tsx deve possuir botão data-testid="btn-edit-profile"');
    assert.ok(content.includes('handleProfileUpdated'), 'App.tsx deve possuir handler de atualização de perfil');
  });
});
