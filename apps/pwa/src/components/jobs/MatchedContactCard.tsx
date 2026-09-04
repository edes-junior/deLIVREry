// ==============================================================================
// Component: apps/pwa/src/components/jobs/MatchedContactCard.tsx
// Description: Card de exibição de contatos liberados pós-matching com atalhos para WhatsApp e discagem direta.
// Story: 2.4 - Fechamento de Matching, Liberação de Contatos e Gestão de Reputação/XP
// ==============================================================================

import React, { useState } from 'react';
import type { MatchedJobContact, JobPost } from '../../jobs/types.ts';
import { completeJob, cancelJobWithPenaltyCheck } from '../../jobs/job-service.ts';

interface MatchedContactCardProps {
  contact: MatchedJobContact;
  currentUserId: string;
  isStore: boolean;
  onJobUpdated?: (updatedJob: JobPost) => void;
  onOpenRatingModal?: (contact: MatchedJobContact) => void;
}

export const MatchedContactCard: React.FC<MatchedContactCardProps> = ({
  contact,
  currentUserId,
  isStore,
  onJobUpdated,
  onOpenRatingModal
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // O parceiro do lojista é o entregador; o parceiro do entregador é o lojista
  const partnerName = isStore ? contact.courier_name : contact.store_contact_name || contact.store_name;
  const partnerPhone = isStore ? contact.courier_phone_number : contact.store_phone_number;
  const partnerRole = isStore ? '🛵 Entregador Confirmado' : '🏪 Estabelecimento Comercial';

  // Higieniza número para os links de WhatsApp e discagem
  const cleanPhone = partnerPhone ? partnerPhone.replace(/\D/g, '') : '';
  const formattedPhone = partnerPhone || 'Telefone não informado';

  const defaultWhatsappMsg = encodeURIComponent(
    `Olá ${partnerName}! Combinamos o turno de entrega via deLIVREry (Vaga #${contact.job_id.slice(0, 6)}).`
  );
  const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${defaultWhatsappMsg}`;
  const phoneCallUrl = `tel:+55${cleanPhone}`;

  const triggerHaptic = (pattern: number | number[] = 15) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  // Conclusão de Turno (FR-14)
  const handleCompleteShift = async () => {
    triggerHaptic([20, 40, 20]);
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await completeJob(currentUserId, contact.job_id);
      if (!res.success || !res.job) {
        setErrorMessage(res.error || 'Erro ao concluir o turno.');
      } else {
        setStatusMessage('🎉 Turno concluído com sucesso! XP de gamificação creditado.');
        if (onJobUpdated) onJobUpdated(res.job);
        if (onOpenRatingModal) onOpenRatingModal(contact);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha de comunicação.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancelamento de Turno com verificação de penalidade tardia
  const handleCancelShift = async () => {
    if (!window.confirm('Tem certeza que deseja cancelar este turno confirmado? Se faltarem menos de 2 horas para o início, haverá penalidade de -30 XP.')) {
      return;
    }

    triggerHaptic(30);
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await cancelJobWithPenaltyCheck(currentUserId, contact.job_id);
      if (!res.success || !res.job) {
        setErrorMessage(res.error || 'Erro ao cancelar turno.');
      } else {
        const msg = res.penaltyApplied
          ? '⚠️ Turno cancelado a menos de 2h do início. Penalidade de -30 XP aplicada.'
          : 'Turno cancelado com antecedência sem penalidades.';
        setStatusMessage(msg);
        if (onJobUpdated) onJobUpdated(res.job);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao processar cancelamento.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#0f172a',
        border: '1px solid #10b981',
        borderRadius: '16px',
        padding: '20px',
        marginTop: '16px',
        boxShadow: '0 8px 24px rgba(16, 185, 129, 0.15)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#f8fafc'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span
          style={{
            backgroundColor: '#064e3b',
            color: '#34d399',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: '999px'
          }}
        >
          🤝 Matching Confirmado
        </span>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
          Diária: R$ {Number(contact.offered_daily_rate).toFixed(2)} | Taxa: R$ {Number(contact.offered_delivery_fee).toFixed(2)}
        </span>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>{partnerRole}</div>
        <h4 style={{ fontSize: '18px', fontWeight: 700, margin: '2px 0 4px 0', color: '#f1f5f9' }}>
          {partnerName}
        </h4>
        <p style={{ margin: 0, fontSize: '14px', color: '#38bdf8', fontWeight: 600 }}>
          📞 {formattedPhone}
        </p>
      </div>

      {/* Botões de Ação de Comunicação Direta (Zero Intermediação / AD-2, AD-10) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          marginBottom: '16px'
        }}
      >
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => triggerHaptic(15)}
          style={{
            minHeight: '48px',
            borderRadius: '12px',
            backgroundColor: '#25D366',
            color: '#0f172a',
            fontWeight: 700,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
          }}
        >
          💬 Chamar WhatsApp
        </a>

        <a
          href={phoneCallUrl}
          onClick={() => triggerHaptic(15)}
          style={{
            minHeight: '48px',
            borderRadius: '12px',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
          }}
        >
          📞 Ligar Agora
        </a>
      </div>

      {/* Mensagens de Sucesso ou Erro */}
      {statusMessage && (
        <div
          style={{
            backgroundColor: '#064e3b',
            border: '1px solid #059669',
            borderRadius: '10px',
            padding: '10px 12px',
            fontSize: '13px',
            color: '#a7f3d0',
            marginBottom: '12px'
          }}
        >
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            backgroundColor: '#450a0a',
            border: '1px solid #dc2626',
            borderRadius: '10px',
            padding: '10px 12px',
            fontSize: '13px',
            color: '#fca5a5',
            marginBottom: '12px'
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Ações Operacionais: Concluir Turno & Avaliar ou Cancelar */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={isProcessing}
          onClick={handleCompleteShift}
          style={{
            flex: 1,
            minHeight: '48px',
            borderRadius: '12px',
            backgroundColor: '#10b981',
            border: 'none',
            color: '#0f172a',
            fontWeight: 700,
            fontSize: '14px',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          🏁 Concluir Turno (+XP)
        </button>

        {onOpenRatingModal && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic(15);
              onOpenRatingModal(contact);
            }}
            style={{
              minHeight: '48px',
              padding: '0 16px',
              borderRadius: '12px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#facc15',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            ⭐ Avaliar
          </button>
        )}

        <button
          type="button"
          disabled={isProcessing}
          onClick={handleCancelShift}
          style={{
            minHeight: '48px',
            padding: '0 14px',
            borderRadius: '12px',
            backgroundColor: '#1e293b',
            border: '1px solid #7f1d1d',
            color: '#f87171',
            fontWeight: 600,
            fontSize: '13px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};
