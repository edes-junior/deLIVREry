import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Story 4.2: Componente Bottom Sheet de Doação PIX e Usabilidade (NFR-9, FR-10, FR-11)', () => {
  const componentPath = path.resolve(
    process.cwd(),
    'apps/pwa/src/components/donations/DonationBottomSheet.tsx'
  );

  it('deve verificar a existência e integridade do arquivo DonationBottomSheet.tsx', () => {
    assert.ok(fs.existsSync(componentPath), 'Componente DonationBottomSheet.tsx deve existir');
  });

  it('deve conter alvos de toque >= 48px nos botões e chips de seleção (NFR-9)', () => {
    const code = fs.readFileSync(componentPath, 'utf8');

    // Chips de valor sugerido e botão customizado
    assert.ok(
      code.includes("minHeight: '48px'") || code.includes('min-h-[48px]'),
      'Chips de valor devem ter altura mínima de 48px'
    );

    // Botão primário de cópia PIX
    assert.ok(
      code.includes("minHeight: '52px'") || code.includes("minHeight: '48px'"),
      'Botão primário de cópia deve ter altura mínima >= 48px'
    );

    // Botão de saída imediata (Agora Não)
    assert.ok(
      code.includes("minHeight: '48px'"),
      'Botão Agora Não deve ter alvo de toque >= 48px'
    );
  });

  it('deve implementar suporte contextual para os 5 Delight Moments mais apoio manual (FR-10)', () => {
    const code = fs.readFileSync(componentPath, 'utf8');

    // 1. shift_completed
    assert.ok(code.includes('shift_completed:'), 'Deve tratar momento shift_completed');
    assert.ok(code.includes('Turno Concluído com Sucesso!'), 'Deve conter mensagem do turno concluído');

    // 2. level_up
    assert.ok(code.includes('level_up:'), 'Deve tratar momento level_up');
    assert.ok(code.includes('Subiu de Nível!'), 'Deve conter mensagem de level up');

    // 3. emergency_matched
    assert.ok(code.includes('emergency_matched:'), 'Deve tratar momento emergency_matched');
    assert.ok(code.includes('Vaga de Emergência Atendida a Tempo!'), 'Deve conter mensagem de emergência atendida');

    // 4. rating_5_stars
    assert.ok(code.includes('rating_5_stars:'), 'Deve tratar momento rating_5_stars');
    assert.ok(code.includes('Avaliação 5 Estrelas Registrada!'), 'Deve conter mensagem de avaliação 5 estrelas');

    // 5. api_1000_requests
    assert.ok(code.includes('api_1000_requests:'), 'Deve tratar momento api_1000_requests');
    assert.ok(code.includes('Marca de 1.000 Requisições Atingida!'), 'Deve conter mensagem de 1000 requisições');

    // Apoio voluntário manual
    assert.ok(code.includes('manual_donation:'), 'Deve tratar momento manual_donation');
    assert.ok(code.includes('Apoie a Sustentabilidade do deLIVREry!'), 'Deve conter mensagem de apoio comunitário');
  });

  it('deve conter chips de valores rápidos (R$ 2, R$ 5, R$ 10) e opção de outro valor', () => {
    const code = fs.readFileSync(componentPath, 'utf8');

    assert.ok(code.includes('SUGGESTED_AMOUNTS = [2.0, 5.0, 10.0]'), 'Deve ter chips rápidos de R$ 2, R$ 5 e R$ 10');
    assert.ok(code.includes('data-testid={`chip-amount-${amount}`}'), 'Deve possuir data-testid para chips de valor');
    assert.ok(code.includes('data-testid="chip-amount-custom"'), 'Deve possuir chip de outro valor');
    assert.ok(code.includes('data-testid="input-custom-amount"'), 'Deve permitir input numérico para outro valor');
  });

  it('deve emitir feedback tátil (Haptic Feedback) e registrar intenção em donations_log (FR-11)', () => {
    const code = fs.readFileSync(componentPath, 'utf8');

    // Vibração háptica defensiva
    assert.ok(code.includes('navigator.vibrate'), 'Deve invocar API de vibração háptica');
    assert.ok(code.includes('15, 50, 15'), 'Deve utilizar padrão de vibração dupla comemorativa');

    // Cópia para clipboard
    assert.ok(code.includes('navigator.clipboard.writeText'), 'Deve copiar para a área de transferência');

    // Integração com DonationService
    assert.ok(code.includes('DonationService.logDonationCopy'), 'Deve registrar intenção no serviço de doações');
  });

  it('deve implementar UX livre de dark patterns (botão Agora Não claro e sem contadores)', () => {
    const code = fs.readFileSync(componentPath, 'utf8');

    assert.ok(code.includes('data-testid="btn-dismiss-now"'), 'Deve conter botão explícito de saída');
    assert.ok(code.includes('Agora Não'), 'Botão de saída deve ter texto neutro sem culpabilização');

    // Não deve conter contadores regressivos ou desativação forçada
    assert.ok(!code.includes('countdown'), 'Não deve ter contador de bloqueio');
    assert.ok(!code.includes('disabled={countdown'), 'Botão de fechar não pode estar desativado');
  });

  it('deve validar a integração do modal no dashboard do App.tsx', () => {
    const appPath = path.resolve(process.cwd(), 'apps/pwa/src/App.tsx');
    const appCode = fs.readFileSync(appPath, 'utf8');

    assert.ok(appCode.includes('DonationBottomSheet'), 'App.tsx deve importar e renderizar DonationBottomSheet');
    assert.ok(appCode.includes('data-testid="header-btn-donate"'), 'App.tsx deve conter botão de acesso direto para apoio comunitário');
  });

  it('deve validar a integração do modal no StoreJobsList.tsx para avaliação 5 estrelas', () => {
    const storeJobsPath = path.resolve(process.cwd(), 'apps/pwa/src/components/jobs/StoreJobsList.tsx');
    const storeCode = fs.readFileSync(storeJobsPath, 'utf8');

    assert.ok(storeCode.includes('DonationBottomSheet'), 'StoreJobsList.tsx deve importar DonationBottomSheet');
    assert.ok(storeCode.includes('triggerMoment="rating_5_stars"'), 'Deve acionar modal com trigger rating_5_stars');
  });

  it('deve validar a integração do modal no MatchedContactCard.tsx para turno concluído', () => {
    const contactCardPath = path.resolve(process.cwd(), 'apps/pwa/src/components/jobs/MatchedContactCard.tsx');
    const cardCode = fs.readFileSync(contactCardPath, 'utf8');

    assert.ok(cardCode.includes('DonationBottomSheet'), 'MatchedContactCard.tsx deve importar DonationBottomSheet');
    assert.ok(cardCode.includes('triggerMoment="shift_completed"'), 'Deve acionar modal com trigger shift_completed');
  });
});
