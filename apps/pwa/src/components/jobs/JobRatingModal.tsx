// ==============================================================================
// Component: apps/pwa/src/components/jobs/JobRatingModal.tsx
// Description: Modal touch-friendly para avaliação mútua e pontuação de reputação
//              com critérios especializados, avaliação cega e concessão de +10 XP.
// Story: 2.4 - Fechamento de Matching, Liberação de Contatos e Gestão de Reputação/XP
// ==============================================================================

import React, { useState } from 'react';
import type { 
  MatchedJobContact, 
  PendingJobReview, 
  JobRating, 
  JobRatingSubmissionResult 
} from '../../jobs/types.ts';
import { 
  COURIER_RATING_CRITERIA, 
  STORE_RATING_CRITERIA 
} from '../../jobs/types.ts';
import { submitJobRating } from '../../jobs/job-service.ts';
import { X, AlertTriangle, Star, ShieldCheck, Sparkles, Award } from 'lucide-react';

interface JobRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: MatchedJobContact | PendingJobReview | null;
  currentUserId: string;
  isStore: boolean;
  onSuccess: (rating: JobRating, earnedXp?: number) => void;
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
  const [selectedCriteria, setSelectedCriteria] = useState<Record<string, boolean>>({});
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resolve os dados da contraparte independente se for MatchedJobContact ou PendingJobReview
  const targetPartnerId = 
    (contact as any).partner_id || 
    (isStore ? (contact as MatchedJobContact).courier_id : (contact as MatchedJobContact).store_id);

  const targetPartnerName = 
    (contact as any).partner_name || 
    (isStore ? (contact as MatchedJobContact).courier_name : ((contact as MatchedJobContact).store_contact_name || (contact as MatchedJobContact).store_name));

  const availableCriteria = isStore ? COURIER_RATING_CRITERIA : STORE_RATING_CRITERIA;

  const triggerHaptic = (pattern: number | number[] = 15) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const handleStarClick = (star: number) => {
    triggerHaptic(20);
    setSelectedRating(star);
  };

  const handleToggleCriteria = (key: string) => {
    triggerHaptic(15);
    setSelectedCriteria(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
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
      const res: JobRatingSubmissionResult = await submitJobRating(currentUserId, {
        job_id: contact.job_id,
        rated_user_id: targetPartnerId,
        rating: selectedRating,
        comment: comment.trim() || undefined,
        criteria: selectedCriteria
      });

      if (!res.success || !res.rating) {
        setErrorMessage(res.error || 'Erro ao registrar avaliação.');
      } else {
        onSuccess(res.rating, res.earnedXp);
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
          maxWidth: '460px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '22px',
          color: '#f8fafc',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Star size={20} fill="#facc15" color="#facc15" />
              <span>Avaliar Experiência</span>
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#facc15',
                backgroundColor: 'rgba(250, 204, 21, 0.15)',
                border: '1px solid rgba(250, 204, 21, 0.3)',
                padding: '2px 8px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              <Award size={12} /> +10 XP
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              minWidth: '40px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Banner de Avaliação Cega */}
        <div
          style={{
            backgroundColor: '#131d31',
            border: '1px solid #1e3a5f',
            borderRadius: '10px',
            padding: '10px 12px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#93c5fd',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}
        >
          <ShieldCheck size={16} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Avaliação Cega:</strong> Sua nota e comentários são sigilosos e revelados apenas quando ambos avaliarem ou após 6 horas do término do turno.
          </span>
        </div>

        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#94a3b8' }}>
          Como foi o turno com <strong style={{ color: '#f8fafc' }}>{targetPartnerName}</strong>?
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
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Seletor de Estrelas (1 a 5) com dimensão mínima touch-friendly >= 48px */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '12px'
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
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <Star size={24} fill={star <= selectedRating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginBottom: '18px', fontSize: '13px', fontWeight: 600, color: '#facc15' }}>
            {selectedRating === 5 && 'Excelente / Impecável'}
            {selectedRating === 4 && 'Muito Bom / Recomendado'}
            {selectedRating === 3 && 'Regular / Aceitável'}
            {selectedRating === 2 && 'Ruim / Teve Problemas'}
            {selectedRating === 1 && 'Péssimo / Não Recomendo'}
          </div>

          {/* Chips de Critérios Especializados */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
              Destaques do Turno (Toque para selecionar)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {availableCriteria.map((c) => {
                const isSelected = !!selectedCriteria[c.key];
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => handleToggleCriteria(c.key)}
                    style={{
                      minHeight: '38px',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: isSelected ? '1px solid #10b981' : '1px solid #334155',
                      backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.18)' : '#1e293b',
                      color: isSelected ? '#34d399' : '#cbd5e1',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
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
            {isSubmitting ? (
              'Gravando...'
            ) : (
              <>
                <Sparkles size={16} />
                <span>Enviar Avaliação (+10 XP)</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
