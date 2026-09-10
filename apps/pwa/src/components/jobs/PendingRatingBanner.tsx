// ==============================================================================
// Component: apps/pwa/src/components/jobs/PendingRatingBanner.tsx
// Description: Banner desacoplado e touch-friendly para lembrete e resgate de XP
//              de avaliações pendentes de turnos anteriores na reabertura do app.
// Story: 2.4 - Conclusão em Duas Vias e Gestão de Reputação/XP
// ==============================================================================

import React from 'react';
import type { PendingJobReview } from '../../jobs/types.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { Star, Award, Clock, ArrowRight } from 'lucide-react';

interface PendingRatingBannerProps {
  pendingReviews: PendingJobReview[];
  onOpenRatingModal: (review: PendingJobReview) => void;
}

export const PendingRatingBanner: React.FC<PendingRatingBannerProps> = ({
  pendingReviews,
  onOpenRatingModal
}) => {
  if (!pendingReviews || pendingReviews.length === 0) {
    return null;
  }

  const review = pendingReviews[0];
  const count = pendingReviews.length;

  const triggerHaptic = (pattern: number = 15) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const handleOpen = () => {
    triggerHaptic(20);
    onOpenRatingModal(review);
  };

  // Formata data e horário do turno
  const shiftDate = new Date(review.shift_start_time);
  const formattedDate = shiftDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit'
  });
  const formattedStartTime = shiftDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  const formattedEndTime = new Date(review.shift_end_time).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #182235 0%, #0f172a 100%)',
        border: '1px solid #facc15',
        borderRadius: '16px',
        padding: '16px 18px',
        marginBottom: '20px',
        boxShadow: '0 4px 20px rgba(250, 204, 21, 0.15)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#f8fafc',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              backgroundColor: '#facc15',
              color: '#0f172a',
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textTransform: 'uppercase'
            }}
          >
            <Star size={12} fill="#0f172a" />
            <span>Avaliação Pendente</span>
          </span>
          {count > 1 && (
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
              +{count - 1} outro{count > 2 ? 's' : ''}
            </span>
          )}
        </div>

        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#facc15',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'rgba(250, 204, 21, 0.12)',
            padding: '2px 8px',
            borderRadius: '10px'
          }}
        >
          <Award size={13} /> +10 XP
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <Avatar
          src={review.partner_avatar_url}
          name={review.partner_name}
          userType={review.partner_role}
          size="md"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {review.partner_name}
          </h4>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} />
            <span>Turno de {formattedDate} ({formattedStartTime} às {formattedEndTime})</span>
          </p>
        </div>
      </div>

      <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#cbd5e1', lineHeight: '1.4' }}>
        Como foi sua experiência neste turno? Sua avaliação ajuda a comunidade e libera <strong>+10 XP</strong> na sua conta!
      </p>

      <button
        type="button"
        onClick={handleOpen}
        style={{
          width: '100%',
          minHeight: '44px',
          borderRadius: '10px',
          backgroundColor: '#facc15',
          border: 'none',
          color: '#0f172a',
          fontWeight: 700,
          fontSize: '14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          boxShadow: '0 2px 10px rgba(250, 204, 21, 0.25)',
          transition: 'transform 0.1s ease'
        }}
      >
        <span>Avaliar Agora e Resgatar XP</span>
        <ArrowRight size={16} />
      </button>
    </div>
  );
};
