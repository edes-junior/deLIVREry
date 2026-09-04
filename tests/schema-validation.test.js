import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Monorepo workspace and directories structure', (t) => {
  const expectedDirs = [
    'apps/pwa',
    'apps/landing-pages',
    'apps/developer-portal',
    'packages/embed-widget',
    'packages/api-client-sdk',
    'supabase/migrations',
  ];

  for (const dir of expectedDirs) {
    const fullPath = path.join(rootDir, dir);
    assert.equal(fs.existsSync(fullPath), true, `Directory must exist: ${dir}`);
  }

  // Verify root package.json workspaces
  const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  assert.ok(Array.isArray(rootPkg.workspaces), 'workspaces array must be defined in root package.json');
  assert.ok(rootPkg.workspaces.includes('apps/*'), 'apps/* must be in workspaces');
  assert.ok(rootPkg.workspaces.includes('packages/*'), 'packages/* must be in workspaces');
});

test('Package entrypoint stubs existence', (t) => {
  const widgetEntry = path.join(rootDir, 'packages/embed-widget/src/delivrery-button.js');
  const sdkEntry = path.join(rootDir, 'packages/api-client-sdk/src/index.js');
  assert.equal(fs.existsSync(widgetEntry), true, 'delivrery-button.js entrypoint must exist');
  assert.equal(fs.existsSync(sdkEntry), true, 'api-client-sdk index.js entrypoint must exist');
});

test('Supabase config.toml validation', (t) => {
  const configPath = path.join(rootDir, 'supabase/config.toml');
  assert.equal(fs.existsSync(configPath), true, 'supabase/config.toml must exist');
  const configContent = fs.readFileSync(configPath, 'utf-8');
  assert.match(configContent, /project_id\s*=\s*"delivrery"/, 'config must specify project_id delivrery');
  assert.match(configContent, /\[api\]/, 'config must define [api] section');
  assert.match(configContent, /\[db\]/, 'config must define [db] section');
  assert.match(configContent, /\[auth\]/, 'config must define [auth] section');
});

test('Migration DDL file existence and basic integrity', (t) => {
  const migrationPath = path.join(
    rootDir,
    'supabase/migrations/20260904143000_init_identity_geography_schema.sql'
  );
  assert.equal(fs.existsSync(migrationPath), true, 'Migration SQL file must exist');

  const sql = fs.readFileSync(migrationPath, 'utf-8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.users/, 'Must create users table');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.courier_profiles/, 'Must create courier_profiles table');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.store_profiles/, 'Must create store_profiles table');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.region_unlocks/, 'Must create region_unlocks table');
  assert.match(sql, /full_name\s+VARCHAR\(150\)/, 'users table must have full_name column');
});

test('Matrix Scenario 1: Uniqueness and format constraints (CPF, Email, Referral Code)', (t) => {
  const sql = fs.readFileSync(
    path.join(rootDir, 'supabase/migrations/20260904143000_init_identity_geography_schema.sql'),
    'utf-8'
  );
  assert.match(sql, /CONSTRAINT\s+users_cpf_key\s+UNIQUE\s*\(\s*cpf\s*\)/, 'Must enforce UNIQUE constraint on users(cpf)');
  assert.match(sql, /CONSTRAINT\s+check_cpf_format\s+CHECK/, 'Must validate CPF format with check constraint');
  assert.match(sql, /CONSTRAINT\s+users_email_key\s+UNIQUE\s*\(\s*email\s*\)/, 'Must enforce UNIQUE constraint on users(email)');
  assert.match(sql, /CONSTRAINT\s+courier_profiles_referral_code_key\s+UNIQUE\s*\(\s*referral_code\s*\)/, 'Must enforce UNIQUE referral_code');
});

test('Matrix Scenario 2: CHECK constraints (transport_modal and state_id validation)', (t) => {
  const sql = fs.readFileSync(
    path.join(rootDir, 'supabase/migrations/20260904143000_init_identity_geography_schema.sql'),
    'utf-8'
  );
  assert.match(
    sql,
    /CONSTRAINT\s+check_transport_modal\s+CHECK\s*\(\s*transport_modal\s+IN\s*\('motorcycle',\s*'bicycle',\s*'ebike_scooter'\)\s*\)/,
    'Must restrict transport_modal to motorcycle, bicycle, ebike_scooter'
  );
  assert.match(
    sql,
    /CONSTRAINT\s+check_user_type\s+CHECK\s*\(\s*user_type\s+IN\s*\('courier',\s*'store'\)\s*\)/,
    'Must restrict user_type to courier, store'
  );
  assert.match(
    sql,
    /CONSTRAINT\s+check_store_state_id_format\s+CHECK\s*\(\s*length\(state_id\)\s*=\s*2\s+AND\s+state_id\s*=\s*UPPER\(state_id\)\s*\)/,
    'Must enforce 2-letter uppercase UF on store_profiles'
  );
  assert.match(
    sql,
    /CONSTRAINT\s+check_region_state_id_format\s+CHECK\s*\(\s*length\(state_id\)\s*=\s*2\s+AND\s+state_id\s*=\s*UPPER\(state_id\)\s*\)/,
    'Must enforce 2-letter uppercase UF on region_unlocks'
  );
});

test('Matrix Scenario 3: Row Level Security (RLS) and cross-user isolation', (t) => {
  const sql = fs.readFileSync(
    path.join(rootDir, 'supabase/migrations/20260904143000_init_identity_geography_schema.sql'),
    'utf-8'
  );
  assert.match(sql, /ALTER\s+TABLE\s+public\.users\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/, 'users must have RLS enabled');
  assert.match(sql, /ALTER\s+TABLE\s+public\.courier_profiles\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/, 'courier_profiles must have RLS enabled');
  assert.match(sql, /ALTER\s+TABLE\s+public\.store_profiles\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/, 'store_profiles must have RLS enabled');
  assert.match(sql, /ALTER\s+TABLE\s+public\.region_unlocks\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/, 'region_unlocks must have RLS enabled');

  assert.match(sql, /CREATE\s+POLICY\s+"Users can read own profile"[\s\S]*?USING\s*\(\s*auth\.uid\(\)\s*=\s*id\s*\)/, 'Users can only read own profile');
  assert.match(sql, /CREATE\s+POLICY\s+"Couriers can read own profile"[\s\S]*?USING\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/, 'Couriers can only read own profile');
  assert.match(sql, /CREATE\s+POLICY\s+"Stores can read own profile"[\s\S]*?USING\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/, 'Stores can only read own profile');
});

test('Matrix Scenario 4: Regional quorum, cascade deletion and triggers', (t) => {
  const sql = fs.readFileSync(
    path.join(rootDir, 'supabase/migrations/20260904143000_init_identity_geography_schema.sql'),
    'utf-8'
  );
  assert.match(sql, /CONSTRAINT\s+uq_region_geography\s+UNIQUE\s*\(\s*state_id,\s*city_id,\s*neighborhood_id\s*\)/, 'Composite unique key on geography');
  assert.match(sql, /REFERENCES\s+public\.users\(id\)\s+ON\s+DELETE\s+CASCADE/, 'Profile tables must cascade on delete');
  assert.match(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.handle_updated_at\(\)/, 'Must define updated_at trigger function');
  assert.match(sql, /CREATE\s+POLICY\s+"Public can view region unlocks quorum"[\s\S]*?USING\s*\(\s*true\s*\)/, 'Quorum status must be readable publicly');
});
