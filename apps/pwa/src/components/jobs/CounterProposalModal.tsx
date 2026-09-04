// ==============================================================================
// Component: apps/pwa/src/components/jobs/CounterProposalModal.tsx
// Description: Modal touch-friendly para contraproposta (Bid/Ask) de diária e taxa.
// Story: 2.3 - Listagem de Vagas Filtrada por Modal e Negociação Bid/Ask (Proposta/Contraproposta)
// ==============================================================================

import React, { useState } from 'react';
import type { JobPost, JobBid } from '../../jobs/types.ts';
import { submitBid } from '../../jobs/job-service.ts';

interface CounterProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobPost | null;
  courierUserId: string;
  onSuccess: (bid: JobBid) => void;
}

export const CounterProposalModal: React.FC<CounterProposalModalProps> = ({
  isOpen,
  onClose,
  job,
  courierUserId,
  onSuccess
}) => {
  if (!isOpen || !job) return null;

  const [bidDaily, setBidDaily] = useState(job.offered_daily_rate.toString());
  const [bidFee, setBidFee] = useState(job.offered_delivery_fee.toString());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const adjustDaily = (delta: number) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    const current = parseFloat(bidDaily) || 0;
    const updated = Math.max(0, current + delta);
    setBidDaily(updated.toFixed(2));
  };

  const adjustFee = (delta: number) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    const current = parseFloat(bidFee) || 0;
    const updated = Math.max(0, current + delta);
    setBidFee(updated.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const daily = parseFloat(bidDaily);
    const fee = parseFloat(bidFee);

    if (isNaN(daily) || daily < 0) {
      setErrorMessage('O valor da diária deve ser um número positivo.');
      return;
    }

    if (isNaN(fee) || fee < 0) {
      setErrorMessage('A taxa por entrega deve ser um número positivo.');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([15, 30, 15]);
    }

    setIsSubmitting(true);

    try {
      const result = await submitBid(courierUserId, {
        job_id: job.id,
        bid_daily_rate: daily,
        bid_delivery_fee: fee,
        notes: notes.trim() || undefined
      });

      if (!result.success || !result.bid) {
        setErrorMessage(result.error || 'Erro ao submeter contraproposta.');
      } else {
        onSuccess(result.bid);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha de conexão.');
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
          maxWidth: '480px',
          padding: '24px',
          color: '#f8fafc',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
            💬 Enviar Contraproposta
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

        <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Valores Ofertados pelo Lojista:</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
            Diária: R$ {Number(job.offered_daily_rate).toFixed(2)} • Taxa: R$ {Number(job.offered_delivery_fee).toFixed(2)}/entrega
          </div>
        </div>

        {errorMessage && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '12px',
              borderRadius: '10px',
              fontSize: '13px',
              marginBottom: '16px'
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Ajuste de Diária */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>
              Sua Proposta de Diária (R$)
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => adjustDaily(-5)}
                style={{
                  minWidth: '48px',
                  minHeight: '48px',
                  borderRadius: '10px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  fontSize: '18px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                -5
              </button>
              <input
                type="number"
                step="0.50"
                min="0"
                value={bidDaily}
                onChange={e => setBidDaily(e.target.value)}
                required
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#38bdf8',
                  fontWeight: 700,
                  fontSize: '18px',
                  textAlign: 'center',
                  minHeight: '48px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => adjustDaily(5)}
                style={{
                  minWidth: '48px',
                  minHeight: '48px',
                  borderRadius: '10px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  fontSize: '18px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                +5
              </button>
            </div>
          </div>

          {/* Ajuste de Taxa por Entrega */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>
              Sua Proposta de Taxa por Entrega (R$)
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => adjustFee(-0.50)}
                style={{
                  minWidth: '48px',
                  minHeight: '48px',
                  borderRadius: '10px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                -0.5
              </button>
              <input
                type="number"
                step="0.25"
                min="0"
                value={bidFee}
                onChange={e => setBidFee(e.target.value)}
                required
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#38bdf8',
                  fontWeight: 700,
                  fontSize: '18px',
                  textAlign: 'center',
                  minHeight: '48px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => adjustFee(0.50)}
                style={{
                  minWidth: '48px',
                  minHeight: '48px',
                  borderRadius: '10px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                +0.5
              </button>
            </div>
          </div>

          {/* Notas */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
              Observação para o Lojista (Opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Disponibilidade para hora extra se necessário..."
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '13px',
                boxSizing: 'border-box',
                resize: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '14px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#94a3b8',
                borderRadius: '12px',
                fontWeight: 600,
                minHeight: '48px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                flex: 2,
                padding: '14px',
                backgroundColor: isSubmitting ? '#0284c7' : '#38bdf8',
                border: 'none',
                color: '#0f172a',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '15px',
                minHeight: '48px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar Contraproposta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
