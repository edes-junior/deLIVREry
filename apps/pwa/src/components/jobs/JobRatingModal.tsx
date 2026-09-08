// ==============================================================================
// Component: apps/pwa/src/components/jobs/JobRatingModal.tsx
// Description: Modal touch-friendly para avaliação mútua e pontuação de reputação (1 a 5 estrelas).
// Story: 2.4 - Fechamento de Matching, Liberação de Contatos e Gestão de Reputação/XP
// ==============================================================================

import React, { useState } from 'react';
import type { MatchedJobContact, JobRating } from '../../jobs/types.ts';
import { submitJobRating } from '../../jobs/job-service.ts';

interface JobRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: MatchedJobContact | null;
  currentUserId: string;
  isStore: boolean;
  onSuccess: (rating: JobRating) => void;
}

export const JobRatingModal: React.FC<JobRatingModalProps> = ({
  isOpen,
  onClose,
  contact,
  currentUserId,
  isStore,
  onSuccess
}) => {
  if (!isOpen || !contact) return null;

  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const targetPartnerId = isStore ? contact.courier_id : contact.store_id;
  const targetPartnerName = isStore ? contact.courier_name : contact.store_name;

  const triggerHaptic = (ms: number = 15) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  };

  const handleStarClick = (star: number) => {
    triggerHaptic(20);
    setSelectedRating(star);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (selectedRating < 1 || selectedRating > 5) {
      setErrorMessage('Por favor, selecione uma nota entre 1 e 5 estrelas.');
      return;
    }

    triggerHaptic([15, 30, 15]);
    setIsSubmitting(true);

    try {
      const res = await submitJobRating(currentUserId, {
        job_id: contact.job_id,
        rated_user_id: targetPartnerId,
        rating: selectedRating,
        comment: comment.trim() || undefined
      });

      if (!res.success || !res.rating) {
        setErrorMessage(res.error || 'Erro ao registrar avaliação.');
      } else {
        onSuccess(res.rating);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha de comunicação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 8, 16, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 1000,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '440px',
          padding: '24px',
          color: '#f8fafc',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
            ⭐ Avaliar Experiência
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              minWidth: '48px',
              minHeight: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#94a3b8' }}>
          Como foi a pontualidade e cooperação de <strong style={{ color: '#f8fafc' }}>{targetPartnerName}</strong> neste turno?
        </p>

        {errorMessage && (
          <div
            style={{
              backgroundColor: '#450a0a',
              border: '1px solid #dc2626',
              borderRadius: '10px',
              padding: '10px 12px',
              marginBottom: '16px',
              color: '#fca5a5',
              fontSize: '13px'
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Seletor de Estrelas (1 a 5) com dimensão mínima touch-friendly >= 48px */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '20px'
            }}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleStarClick(star)}
                style={{
                  minWidth: '52px',
                  minHeight: '52px',
                  borderRadius: '12px',
                  backgroundColor: star <= selectedRating ? '#1e293b' : '#0a0f1d',
                  border: star <= selectedRating ? '1px solid #facc15' : '1px solid #334155',
                  color: star <= selectedRating ? '#facc15' : '#475569',
                  fontSize: '28px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                ★
              </button>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginBottom: '16px', fontSize: '14px', fontWeight: 600, color: '#facc15' }}>
            {selectedRating === 5 && '🌟 Excelente / Impecável'}
            {selectedRating === 4 && '👍 Muito Bom / Recomendado'}
            {selectedRating === 3 && '👌 Regular / Aceitável'}
            {selectedRating === 2 && '👎 Ruim / Teve Problemas'}
            {selectedRating === 1 && '⚠️ Péssimo / Não Recomendo'}
          </div>

          {/* Campo de Comentário Opcional */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
              Comentário Construtivo (Opcional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex: Pontual, prestativo e ótimo manuseio das encomendas."
              maxLength={300}
              rows={3}
              style={{
                width: '100%',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '10px',
                padding: '10px 12px',
                color: '#f8fafc',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              minHeight: '48px',
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: '#facc15',
              border: 'none',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: '15px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(250, 204, 21, 0.35)'
            }}
          >
            {isSubmitting ? 'Gravando...' : '⭐ Enviar Avaliação'}
          </button>
        </form>
      </div>
    </div>
  );
};
