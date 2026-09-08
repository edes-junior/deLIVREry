// ==============================================================================
// Component: apps/pwa/src/components/donations/DonationBottomSheet.tsx
// Description: Bottom Sheet touch-friendly de microdoação comunitária PIX nos 5 Delight Moments.
// Story: 4.2 - Componente Bottom Sheet de Doação PIX com Haptic Feedback
// Architecture: Ergonomia Touch (NFR-9 >= 48px), Zero Dark Patterns, Haptic Feedback
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import type { DonationTriggerMoment, PixConfiguration } from '../../donations/types.ts';
import { DonationService } from '../../donations/donation-service.ts';
import { generatePixBrcode } from '../../donations/pix-config.ts';

export interface DonationBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  triggerMoment: DonationTriggerMoment;
  currentUserId?: string | null;
  onDonated?: (details: { amount: number; triggerMoment: DonationTriggerMoment }) => void;
}

interface MomentContent {
  icon: string;
  badge: string;
  title: string;
  subtitle: string;
  message: string;
}

const MOMENT_CONTENTS: Record<DonationTriggerMoment, MomentContent> = {
  shift_completed: {
    icon: '🏍️💨',
    badge: 'Turno Concluído',
    title: 'Turno Concluído com Sucesso!',
    subtitle: 'Seu pagamento foi confirmado diretamente pelo lojista sem taxas intermediárias.',
    message: 'O deLIVREry é 100% gratuito e sem comissões. Se este turno fez a diferença no seu dia, considere apoiar a manutenção dos nossos servidores com um cafezinho.',
  },
  level_up: {
    icon: '🏆⭐',
    badge: 'Nova Conquista',
    title: 'Parabéns, Você Subiu de Nível!',
    subtitle: 'Sua dedicação fortalece a autonomia e a cooperação da nossa rede local.',
    message: 'Cada entrega reforça um ecossistema mais livre e justo. Apoie com qualquer valor para mantermos a plataforma sempre independente e gratuita.',
  },
  emergency_matched: {
    icon: '⏱️⚡',
    badge: 'Resgate Operacional',
    title: 'Vaga de Emergência Atendida a Tempo!',
    subtitle: 'Um entregador parceiro aceitou seu chamado em menos de 5 minutos.',
    message: 'Sem cobranças abusivas de intermediação, sua cozinha não parou! Considere contribuir com nossa infraestrutura para mantermos o sistema rápido e estável.',
  },
  rating_5_stars: {
    icon: '⭐⭐⭐⭐⭐',
    badge: 'Excelência Reconhecida',
    title: 'Avaliação 5 Estrelas Registrada!',
    subtitle: 'A confiança recíproca é a maior moeda e o coração do deLIVREry.',
    message: 'Construir parcerias sólidas sem intermediários corporativos é possível. Ajude a manter nossos servidores no ar com uma microdoação comunitária.',
  },
  api_1000_requests: {
    icon: '🚀💻',
    badge: 'Integração Ativa',
    title: 'Marca de 1.000 Requisições Atingida!',
    subtitle: 'Seu sistema integrado está conectado e operando em alta performance.',
    message: 'A API neutra do deLIVREry continuará aberta e descentralizada. Apoie nossos custos de nuvem e banco de dados para continuarmos crescendo.',
  },
  manual_donation: {
    icon: '💚🤝',
    badge: 'Apoio Comunitário',
    title: 'Apoie a Sustentabilidade do deLIVREry!',
    subtitle: 'Plataforma livre de taxas, mantida por e para quem faz a entrega acontecer.',
    message: 'Sua contribuição voluntária via PIX cobre diretamente os custos de servidores, banco de dados e disparo de notificações Web Push.',
  },
};

const SUGGESTED_AMOUNTS = [2.0, 5.0, 10.0];

