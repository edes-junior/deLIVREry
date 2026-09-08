import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateEmail,
  sendMagicLink,
  checkProfileCompletion,
  getSession,
} from '../apps/pwa/src/auth/auth-service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Matrix Scenario 1 & 2: Email validation logic', () => {
  // Valid emails
  assert.equal(validateEmail('motoboy@exemplo.com.br').valid, true);
  assert.equal(validateEmail('lojista.pizzaria@gmail.com').valid, true);
  assert.equal(validateEmail('user+teste@delivrery.app').valid, true);

  // Invalid emails
  const emptyRes = validateEmail('');
  assert.equal(emptyRes.valid, false);
  assert.match(emptyRes.error || '', /obrigatório/);

  const invalidFormat1 = validateEmail('email_invalido@');
  assert.equal(invalidFormat1.valid, false);
  assert.match(invalidFormat1.error || '', /válido/);

  const invalidFormat2 = validateEmail('sem_arroba.com');
  assert.equal(invalidFormat2.valid, false);
});

test('Matrix Scenario 1: sendMagicLink with valid email dispatches OTP', async () => {
  let calledWith = null;
  const mockClient = {
    auth: {
      async signInWithOtp(params) {
        calledWith = params;
        return { error: null };
      },
    },
  };

  const response = await sendMagicLink('entregador@delivrery.app.br', 'http://localhost:5173/auth/callback', mockClient);
  assert.equal(response.success, true);
  assert.match(response.message, /sucesso/);
  assert.equal(calledWith.email, 'entregador@delivrery.app.br');
  assert.equal(calledWith.options.emailRedirectTo, 'http://localhost:5173/auth/callback');
});

test('Matrix Scenario 2: sendMagicLink with invalid email blocks before calling client', async () => {
  let wasCalled = false;
  const mockClient = {
    auth: {
      async signInWithOtp() {
        wasCalled = true;
        return { error: null };
      },
    },
  };

  const response = await sendMagicLink('email_invalido@', undefined, mockClient);
  assert.equal(response.success, false);
  assert.equal(wasCalled, false, 'Client must not be called on validation error');
  assert.match(response.message, /válido/);
});

test('Matrix Scenario 4: checkProfileCompletion detects incomplete profile for newly authenticated users', async () => {
  // Case A: User has record but no CPF and no user_type
  const mockClientNewUser = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: { cpf: null, user_type: null },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const statusNew = await checkProfileCompletion('uuid-novo-usuario', mockClientNewUser);
  assert.equal(statusNew.completed, false);
  assert.equal(statusNew.needsProfileCompletion, true);

  // Case B: User has completed CPF and user_type
  const mockClientCompleted = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: { cpf: '12345678901', user_type: 'courier' },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const statusDone = await checkProfileCompletion('uuid-usuario-completo', mockClientCompleted);
  assert.equal(statusDone.completed, true);
  assert.equal(statusDone.needsProfileCompletion, false);
  assert.equal(statusDone.userType, 'courier');
});

test('Matrix Scenario 5: getSession retrieves active persisted session', async () => {
  const fakeSession = {
    access_token: 'fake-jwt-token',
    user: { id: 'usr-123', email: 'test@delivrery.app' },
  };

  const mockClient = {
    auth: {
      async getSession() {
        return { data: { session: fakeSession }, error: null };
      },
    },
  };

  const session = await getSession(mockClient);
  assert.deepEqual(session, fakeSession);
});

test('Migration 20260904150000_auth_user_sync_trigger.sql integrity', () => {
  const migrationPath = path.join(
    rootDir,
    'supabase/migrations/20260904150000_auth_user_sync_trigger.sql'
  );
  assert.equal(fs.existsSync(migrationPath), true, 'Trigger migration must exist');

  const sql = fs.readFileSync(migrationPath, 'utf-8');
  assert.match(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.handle_new_auth_user/, 'Must define handle_new_auth_user function');
  assert.match(sql, /CREATE\s+TRIGGER\s+on_auth_user_created/, 'Must define on_auth_user_created trigger');
  assert.match(sql, /AFTER\s+INSERT\s+ON\s+auth\.users/, 'Trigger must hook on auth.users insert');
  assert.match(sql, /ALTER\s+TABLE\s+public\.users\s+ALTER\s+COLUMN\s+cpf\s+DROP\s+NOT\s+NULL;/, 'CPF must be nullable for initial magic link');
});
