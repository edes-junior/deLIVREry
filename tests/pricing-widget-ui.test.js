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

  it('deve garantir que os botões de seleção de modal no RegionalPricingWidget tenham type="button" para não submeter formulários', () => {
    const content = fs.readFileSync(widgetPath, 'utf8');
    // Verifica que o bloco de renderização dos modais possui type="button"
    assert.ok(content.includes('type="button"\n              variant="pill"') || content.includes('type="button"'), 'Deve conter type="button" nos botões');
    // Verifica especificamente dentro do map dos modais
    const modalBlockMatch = content.match(/\{modals\.map\([\s\S]*?<\/Button>/);
    assert.ok(modalBlockMatch, 'Deve encontrar bloco de renderização dos modais');
    assert.ok(modalBlockMatch[0].includes('type="button"'), 'Botão do modal precisa ter type="button" explícito');
  });

  it('deve garantir que o componente Button tenha type="button" por padrão defensivo', () => {
    const buttonPath = path.join(process.cwd(), 'apps/pwa/src/components/ui/Button.tsx');
    const buttonContent = fs.readFileSync(buttonPath, 'utf8');

    assert.ok(buttonContent.includes("type = 'button'"), 'ButtonProps deve ter type padrão "button"');
    assert.ok(buttonContent.includes('type={type}'), 'Elemento button nativo deve receber type={type}');
  });

  it('deve garantir que no JobPublishModal o formulário só seja submetido pelo botão "Confirmar e Publicar"', () => {
    const content = fs.readFileSync(publishModalPath, 'utf8');

    // Apenas um elemento deve ter type="submit" dentro do formulário
    const submitMatches = content.match(/type="submit"/g);
    assert.ok(submitMatches && submitMatches.length === 1, 'Deve haver exatamente 1 botão com type="submit" no modal');

    // Verifica que o botão submit é o Confirmar e Publicar
    assert.ok(content.includes("isSubmitting ? 'Publicando...' : 'Confirmar e Publicar'"), 'Botão submit deve ser o Confirmar e Publicar');
  });
});

