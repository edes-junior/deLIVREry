/**
 * @file ReferralCard.tsx
 * @description Componente de Cartão de Indicação Viral com compartilhamento multicanal em 1 clique (FR-15, NFR-9).
 * Oferece disparo para WhatsApp, cópia de link com Haptic Feedback e Web Share API.
 */

import React, { useState } from 'react';
import { ReferralService } from '../../referral/referral-service.ts';
import { Card } from '../ui/Card.tsx';
import { Button } from '../ui/Button.tsx';
import { Rocket, Copy, MessageCircle, Check } from 'lucide-react';

interface ReferralCardProps {
  referralCode: string;
  neighborhoodName?: string;
}

export const ReferralCard: React.FC<ReferralCardProps> = ({
  referralCode,
  neighborhoodName
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const referralUrl = ReferralService.generateReferralUrl(referralCode);
  const whatsAppUrl = ReferralService.generateWhatsAppShareUrl(referralCode, neighborhoodName);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleShareClick = async () => {
    setIsSharing(true);
    try {
      const result = await ReferralService.shareReferral(referralCode, neighborhoodName);
      if (result.message) {
        showToast(result.message);
      }
    } catch {
      showToast('Não foi possível compartilhar automaticamente.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Card variant="raised" style={{ position: 'relative' }}>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--neon-emerald)', letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Rocket size={13} />
            <span>Expansão Comunitária</span>
          </span>
        </div>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
          Convide Amigos e Desbloqueie o Bairro
        </h3>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          Cada novo colega entregador ou comerciante cadastrado acelera a meta coletiva de {neighborhoodName || 'seu bairro'}.
        </p>
      </div>

      {/* Caixa de Código e Link com Fonte Tabular */}
      <div
        style={{
          backgroundColor: 'var(--bg-base)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          marginBottom: '16px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>
            Seu Código de Indicação
          </span>
          <strong
            className="tabular-price"
            style={{
              fontSize: '18px',
              color: 'var(--highvis-yellow)',
              letterSpacing: '0.05em'
            }}
          >
            {referralCode}
          </strong>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', wordBreak: 'break-all', maxWidth: '100%', fontFamily: 'var(--font-mono)' }}>
          {referralUrl}
        </div>
      </div>

      {/* Botões de Ação Rápida */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: '10px',
          width: '100%'
        }}
      >
        <Button
          variant="secondary"
          disabled={isSharing}
          onClick={handleShareClick}
          style={{ width: '100%', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <Copy size={14} />
          <span>Copiar Link</span>
        </Button>

        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none', width: '100%' }}
        >
          <Button
            variant="whatsapp"
            style={{ width: '100%', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <MessageCircle size={14} />
            <span>WhatsApp</span>
          </Button>
        </a>
      </div>

      {/* Toast Flutuante de Feedback */}
      {toastMessage && (
        <div
          style={{
            position: 'absolute',
            bottom: '-12px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--neon-emerald)',
            color: 'var(--bg-base)',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            fontSize: '12px',
            fontWeight: 800,
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            whiteSpace: 'nowrap',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Check size={14} />
          <span>{toastMessage}</span>
        </div>
      )}
    </Card>
  );
};
