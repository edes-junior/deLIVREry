/**
 * @file build.js
 * @description Script de build e distribuição de CDN para o Web Component <delivrery-button />.
 * Produz bundles para distribuição oficial via CDN (https://cdn.delivrery.app.br/embed/):
 * - dist/delivrery-button.js (Bundle canônico de desenvolvimento / ESM)
 * - dist/delivrery-button.min.js (Bundle de produção minificado < 50ms)
 * - dist/v1/delivrery-button.js (Bundle com versionamento de tag v1)
 * - dist/integrity.json (Hashes SHA-256 / Subresource Integrity SRI)
 * - dist/index.html (Página de demonstração estática para o CDN)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const srcFile = path.resolve(packageRoot, 'src', 'delivrery-button.js');
const distDir = path.resolve(packageRoot, 'dist');
const distV1Dir = path.resolve(distDir, 'v1');

// Lê metadados do package.json
const pkgJson = JSON.parse(fs.readFileSync(path.resolve(packageRoot, 'package.json'), 'utf8'));
const version = pkgJson.version || '0.1.0';

console.log(`[Build] Iniciando build do @delivrery/embed-widget v${version}...`);

if (!fs.existsSync(srcFile)) {
  console.error(`[Build] Erro: Arquivo fonte não encontrado em ${srcFile}`);
  process.exit(1);
}

const sourceCode = fs.readFileSync(srcFile, 'utf8');

// Cria diretórios de saída
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}
if (!fs.existsSync(distV1Dir)) {
  fs.mkdirSync(distV1Dir, { recursive: true });
}

// Banner oficial de distribuição
const banner = `/**
 * deLIVREry - Embeddable Web Component Nativo <delivrery-button />
 * Version: ${version}
 * Distribution: Official CDN (https://cdn.delivrery.app.br/embed/)
 * License: MIT
 * Documentation: https://delivrery.app/developers
 */
`;

// Função simples de minificação Vanilla sem quebrar regex ou strings
function simpleMinify(code) {
  return code
    // Remove comentários de bloco multiline
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove linhas de comentários de linha única (que comecem no início da linha)
    .replace(/^\s*\/\/.*$/gm, '')
    // Colapsa quebras de linha múltiplas
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

const unminifiedOutput = `${banner}\n${sourceCode}`;
const minifiedOutput = `${banner}\n${simpleMinify(sourceCode)}`;

// 1. Grava dist/delivrery-button.js
const unminifiedPath = path.resolve(distDir, 'delivrery-button.js');
fs.writeFileSync(unminifiedPath, unminifiedOutput, 'utf8');

// 2. Grava dist/delivrery-button.min.js
const minifiedPath = path.resolve(distDir, 'delivrery-button.min.js');
fs.writeFileSync(minifiedPath, minifiedOutput, 'utf8');

// 3. Grava dist/v1/delivrery-button.js (para URL versionada)
const v1Path = path.resolve(distV1Dir, 'delivrery-button.js');
fs.writeFileSync(v1Path, unminifiedOutput, 'utf8');

// 4. Calcula hashes criptográficos (SHA-256 e SRI)
function calculateSri(content) {
  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('base64');
  return `sha256-${hash}`;
}

function calculateHex(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

const integrityManifest = {
  packageName: pkgJson.name,
  version: version,
  buildTimestamp: new Date().toISOString(),
  cdnBaseUrl: 'https://cdn.delivrery.app.br/embed',
  files: {
    'delivrery-button.js': {
      sizeBytes: Buffer.byteLength(unminifiedOutput, 'utf8'),
      sha256: calculateHex(unminifiedOutput),
      sri: calculateSri(unminifiedOutput)
    },
    'delivrery-button.min.js': {
      sizeBytes: Buffer.byteLength(minifiedOutput, 'utf8'),
      sha256: calculateHex(minifiedOutput),
      sri: calculateSri(minifiedOutput)
    },
    'v1/delivrery-button.js': {
      sizeBytes: Buffer.byteLength(unminifiedOutput, 'utf8'),
      sha256: calculateHex(unminifiedOutput),
      sri: calculateSri(unminifiedOutput)
    }
  },
  integrationSnippet: {
    esm: `<script type="module" src="https://cdn.delivrery.app.br/embed/v1/delivrery-button.js"></script>`,
    sri: `<script type="module" src="https://cdn.delivrery.app.br/embed/v1/delivrery-button.js" integrity="${calculateSri(unminifiedOutput)}" crossorigin="anonymous"></script>`
  }
};

const integrityPath = path.resolve(distDir, 'integrity.json');
fs.writeFileSync(integrityPath, JSON.stringify(integrityManifest, null, 2), 'utf8');

// 5. Gera página de demonstração estática para o CDN
const demoHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>deLIVREry Web Component - Demonstração CDN</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    h1 { font-size: 20px; color: #ff6b00; margin-top: 0; }
    p { font-size: 14px; color: #8b949e; line-height: 1.5; }
    .widget-container { margin: 24px 0; display: flex; justify-content: center; }
    code { background: #21262d; padding: 2px 6px; border-radius: 4px; font-size: 12px; color: #79c0ff; }
  </style>
  <script type="module" src="./v1/delivrery-button.js"></script>
</head>
<body>
  <div class="card">
    <h1>deLIVREry Widget CDN</h1>
    <p>Demonstração oficial do componente nativo <code>&lt;delivrery-button /&gt;</code> servido pelo CDN.</p>
    <div class="widget-container">
      <delivrery-button
        client-id="cdn_demo_partner"
        city-id="sao_paulo"
        neighborhood-id="pinheiros"
        store-name="Pizzaria Bella CDN"
        label="Pedir Entrega Livre"
        theme="delivrery-orange"
        mode="modal"
      ></delivrery-button>
    </div>
    <p>Snippet de integração:</p>
    <code>&lt;script type="module" src="https://cdn.delivrery.app.br/embed/v1/delivrery-button.js"&gt;&lt;/script&gt;</code>
  </div>
</body>
</html>
`;

const demoPath = path.resolve(distDir, 'index.html');
fs.writeFileSync(demoPath, demoHtml, 'utf8');

console.log(`[Build] ✓ Sucesso!`);
console.log(`[Build]   - dist/delivrery-button.js (${(Buffer.byteLength(unminifiedOutput, 'utf8') / 1024).toFixed(1)} KB)`);
console.log(`[Build]   - dist/delivrery-button.min.js (${(Buffer.byteLength(minifiedOutput, 'utf8') / 1024).toFixed(1)} KB)`);
console.log(`[Build]   - dist/v1/delivrery-button.js (Versionado v1)`);
console.log(`[Build]   - dist/integrity.json (SRI: ${calculateSri(unminifiedOutput)})`);
console.log(`[Build]   - dist/index.html (Página de Teste CDN)`);
