/**
 * @file ReferralCard.tsx
 * @description Componente de Cartão de Indicação Viral com compartilhamento multicanal em 1 clique (FR-15, NFR-9).
 * Oferece disparo para WhatsApp, cópia de link com Haptic Feedback e Web Share API.
 */

import React, { useState } from 'react';
import { ReferralService } from '../../referral/referral-service.ts';

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
    } catch (err: any) {
      showToast('Não foi possível compartilhar automaticamente.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#131822',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid #1e293b',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        marginBottom: '20px',
        position: 'relative',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div style={{ marginBottom: '14px' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: '#10b981',
            letterSpacing: '0.5px'
          }}
        >
          🚀 INDICAÇÃO & EXPANSÃO COMUNITÁRIA
        </span>
        <h3 style={{ margin: '4px 0 6px 0', fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
          Seu Link de Indicação Exclusivo
        </h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: 1.4 }}>
          Compartilhe com amigos lojistas e motoboys. Cada novo cadastro ajuda a atingir o quórum e desbloquear a operação no seu bairro!
        </p>
      </div>

      {/* Caixa de Código e Link */}
      <div
        style={{
          backgroundColor: '#0f172a',
          borderRadius: '12px',
          padding: '14px',
          marginBottom: '16px',
          border: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        <div>
          <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>
            Código do Indicador
          </span>
          <strong
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: '#38bdf8',
              letterSpacing: '1px'
            }}
          >
            {referralCode}
          </strong>
        </div>

        <div style={{ fontSize: '12px', color: '#64748b', wordBreak: 'break-all', maxWidth: '100%' }}>
          {referralUrl}
        </div>
      </div>

      {/* Botões de Ação Rápida (Alvos >= 48px) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px'
        }}
      >
        <button
          type="button"
          disabled={isSharing}
          onClick={handleShareClick}
          style={{
            minHeight: '48px',
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            fontSize: '14px',
            fontWeight: 700,
            cursor: isSharing ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background-color 0.2s ease'
          }}
        >
          📋 Copiar / Compartilhar
        </button>

        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            minHeight: '48px',
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: '#16a34a',
            color: '#ffffff',
            border: 'none',
            fontSize: '14px',
            fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background-color 0.2s ease'
          }}
        >
          💬 WhatsApp
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
            backgroundColor: '#10b981',
            color: '#0f172a',
            padding: '8px 16px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap',
            zIndex: 10
          }}
        >
          ✅ {toastMessage}
        </div>
      )}
    </div>
  );
};
