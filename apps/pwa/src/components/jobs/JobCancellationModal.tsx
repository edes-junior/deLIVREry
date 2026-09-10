// ==============================================================================
// Component: apps/pwa/src/components/jobs/JobCancellationModal.tsx
// Description: Modal de cancelamento de turno pelo lojista com seleção de motivos,
//              auditoria de tolerância (1h / lances) e feedback de penalidade (-30 XP).
// ==============================================================================

import React, { useState, useMemo } from 'react';
import type { JobPost } from '../../jobs/types.ts';
import { CANCELLATION_REASONS } from '../../jobs/types.ts';
import { cancelJob } from '../../jobs/job-service.ts';
import {
  AlertTriangle,
  ShieldCheck,
  X,
  Clock,
  Users,
  AlertCircle,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

interface JobCancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobPost;
  storeUserId: string;
  bidsCount: number;
  onJobCancelled: (updatedJob: JobPost) => void;
}

export const JobCancellationModal: React.FC<JobCancellationModalProps> = ({
  isOpen,
  onClose,
  job,
  storeUserId,
  bidsCount,
  onJobCancelled
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReasonText, setCustomReasonText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cálculo da janela de tolerância
  const { elapsedMinutes, isWithinOneHour, isExempt } = useMemo(() => {
    const publishedAt = job.created_at ? new Date(job.created_at).getTime() : Date.now();
    const elapsedMs = Math.max(0, Date.now() - publishedAt);
    const minutes = Math.floor(elapsedMs / (1000 * 60));
    const withinOneHour = minutes <= 60;
    const exempt = withinOneHour || bidsCount === 0;

    return {
      elapsedMinutes: minutes,
      isWithinOneHour: withinOneHour,
      isExempt: exempt
    };
  }, [job.created_at, bidsCount]);

  if (!isOpen) return null;

  const triggerHaptic = (pattern: number | number[] = 15) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const finalReason = selectedReason === 'Outro motivo'
    ? (customReasonText.trim() ? `Outro: ${customReasonText.trim()}` : '')
    : selectedReason;

  const isValid = finalReason.trim().length > 0;

  const handleConfirmCancellation = async () => {
    if (!isValid) {
      setErrorMessage('Selecione ou descreva o motivo do cancelamento.');
      return;
    }

    triggerHaptic([30, 50]);
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await cancelJob(storeUserId, job.id, finalReason);
      if (!res.success || !res.job) {
        setErrorMessage(res.error || 'Não foi possível cancelar o turno.');
      } else {
        triggerHaptic([20, 30, 20]);
        onJobCancelled(res.job);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro inesperado na conexão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 15, 0.82)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-shift-title"
    >
      <div
        style={{
          backgroundColor: '#111726',
          border: '1px solid #1e293b',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444'
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2
                id="cancel-shift-title"
                style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}
              >
                Cancelar Turno
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Vaga #{job.id.slice(0, 8)} • Aberta
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Informações de Contexto Temporal & Interesse */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              backgroundColor: '#161e31',
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1px solid #243049'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, fontSize: '13px', color: '#cbd5e1' }}>
              <Clock size={16} style={{ color: '#38bdf8' }} />
              <span>Publicado há <strong>{elapsedMinutes} min</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, fontSize: '13px', color: '#cbd5e1' }}>
              <Users size={16} style={{ color: bidsCount > 0 ? '#fbbf24' : '#94a3b8' }} />
              <span>
                {bidsCount === 0 ? 'Nenhum lance' : `${bidsCount} ${bidsCount === 1 ? 'proposta' : 'propostas'}`}
              </span>
            </div>
          </div>

          {/* Banner de Impacto de Reputação (Isento vs Penalidade) */}
          {isExempt ? (
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}
            >
              <ShieldCheck size={22} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                <strong style={{ color: '#34d399', display: 'block', marginBottom: '2px', fontSize: '14px' }}>
                  Cancelamento Isento de Penalidade
                </strong>
                <span style={{ color: '#a7f3d0' }}>
                  {isWithinOneHour
                    ? 'Dentro da janela de tolerância de 1 hora da publicação. Sua pontuação de reputação (XP) permanecerá intacta.'
                    : 'Nenhum entregador demonstrou interesse nesta vaga. O cancelamento não gerará impacto de reputação (0 XP).'}
                </span>
              </div>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}
            >
              <AlertCircle size={22} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                <strong style={{ color: '#f87171', display: 'block', marginBottom: '2px', fontSize: '14px' }}>
                  Atenção: Penalidade de -30 XP
                </strong>
                <span style={{ color: '#fecaca' }}>
                  Já se passou mais de 1 hora da publicação e há entregadores que se candidataram. Para proteger o tempo dos entregadores, este cancelamento debitará <strong>30 XP</strong> da sua loja.
                </span>
              </div>
            </div>
          )}

          {/* Seleção do Motivo */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#e2e8f0',
                marginBottom: '8px'
              }}
            >
              Motivo do Cancelamento <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#94a3b8' }}>
              Ajude-nos a calibrar a demanda da plataforma informando o motivo real.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {CANCELLATION_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      setSelectedReason(reason);
                      setErrorMessage(null);
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : '#161e31',
                      border: isSelected ? '1px solid #38bdf8' : '1px solid #243049',
                      color: isSelected ? '#f0f9ff' : '#cbd5e1',
                      fontSize: '13px',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{reason}</span>
                    {isSelected ? (
                      <CheckCircle2 size={16} style={{ color: '#38bdf8' }} />
                    ) : (
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          border: '1px solid #475569'
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedReason === 'Outro motivo' && (
              <div style={{ marginTop: '10px' }}>
                <textarea
                  rows={2}
                  value={customReasonText}
                  onChange={(e) => setCustomReasonText(e.target.value)}
                  placeholder="Por favor, especifique o motivo..."
                  style={{
                    width: '100%',
                    backgroundColor: '#161e31',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}
          </div>

          {errorMessage && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '10px',
                padding: '10px 12px',
                color: '#fca5a5',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px 20px',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}
        >
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            style={{
              minHeight: '44px',
              padding: '0 16px',
              borderRadius: '10px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#cbd5e1',
              fontWeight: 600,
              fontSize: '14px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            Voltar
          </button>

          <button
            type="button"
            disabled={isSubmitting || !isValid}
            onClick={handleConfirmCancellation}
            style={{
              minHeight: '44px',
              padding: '0 20px',
              borderRadius: '10px',
              backgroundColor: isSubmitting || !isValid ? '#451a1a' : '#dc2626',
              border: 'none',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '14px',
              cursor: isSubmitting || !isValid ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isSubmitting || !isValid ? 0.6 : 1,
              transition: 'background-color 0.15s'
            }}
          >
            {isSubmitting ? (
              <span>Cancelando...</span>
            ) : (
              <>
                <AlertTriangle size={16} />
                <span>Confirmar Cancelamento</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
