import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Prevenção de Falso Reload: Validação de Integridade no App.tsx', () => {
  const appTsxPath = path.join(rootDir, 'apps', 'pwa', 'src', 'App.tsx');
  const appContent = fs.readFileSync(appTsxPath, 'utf-8');

  // Garante que a Splash Screen só desmonte/bloqueie a tela se profileData ainda NÃO existir
  assert.match(
    appContent,
    /if\s*\(!profileData\s*&&\s*\(isAuthLoading\s*\|\|\s*isProfileLoading\)\)/,
    'App.tsx deve verificar !profileData antes de exibir a Splash Screen para evitar desmontar a árvore em segundo plano'
  );

  // Garante que o useEffect de carregamento de perfil não dependa do objeto user instanciado, e sim do userId
  assert.match(
    appContent,
    /loadUserProfileAndQuorum\(\);\s*\}\,\s*\[userId\]\);/,
    'App.tsx deve depender de [userId] e não de [user] para evitar re-execução quando Supabase renova o token no foco'
  );

  // Garante que só ativa isProfileLoading caso profileData seja nulo
  assert.match(
    appContent,
    /if\s*\(!profileData\)\s*\{\s*setIsProfileLoading\(true\);?\s*\}/,
    'App.tsx não deve ativar isProfileLoading se profileData já estiver em memória'
  );
});

test('Prevenção de Falso Reload: Estabilidade de Sessão no useAuth', () => {
  const useAuthPath = path.join(rootDir, 'apps', 'pwa', 'src', 'auth', 'use-auth.ts');
  const useAuthContent = fs.readFileSync(useAuthPath, 'utf-8');

  // Garante o uso de refs para comparar estabilidade de sessão e usuário
  assert.match(useAuthContent, /lastUserIdRef/, 'useAuth deve rastrear lastUserIdRef');
  assert.match(useAuthContent, /lastTokenRef/, 'useAuth deve rastrear lastTokenRef');

  // Garante exportação de isLoading
  assert.match(useAuthContent, /isLoading:\s*loading/, 'useAuth deve exportar isLoading compatível com loading');

  // Garante que não recria estado se o token e usuário forem idênticos
  assert.match(
    useAuthContent,
    /if\s*\(isSameUser\s*&&\s*isSameToken\)\s*\{\s*setLoading\(false\);\s*return;\s*\}/,
    'useAuth deve ignorar eventos redundantes quando usuário e token são os mesmos'
  );
});

test('Persistência de Rascunho (Resiliência de Formulários): JobPublishModal', () => {
  const jobModalPath = path.join(rootDir, 'apps', 'pwa', 'src', 'components', 'jobs', 'JobPublishModal.tsx');
  const jobModalContent = fs.readFileSync(jobModalPath, 'utf-8');

  // Garante que usa sessionStorage para salvar e recuperar rascunho de turno
  assert.match(
    jobModalContent,
    /sessionStorage\.getItem\(`delivrery_job_draft_\$\{storeUserId\}`\)/,
    'JobPublishModal deve recuperar rascunho do sessionStorage ao abrir'
  );

  assert.match(
    jobModalContent,
    /sessionStorage\.setItem\(`delivrery_job_draft_\$\{storeUserId\}`/,
    'JobPublishModal deve salvar rascunho no sessionStorage continuamente'
  );

  assert.match(
    jobModalContent,
    /sessionStorage\.removeItem\(`delivrery_job_draft_\$\{storeUserId\}`\)/,
    'JobPublishModal deve limpar o rascunho após publicação bem-sucedida'
  );
});

test('Persistência de Rascunho (Resiliência de Formulários): ProfileCompletionForm', () => {
  const profileFormPath = path.join(rootDir, 'apps', 'pwa', 'src', 'components', 'profile', 'ProfileCompletionForm.tsx');
  const profileFormContent = fs.readFileSync(profileFormPath, 'utf-8');

  // Garante que usa sessionStorage para salvar e recuperar rascunho de perfil
  assert.match(
    profileFormContent,
    /sessionStorage\.getItem\(`delivrery_profile_draft_\$\{userId\}`\)/,
    'ProfileCompletionForm deve recuperar rascunho do sessionStorage'
  );

  assert.match(
    profileFormContent,
    /sessionStorage\.setItem\(`delivrery_profile_draft_\$\{userId\}`/,
    'ProfileCompletionForm deve salvar rascunho no sessionStorage'
  );

  assert.match(
    profileFormContent,
    /sessionStorage\.removeItem\(`delivrery_profile_draft_\$\{userId\}`\)/,
    'ProfileCompletionForm deve limpar o rascunho após ativação do perfil com sucesso'
  );
});