export const DonationBottomSheet: React.FC<DonationBottomSheetProps> = ({
  isOpen,
  onClose,
  triggerMoment,
  currentUserId,
  onDonated,
}) => {
  if (!isOpen) return null;

  const [selectedAmount, setSelectedAmount] = useState<number>(5.0);
  const [isCustomAmount, setIsCustomAmount] = useState<boolean>(false);
  const [customAmountInput, setCustomAmountInput] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastText, setToastText] = useState<string>('Código PIX copiado! Cole no seu app de banco.');
  const [showQrCode, setShowQrCode] = useState<boolean>(false);
  const [pixConfig, setPixConfig] = useState<PixConfiguration>(() => DonationService.getPixConfig());

  // Haptic feedback defensivo
  const triggerHaptic = (pattern: number | number[] = 15) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignora silenciosamente em navegadores sem suporte
      }
    }
  };

  const content = MOMENT_CONTENTS[triggerMoment] || MOMENT_CONTENTS.manual_donation;

  // Calcula o payload BR Code atualizado com o valor selecionado
  const activeBrcodePayload = useMemo(() => {
    if (pixConfig.isCustomPayload) {
      return pixConfig.brCodePayload;
    }
    return generatePixBrcode({
      key: pixConfig.key,
      recipientName: pixConfig.recipientName,
      city: pixConfig.city,
      amount: selectedAmount > 0 ? selectedAmount : undefined,
      txid: 'DELIVRERY',
    });
  }, [pixConfig, selectedAmount]);

  const handleChipSelect = (amount: number) => {
    triggerHaptic(10);
    setSelectedAmount(amount);
    setIsCustomAmount(false);
  };

  const handleCustomChipClick = () => {
    triggerHaptic(10);
    setIsCustomAmount(true);
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomAmountInput(val);
    const parsed = parseFloat(val.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      setSelectedAmount(parsed);
    }
  };

  const handleCopyPix = async () => {
    triggerHaptic([15, 50, 15]); // Vibração dupla comemorativa
    setIsCopied(true);
    setShowToast(true);

    // Grava na área de transferência com fallback
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(activeBrcodePayload);
      } catch {
        // Fallback para textarea em ambientes antigos
        const textarea = document.createElement('textarea');
        textarea.value = activeBrcodePayload;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    }

    // Registra intenção de doação de forma assíncrona no backend
    try {
      const res = await DonationService.logDonationCopy({
        userId: currentUserId || null,
        triggerMoment,
        suggestedAmount: selectedAmount,
      });

      if (res.reward?.isFirstOfMonth && res.reward.xpAwarded > 0) {
        setToastText('🎉 +25 XP e Selo de Apoiador da Comunidade Ativado!');
      } else if (res.reward?.communitySupporter) {
        setToastText('💚 Código PIX copiado! Obrigado pelo apoio contínuo à comunidade!');
      } else {
        setToastText('Código PIX copiado! Cole no seu app de banco.');
      }
    } catch {
      setToastText('Código PIX copiado! Cole no seu app de banco.');
    }

    if (onDonated) {
      onDonated({ amount: selectedAmount, triggerMoment });
    }

    // Auto-dismiss do estado de copiado após 3 segundos
    setTimeout(() => {
      setIsCopied(false);
    }, 3000);

    setTimeout(() => {
      setShowToast(false);
    }, 3500);
  };

  const handleDismiss = () => {
    triggerHaptic(10);
    setShowToast(false);
    onClose();
  };

  return (
    <div
      data-testid="donation-bottom-sheet-overlay"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity duration-300"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={handleDismiss}
    >
      {/* Toast de Confirmação */}
      {showToast && (
        <div
          data-testid="toast-pix-copied"
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#10b981',
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '9999px',
            fontWeight: 600,
            fontSize: '14px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 10000,
            minHeight: '48px',
          }}
        >
          <span>✓</span>
          <span>{toastText}</span>
        </div>
      )}

      {/* Container do Bottom Sheet */}
      <div
        data-testid="donation-bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="donation-sheet-title"
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#18181b',
          color: '#fafafa',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          border: '1px solid #27272a',
          borderBottom: 'none',
          padding: '24px 20px 32px 20px',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
          maxHeight: '90vh',
          overflowY: 'auto',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual de gaveta móvel */}
        <div
          style={{
            width: '44px',
            height: '5px',
            backgroundColor: '#3f3f46',
            borderRadius: '9999px',
            margin: '0 auto 16px auto',
          }}
        />

        {/* Cabeçalho do Momento */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '32px', marginBottom: '6px' }}>{content.icon}</div>
          <span
            data-testid="moment-badge"
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '9999px',
              backgroundColor: '#064e3b',
              color: '#34d399',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '8px',
            }}
          >
            {content.badge}
          </span>
          <h3
            id="donation-sheet-title"
            data-testid="donation-sheet-title"
            style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}
          >
            {content.title}
          </h3>
          <p
            data-testid="donation-sheet-subtitle"
            style={{ fontSize: '13px', color: '#a1a1aa', margin: '0 0 10px 0', lineHeight: 1.4 }}
          >
            {content.subtitle}
          </p>
          <div
            style={{
              backgroundColor: '#27272a',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '13px',
              color: '#d4d4d8',
              lineHeight: 1.5,
              textAlign: 'left',
              borderLeft: '4px solid #10b981',
            }}
          >
            {content.message}
          </div>
        </div>

        {/* Seletor de Chips de Valores */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#a1a1aa',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            Escolha o valor de apoio voluntário:
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {SUGGESTED_AMOUNTS.map((amount) => {
              const isSelected = !isCustomAmount && selectedAmount === amount;
              return (
                <button
                  key={amount}
                  type="button"
                  data-testid={`chip-amount-${amount}`}
                  onClick={() => handleChipSelect(amount)}
                  style={{
                    flex: 1,
                    minWidth: '75px',
                    minHeight: '48px', // NFR-9: Touch target >= 48px
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: isSelected ? '2px solid #10b981' : '1px solid #3f3f46',
                    backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.15)' : '#27272a',
                    color: isSelected ? '#34d399' : '#f4f4f5',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  R$ {amount.toFixed(2).replace('.', ',')}
                </button>
              );
            })}

            <button
              type="button"
              data-testid="chip-amount-custom"
              onClick={handleCustomChipClick}
              style={{
                flex: 1,
                minWidth: '75px',
                minHeight: '48px', // NFR-9: Touch target >= 48px
                padding: '10px 14px',
                borderRadius: '12px',
                border: isCustomAmount ? '2px solid #10b981' : '1px solid #3f3f46',
                backgroundColor: isCustomAmount ? 'rgba(16, 185, 129, 0.15)' : '#27272a',
                color: isCustomAmount ? '#34d399' : '#f4f4f5',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              Outro
            </button>
          </div>

          {/* Campo de valor customizado */}
          {isCustomAmount && (
            <div style={{ marginTop: '12px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#d4d4d8',
                  marginBottom: '4px',
                }}
              >
                Digite o valor desejado (R$):
              </label>
              <input
                type="number"
                step="1.00"
                min="0.50"
                placeholder="Ex: 15.00"
                value={customAmountInput}
                onChange={handleCustomAmountChange}
                data-testid="input-custom-amount"
                style={{
                  width: '100%',
                  minHeight: '48px', // NFR-9: Touch target >= 48px
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid #10b981',
                  backgroundColor: '#27272a',
                  color: '#ffffff',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>

        {/* Informações da Chave e Destinatário */}
        <div
          style={{
            backgroundColor: '#27272a',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '20px',
            fontSize: '12px',
            color: '#a1a1aa',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Favorecido:</span>
            <strong style={{ color: '#ffffff' }}>{pixConfig.recipientName}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Chave PIX:</span>
            <strong style={{ color: '#34d399' }}>{pixConfig.key}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Cidade:</span>
            <span style={{ color: '#ffffff' }}>{pixConfig.city}</span>
          </div>
        </div>

        {/* QR Code toggle opcional */}
        {showQrCode && (
          <div
            data-testid="qr-code-container"
            style={{
              textAlign: 'center',
              padding: '16px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              marginBottom: '20px',
              color: '#000000',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
              QR Code do Apoio Comunitário
            </div>
            {/* Representação visual simplificada do QR code */}
            <div
              style={{
                width: '160px',
                height: '160px',
                margin: '0 auto',
                border: '4px solid #000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                padding: '8px',
                backgroundColor: '#f4f4f5',
              }}
            >
              [ PIX BR CODE ]
            </div>
            <div style={{ fontSize: '11px', color: '#52525b', marginTop: '6px' }}>
              Abra o app do seu banco e aponte a câmera
            </div>
          </div>
        )}

        {/* Botões de Ação */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Botão Primário: Copiar Código PIX */}
          <button
            type="button"
            data-testid="btn-copy-pix"
            onClick={handleCopyPix}
            style={{
              width: '100%',
              minHeight: '52px', // NFR-9: Touch target >= 48px
              padding: '14px 20px',
              borderRadius: '14px',
              border: 'none',
              backgroundColor: isCopied ? '#059669' : '#10b981',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
              transition: 'background-color 0.2s ease',
            }}
          >
            <span>{isCopied ? '✓' : '📋'}</span>
            <span>
              {isCopied
                ? 'Código PIX Copiado!'
                : `Copiar Código PIX (R$ ${selectedAmount.toFixed(2).replace('.', ',')})`}
            </span>
          </button>

          {/* Toggle QR Code */}
          <button
            type="button"
            data-testid="qr-toggle-btn"
            onClick={() => setShowQrCode(!showQrCode)}
            style={{
              width: '100%',
              minHeight: '48px', // NFR-9: Touch target >= 48px
              padding: '10px 16px',
              borderRadius: '12px',
              border: '1px solid #3f3f46',
              backgroundColor: 'transparent',
              color: '#d4d4d8',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>{showQrCode ? '🙈' : '📱'}</span>
            <span>{showQrCode ? 'Ocultar QR Code' : 'Mostrar QR Code'}</span>
          </button>

          {/* Botão Secundário: Agora Não (Zero Dark Patterns) */}
          <button
            type="button"
            data-testid="btn-dismiss-now"
            onClick={handleDismiss}
            style={{
              width: '100%',
              minHeight: '48px', // NFR-9: Touch target >= 48px
              padding: '12px 16px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#71717a',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s ease',
            }}
          >
            Agora Não
          </button>
        </div>
      </div>
    </div>
  );
};

export default DonationBottomSheet;
