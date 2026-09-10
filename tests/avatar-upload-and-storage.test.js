/**
 * @file avatar-upload-and-storage.test.js
 * @description Suíte de testes automatizados para Story 2 (CAP-2):
 * Upload, armazenamento no Supabase Storage e renderização de fotos de perfil com RLS.
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
  AvatarService, 
  ALLOWED_AVATAR_MIME_TYPES, 
  MAX_AVATAR_SIZE_BYTES 
} from '../apps/pwa/src/profile/avatar-service.ts';

describe('Story 2: Integridade da Migration do Storage de Avatares (20260909210000)', () => {
  const migrationPath = path.join(rootDir, 'supabase', 'migrations', '20260909210000_create_avatars_storage_bucket.sql');

  it('deve validar a existência do arquivo SQL de migration de avatares', () => {
    assert.ok(fs.existsSync(migrationPath), 'Arquivo de migration 20260909210000 deve existir');
    const content = fs.readFileSync(migrationPath, 'utf8');
    assert.ok(content.length > 500, 'Migration deve conter definições completas');
  });

  it('deve conter a adição da coluna avatar_url na tabela users (CAP-2)', () => {
    const content = fs.readFileSync(migrationPath, 'utf8');
    assert.ok(content.includes('ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500)'), 'Deve conter ADD COLUMN avatar_url');
  });

  it('deve registrar o bucket avatars com limite de 5MB e MIME types restritos', () => {
    const content = fs.readFileSync(migrationPath, 'utf8');
    assert.ok(content.includes("'avatars'"), 'Deve registrar bucket avatars');
    assert.ok(content.includes('5242880'), 'Deve definir limite de 5MB (5242880 bytes)');
    assert.ok(content.includes('image/jpeg') && content.includes('image/png') && content.includes('image/webp'), 'Deve restringir aos tipos MIME válidos');
  });

  it('deve conter as políticas de RLS granulares para storage.objects', () => {
    const content = fs.readFileSync(migrationPath, 'utf8');
    assert.ok(content.includes('Public Access to Avatars'), 'Deve conter SELECT público para visualização de avatares');
    assert.ok(content.includes('Users can upload own avatar'), 'Deve conter INSERT restrito ao proprietário');
    assert.ok(content.includes('Users can update own avatar'), 'Deve conter UPDATE restrito ao proprietário');
    assert.ok(content.includes('Users can delete own avatar'), 'Deve conter DELETE restrito ao proprietário');
    assert.ok(content.includes('auth.uid()::text = (storage.foldername(name))[1]'), 'Deve validar pasta correspondente ao auth.uid()');
  });
});

describe('Story 2: Validação Client-Side de Arquivos de Avatar (CAP-2)', () => {
  it('deve rejeitar arquivo nulo ou indefinido', () => {
    const resNull = AvatarService.validateAvatarFile(null);
    assert.strictEqual(resNull.valid, false);
    assert.strictEqual(resNull.error, 'Nenhum arquivo foi selecionado.');

    const resUndef = AvatarService.validateAvatarFile(undefined);
    assert.strictEqual(resUndef.valid, false);
  });

  it('deve rejeitar tipos MIME não permitidos (ex: PDF, executáveis, vídeos)', () => {
    const resPdf = AvatarService.validateAvatarFile({ type: 'application/pdf', size: 1024 });
    assert.strictEqual(resPdf.valid, false);
    assert.ok(resPdf.error.includes('Formato de imagem inválido'));

    const resExe = AvatarService.validateAvatarFile({ type: 'application/x-msdownload', size: 2048 });
    assert.strictEqual(resExe.valid, false);

    const resGif = AvatarService.validateAvatarFile({ type: 'image/gif', size: 1024 });
    assert.strictEqual(resGif.valid, false);
  });

  it('deve rejeitar imagens que excedam o limite máximo de 5MB', () => {
    const oversizedFile = {
      type: 'image/jpeg',
      size: 5 * 1024 * 1024 + 1 // 5MB + 1 byte
    };
    const res = AvatarService.validateAvatarFile(oversizedFile);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, 'A imagem deve ter no máximo 5MB.');
  });

  it('deve rejeitar imagens vazias (0 bytes)', () => {
    const emptyFile = { type: 'image/png', size: 0 };
    const res = AvatarService.validateAvatarFile(emptyFile);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('corrompido ou vazio'));
  });

  it('deve aceitar formatos suportados (JPG, PNG, WebP) com tamanho inferior a 5MB', () => {
    const validJpg = { type: 'image/jpeg', size: 1.5 * 1024 * 1024 };
    const validPng = { type: 'image/png', size: 500 * 1024 };
    const validWebp = { type: 'image/webp', size: 300 * 1024 };

    assert.strictEqual(AvatarService.validateAvatarFile(validJpg).valid, true);
    assert.strictEqual(AvatarService.validateAvatarFile(validPng).valid, true);
    assert.strictEqual(AvatarService.validateAvatarFile(validWebp).valid, true);
  });
});

describe('Story 2: Fluxo de Upload e Persistência de Avatar (CAP-2)', () => {
  it('deve rejeitar upload sem userId fornecido', async () => {
    const res = await AvatarService.uploadUserAvatar('', { type: 'image/jpeg', size: 1024 });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Identificador do usuário é obrigatório.');
  });

  it('deve realizar upload para o bucket avatars e atualizar avatar_url em users', async () => {
    let uploadedBucket = '';
    let uploadedPath = '';
    let updatedUsersPayload = null;

    const mockClient = {
      storage: {
        from(bucket) {
          uploadedBucket = bucket;
          return {
            async upload(path, file, options) {
              uploadedPath = path;
              return { error: null };
            },
            getPublicUrl(path) {
              return {
                data: {
                  publicUrl: `https://supabase.delivrery.app/storage/v1/object/public/${bucket}/${path}`
                }
              };
            }
          };
        }
      },
      from(table) {
        if (table === 'users') {
          return {
            update(data) {
              updatedUsersPayload = data;
              return {
                eq(col, val) {
                  return Promise.resolve({ error: null });
                }
              };
            }
          };
        }
        throw new Error(`Tabela inesperada: ${table}`);
      }
    };

    const mockFile = {
      type: 'image/png',
      size: 200 * 1024
    };

    const result = await AvatarService.uploadUserAvatar('user-uuid-123', mockFile, mockClient);

    assert.strictEqual(result.success, true);
    assert.ok(result.avatarUrl.includes('user-uuid-123/avatar-'));
    assert.ok(result.avatarUrl.endsWith('.png'));
    assert.strictEqual(uploadedBucket, 'avatars');
    assert.ok(uploadedPath.startsWith('user-uuid-123/avatar-'));
    assert.strictEqual(updatedUsersPayload.avatar_url, result.avatarUrl);
  });

  it('deve permitir remoção de avatar atualizando avatar_url para null', async () => {
    let updatedPayload = null;

    const mockClient = {
      from(table) {
        return {
          update(data) {
            updatedPayload = data;
            return {
              eq(col, val) {
                return Promise.resolve({ error: null });
              }
            };
          }
        };
      }
    };

    const res = await AvatarService.removeUserAvatar('user-uuid-123', mockClient);
    assert.strictEqual(res.success, true);
    assert.strictEqual(updatedPayload.avatar_url, null);
  });
});

describe('Story 2: Integridade dos Componentes de UI de Avatar (PWA)', () => {
  it('Avatar.tsx deve existir e conter tratamento de fallback e badge', () => {
    const avatarPath = path.join(rootDir, 'apps', 'pwa', 'src', 'components', 'ui', 'Avatar.tsx');
    assert.ok(fs.existsSync(avatarPath), 'Avatar.tsx deve existir');
    const content = fs.readFileSync(avatarPath, 'utf8');
    assert.ok(content.includes('getInitials'), 'Deve conter extração de iniciais');
    assert.ok(content.includes('onError'), 'Deve tratar erro de carregamento de imagem');
    assert.ok(content.includes('delivrery-avatar'), 'Deve conter classe identificadora');
  });

  it('AvatarUpload.tsx deve existir e conter input invisível e acionador de câmera', () => {
    const uploadPath = path.join(rootDir, 'apps', 'pwa', 'src', 'components', 'profile', 'AvatarUpload.tsx');
    assert.ok(fs.existsSync(uploadPath), 'AvatarUpload.tsx deve existir');
    const content = fs.readFileSync(uploadPath, 'utf8');
    assert.ok(content.includes('accept="image/jpeg,image/png,image/webp"'), 'Deve restringir tipos de arquivo no input');
    assert.ok(content.includes('btn-avatar-upload-trigger'), 'Deve conter botão de disparo de upload');
    assert.ok(content.includes('URL.createObjectURL'), 'Deve gerar preview em tempo real');
  });

  it('ProfileEditModal.tsx e App.tsx devem integrar Avatar e AvatarUpload', () => {
    const modalPath = path.join(rootDir, 'apps', 'pwa', 'src', 'components', 'profile', 'ProfileEditModal.tsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');
    assert.ok(modalContent.includes('AvatarUpload'), 'ProfileEditModal deve renderizar AvatarUpload');

    const appPath = path.join(rootDir, 'apps', 'pwa', 'src', 'App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.ok(appContent.includes('<Avatar'), 'App.tsx deve renderizar o componente Avatar');
    assert.ok(appContent.includes('profileData.user.avatarUrl'), 'App.tsx deve repassar avatarUrl ao Avatar');
  });
});
