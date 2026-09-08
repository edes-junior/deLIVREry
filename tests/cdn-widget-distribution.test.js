/**
 * @file cdn-widget-distribution.test.js
 * @description Suíte de testes automatizados para os Action Items Operacionais do Epic 5:
 * 1. epic-5-retro-item-1-deploy-edge-gateway (CI/CD Pipeline, variáveis de produção e segredos)
 * 2. epic-5-retro-item-2-cdn-widget-distribution (Build de CDN, bundle do Web Component, SRI e integridade)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const embedWidgetDir = path.resolve(rootDir, 'packages', 'embed-widget');
const distDir = path.resolve(embedWidgetDir, 'dist');

describe('Action Item 1: Pipeline CI/CD e Variáveis de Produção (deploy-edge-gateway)', () => {
  const workflowPath = path.resolve(rootDir, '.github', 'workflows', 'ci-cd.yml');
  const envExamplePath = path.resolve(rootDir, '.env.example');

  it('deve conter o arquivo de workflow CI/CD oficial do GitHub Actions', () => {
    assert.ok(fs.existsSync(workflowPath), 'Workflow .github/workflows/ci-cd.yml deve existir');
    const workflowContent = fs.readFileSync(workflowPath, 'utf8');

    // Jobs mandatórios
    assert.ok(workflowContent.includes('quality-gate:'), 'Deve conter job de quality-gate');
    assert.ok(workflowContent.includes('build-and-deploy-cdn-widget:'), 'Deve conter job de CDN widget');
    assert.ok(workflowContent.includes('deploy-edge-gateway:'), 'Deve conter job de Edge Gateway');

    // Segredos de produção mapeados
    assert.ok(workflowContent.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Deve referenciar SUPABASE_SERVICE_ROLE_KEY');
    assert.ok(workflowContent.includes('DELIVRERY_API_KEY_SALT'), 'Deve referenciar DELIVRERY_API_KEY_SALT');
    assert.ok(workflowContent.includes('SUPABASE_ACCESS_TOKEN'), 'Deve referenciar SUPABASE_ACCESS_TOKEN');
    assert.ok(workflowContent.includes('SUPABASE_PROJECT_ID'), 'Deve referenciar SUPABASE_PROJECT_ID');
  });

  it('deve conter as variáveis do Epic 5 documentadas no .env.example', () => {
    assert.ok(fs.existsSync(envExamplePath), 'Arquivo .env.example deve existir');
    const envContent = fs.readFileSync(envExamplePath, 'utf8');

    assert.ok(envContent.includes('SUPABASE_SERVICE_ROLE_KEY='), 'Deve conter SUPABASE_SERVICE_ROLE_KEY');
    assert.ok(envContent.includes('DELIVRERY_API_KEY_SALT='), 'Deve conter DELIVRERY_API_KEY_SALT');
    assert.ok(envContent.includes('SUPABASE_PROJECT_ID='), 'Deve conter SUPABASE_PROJECT_ID');
    assert.ok(envContent.includes('PUBLIC_CDN_WIDGET_URL='), 'Deve conter PUBLIC_CDN_WIDGET_URL');
  });
});

describe('Action Item 2: Build e Distribuição CDN do Web Component (cdn-widget-distribution)', () => {
  before(() => {
    // Executa o build do widget antes de verificar os artefatos
    execSync('npm run build:widget', { cwd: rootDir, stdio: 'pipe' });
  });

  it('deve gerar todos os arquivos de distribuição do CDN no diretório dist/', () => {
    const unminified = path.resolve(distDir, 'delivrery-button.js');
    const minified = path.resolve(distDir, 'delivrery-button.min.js');
    const v1Versioned = path.resolve(distDir, 'v1', 'delivrery-button.js');
    const integrity = path.resolve(distDir, 'integrity.json');
    const demoHtml = path.resolve(distDir, 'index.html');

    assert.ok(fs.existsSync(unminified), 'dist/delivrery-button.js deve existir');
    assert.ok(fs.existsSync(minified), 'dist/delivrery-button.min.js deve existir');
    assert.ok(fs.existsSync(v1Versioned), 'dist/v1/delivrery-button.js deve existir');
    assert.ok(fs.existsSync(integrity), 'dist/integrity.json deve existir');
    assert.ok(fs.existsSync(demoHtml), 'dist/index.html deve existir');
  });

  it('deve validar que a versão minificada reduz o tamanho preservando o código executável', () => {
    const unminifiedContent = fs.readFileSync(path.resolve(distDir, 'delivrery-button.js'), 'utf8');
    const minifiedContent = fs.readFileSync(path.resolve(distDir, 'delivrery-button.min.js'), 'utf8');

    assert.ok(minifiedContent.length <= unminifiedContent.length, 'Versão minificada deve ser menor ou igual');
    assert.ok(minifiedContent.includes('class DelivreryButton extends HTMLElement'), 'Deve conter definição da classe');
    assert.ok(minifiedContent.includes("customElements.define('delivrery-button'"), 'Deve registrar custom element');
  });

  it('deve validar a integridade dos hashes SRI e SHA-256 no integrity.json', () => {
    const integrityContent = JSON.parse(fs.readFileSync(path.resolve(distDir, 'integrity.json'), 'utf8'));

    assert.strictEqual(integrityContent.packageName, '@delivrery/embed-widget');
    assert.ok(integrityContent.files['delivrery-button.js'], 'Deve conter entrada para delivrery-button.js');
    assert.ok(integrityContent.files['delivrery-button.min.js'], 'Deve conter entrada para min.js');
    assert.ok(integrityContent.files['v1/delivrery-button.js'], 'Deve conter entrada para v1');

    // Valida cálculo do hash SHA-256 real do arquivo gerado
    const actualUnminified = fs.readFileSync(path.resolve(distDir, 'delivrery-button.js'), 'utf8');
    const actualHash = crypto.createHash('sha256').update(actualUnminified, 'utf8').digest('hex');
    assert.strictEqual(integrityContent.files['delivrery-button.js'].sha256, actualHash);

    // Valida formato do hash SRI (sha256-...)
    assert.ok(integrityContent.files['delivrery-button.js'].sri.startsWith('sha256-'));
  });

  it('deve conter snippet de integração pronto para uso externo com a URL oficial de CDN', () => {
    const integrityContent = JSON.parse(fs.readFileSync(path.resolve(distDir, 'integrity.json'), 'utf8'));

    assert.ok(integrityContent.integrationSnippet.esm.includes('https://cdn.delivrery.app.br/embed/v1/delivrery-button.js'));
    assert.ok(integrityContent.integrationSnippet.sri.includes('integrity="sha256-'));
  });
});
