// ==============================================================================
// Component: apps/pwa/src/components/jobs/MatchedContactCard.tsx
// Description: Card de exibição de contatos liberados pós-matching com atalhos para WhatsApp e discagem direta.
// Story: 2.4 - Fechamento de Matching, Liberação de Contatos e Gestão de Reputação/XP
// ==============================================================================

import React, { useState } from 'react';
import type { MatchedJobContact, JobPost } from '../../jobs/types.ts';
import { completeJob, cancelJobWithPenaltyCheck } from '../../jobs/job-service.ts';
import { DonationBottomSheet } from '../donations/DonationBottomSheet.tsx';
import { Avatar } from '../ui/Avatar.tsx';
import { Bike, Store, Star, Phone, MessageCircle, AlertTriangle, Flag, Car, Zap, CheckCircle } from 'lucide-react';

interface MatchedContactCardProps {
  contact: MatchedJobContact;
  currentUserId: string;
  isStore: boolean;
  jobStatus?: string;
  hasRated?: boolean;
  onJobUpdated?: (updatedJob: JobPost) => void;
  onOpenRatingModal?: (contact: MatchedJobContact) => void;
}

export const MatchedContactCard: React.FC<MatchedContactCardProps> = ({
  contact,
  currentUserId,
  isStore,
  jobStatus,
  hasRated = false,
  onJobUpdated,
  onOpenRatingModal
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDonationOpen, setIsDonationOpen] = useState(false);

  // O parceiro do lojista é o entregador; o parceiro do entregador é o lojista
  const partnerName = isStore ? contact.courier_name : contact.store_contact_name || contact.store_name;
  const partnerPhone = isStore ? contact.courier_phone_number : contact.store_phone_number;
  const partnerRole = isStore ? 'Entregador Confirmado' : 'Estabelecimento Comercial';

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
        setStatusMessage('Turno concluído com sucesso! XP de gamificação creditado.');
        setIsDonationOpen(true);
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
        setErrorMessage(res.error || 'Erro ao cancelar o turno.');
      } else {
        setStatusMessage('Turno cancelado.');
        if (onJobUpdated) onJobUpdated(res.job);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha de comunicação.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isClosed = jobStatus === 'completed' || jobStatus === 'cancelled';

  if (isClosed) {
    if (hasRated) {
      return (
        <div
          data-testid="shift-completed-rated"
          style={{
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: '#10b981',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          <CheckCircle size={14} />
          <span>Turno finalizado e avaliado</span>
        </div>
      );
    }

    return (
      <div
        data-testid="shift-completed-unrated"
        style={{
          marginTop: '14px',
          paddingTop: '12px',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#facc15' }}>
          <Star size={15} fill="#facc15" />
          <span style={{ fontWeight: 600 }}>Avaliação Pendente</span>
        </div>

        {onOpenRatingModal && (
          <button
            type="button"
            data-testid="btn-evaluate-closed-shift"
            onClick={() => {
              triggerHaptic(15);
              onOpenRatingModal(contact);
            }}
            style={{
              minHeight: '44px',
              padding: '0 16px',
              borderRadius: '10px',
              backgroundColor: '#facc15',
              border: 'none',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(250, 204, 21, 0.25)',
              transition: 'transform 0.1s ease'
            }}
          >
            <Star size={14} fill="#0f172a" />
            <span>Avaliar Entregador (+10 XP)</span>
          </button>
        )}

        {/* Modal de Microdoação PIX (Story 4.2 - Delight Moment #1) */}
        <DonationBottomSheet
          isOpen={isDonationOpen}
          onClose={() => setIsDonationOpen(false)}
          triggerMoment="shift_completed"
          currentUserId={currentUserId}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#131822',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid #1e293b',
        marginTop: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#f8fafc'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
        <Avatar
          src={isStore ? contact.courier_avatar_url : contact.store_avatar_url}
          name={partnerName}
          userType={isStore ? 'courier' : 'store'}
          size="md"
        />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
              {partnerName}
            </h4>
            {isStore && contact.courier_modal && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#1e293b',
                  color: '#38bdf8',
                  fontWeight: 600
                }}
              >
                {contact.courier_modal === 'motorcycle' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Bike size={12} /> Moto</span>
                ) : contact.courier_modal === 'bicycle' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Bike size={12} /> Bike</span>
                ) : contact.courier_modal === 'e-bike' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Zap size={12} /> E-Bike</span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Car size={12} /> Carro</span>
                )}
              </span>
            )}
            {isStore && contact.courier_level && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 230, 0, 0.1)',
                  color: '#ffe600',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Star size={11} fill="currentColor" /> {contact.courier_level} ({contact.courier_xp ?? 0} XP)
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#38bdf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Phone size={13} />
            <span>{formattedPhone}</span>
          </p>
        </div>
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
          <MessageCircle size={16} />
          <span>Chamar WhatsApp</span>
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
          <Phone size={16} />
          <span>Ligar Agora</span>
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
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span>{errorMessage}</span>
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
          <Flag size={16} />
          <span>Concluir Turno (+XP)</span>
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

        {!isStore && (
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
        )}
      </div>

      {/* Modal de Microdoação PIX (Story 4.2 - Delight Moment #1) */}
      <DonationBottomSheet
        isOpen={isDonationOpen}
        onClose={() => setIsDonationOpen(false)}
        triggerMoment="shift_completed"
        currentUserId={currentUserId}
      />
    </div>
  );
};
