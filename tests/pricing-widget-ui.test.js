import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Story 3.4: Painel Visual do Balizador Regional e Usabilidade (NFR-9)', () => {
  const widgetPath = path.join(
    process.cwd(),
    'apps/pwa/src/components/pricing/RegionalPricingWidget.tsx'
  );
  const publishModalPath = path.join(
    process.cwd(),
    'apps/pwa/src/components/jobs/JobPublishModal.tsx'
  );
  const appPath = path.join(
    process.cwd(),
    'apps/pwa/src/App.tsx'
  );

  it('deve verificar a existência e integridade do arquivo RegionalPricingWidget.tsx', () => {
    assert.ok(fs.existsSync(widgetPath), 'Componente RegionalPricingWidget deve existir');
    const content = fs.readFileSync(widgetPath, 'utf8');

    assert.ok(content.includes('export const RegionalPricingWidget'), 'Deve exportar o componente');
    assert.ok(content.includes('RegionalPricingWidgetProps'), 'Deve definir props tipadas');
  });

  it('deve conter alvos de toque >= 48px nos seletores de modal e botões de ação (NFR-9)', () => {
    const content = fs.readFileSync(widgetPath, 'utf8');

    // Botões de modal e botão de autopreenchimento devem conter minHeight >= 48px
    assert.ok(content.includes("minHeight: '48px'"), 'Deve conter minHeight 48px para alvos touch');
  });

  it('deve suportar os 4 seletores de modal (Todos, Moto, Bike, E-Bike)', () => {
    const content = fs.readFileSync(widgetPath, 'utf8');

    assert.ok(content.includes("id: 'all'"), 'Deve conter opção all');
    assert.ok(content.includes("id: 'motorcycle'"), 'Deve conter opção motorcycle');
    assert.ok(content.includes("id: 'bicycle'"), 'Deve conter opção bicycle');
    assert.ok(content.includes("id: 'ebike_scooter'"), 'Deve conter opção ebike_scooter');
  });

  it('deve conter badges para bairros consolidados e em consolidação (Matriz Linhas 1 e 2)', () => {
    const content = fs.readFileSync(widgetPath, 'utf8');

    assert.ok(content.includes('Consolidado no Bairro'), 'Deve indicar consolidação no bairro');
    assert.ok(content.includes('Em Consolidação (Ref. Cidade)'), 'Deve indicar consolidação municipal');
  });

  it('deve conter indicador de ofertas anômalas expurgadas pelo filtro 1.5xIQR', () => {
    const content = fs.readFileSync(widgetPath, 'utf8');

    assert.ok(content.includes('proposta(s) anômala(s) expurgada(s) pelo filtro 1.5xIQR'), 'Deve exibir contador de outliers expurgados');
  });

  it('deve conter botão [Sugerir Preço de Mercado] com haptic feedback (Matriz Linha 3)', () => {
    const content = fs.readFileSync(widgetPath, 'utf8');

    assert.ok(content.includes('Sugerir Preço de Mercado'), 'Deve ter o botão de sugestão de mercado');
    assert.ok(content.includes('navigator.vibrate'), 'Deve acionar vibração tátil');
    assert.ok(content.includes('onApplyRates'), 'Deve disparar callback com as taxas sugeridas');
  });

  it('deve validar a integração do RegionalPricingWidget no JobPublishModal.tsx', () => {
    const content = fs.readFileSync(publishModalPath, 'utf8');

    assert.ok(content.includes("import { RegionalPricingWidget } from '../pricing/RegionalPricingWidget.tsx'"), 'Deve importar o widget');
    assert.ok(content.includes('<RegionalPricingWidget'), 'Deve instanciar o componente no JSX');
    assert.ok(content.includes('setDailyRate(suggestedDaily.toFixed(2))'), 'Deve preencher diária ao sugerir preço');
    assert.ok(content.includes('setDeliveryFee(suggestedFee.toFixed(2))'), 'Deve preencher taxa ao sugerir preço');
  });

  it('deve validar a integração do RegionalPricingWidget no dashboard principal do App.tsx', () => {
    const content = fs.readFileSync(appPath, 'utf8');

    assert.ok(content.includes("import { RegionalPricingWidget } from './components/pricing/RegionalPricingWidget.tsx'"), 'Deve importar o widget no App');
    assert.ok(content.includes('<RegionalPricingWidget'), 'Deve instanciar o widget no App.tsx');
    assert.ok(content.includes('Balizador de Preços da sua Região'), 'Deve exibir título explicativo');
  });
});
