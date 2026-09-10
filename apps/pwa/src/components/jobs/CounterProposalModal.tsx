// ==============================================================================
// Component: apps/pwa/src/components/jobs/CounterProposalModal.tsx
// Description: Modal touch-friendly para proposta de valor (Bid/Ask) de diária e taxa.
// Story: 2.3 - Listagem de Vagas Filtrada por Modal e Negociação Bid/Ask (Proposta/Contraproposta)
// ==============================================================================

import React, { useState } from 'react';
import type { JobPost, JobBid } from '../../jobs/types.ts';
import { submitBid } from '../../jobs/job-service.ts';
import { Button, Card, triggerHaptic } from '../ui/index.ts';
import { Handshake, X, AlertTriangle } from 'lucide-react';

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
    triggerHaptic(20);
    const current = parseFloat(bidDaily) || 0;
    const updated = Math.max(0, current + delta);
    setBidDaily(updated.toFixed(2));
  };

  const adjustFee = (delta: number) => {
    triggerHaptic(20);
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

    triggerHaptic([20, 40, 20]);

    setIsSubmitting(true);

    try {
      const result = await submitBid(courierUserId, {
        job_id: job.id,
        bid_daily_rate: daily,
        bid_delivery_fee: fee,
        notes: notes.trim() || undefined
      });

      if (!result.success || !result.bid) {
        setErrorMessage(result.error || 'Erro ao enviar proposta.');
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
        backgroundColor: 'rgba(5, 8, 16, 0.88)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 1000,
        fontFamily: 'var(--font-sans)'
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '24px 20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Handshake size={20} style={{ color: 'var(--neon-emerald)' }} />
            <span>Propor Outro Valor</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-subtle)', padding: '12px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Valor Ofertado pela Loja:</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--neon-emerald)', marginTop: '2px' }}>
            Diária: R$ {Number(job.offered_daily_rate).toFixed(2).replace('.', ',')} • Taxa: R$ {Number(job.offered_delivery_fee).toFixed(2).replace('.', ',')}/entrega
          </div>
        </div>

        {errorMessage && (
          <div
            style={{
              backgroundColor: 'var(--alert-warning-dim)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#fde68a',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Ajuste de Diária */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Sua Proposta de Diária (R$)
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => adjustDaily(-5)}
                style={{ minWidth: '48px', padding: '0 8px' }}
              >
                -5
              </Button>
              <input
                type="number"
                step="0.50"
                min="0"
                value={bidDaily}
                onChange={e => setBidDaily(e.target.value)}
                required
                className="tabular-price"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-surface-raised)',
                  border: '1.5px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--neon-emerald)',
                  fontSize: '18px',
                  textAlign: 'center',
                  minHeight: '48px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => adjustDaily(5)}
                style={{ minWidth: '48px', padding: '0 8px' }}
              >
                +5
              </Button>
            </div>
          </div>

          {/* Ajuste de Taxa por Entrega */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Sua Proposta de Taxa por Entrega (R$)
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => adjustFee(-0.50)}
                style={{ minWidth: '48px', padding: '0 8px' }}
              >
                -0.5
              </Button>
              <input
                type="number"
                step="0.25"
                min="0"
                value={bidFee}
                onChange={e => setBidFee(e.target.value)}
                required
                className="tabular-price"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-surface-raised)',
                  border: '1.5px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--highvis-yellow)',
                  fontSize: '18px',
                  textAlign: 'center',
                  minHeight: '48px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => adjustFee(0.50)}
                style={{ minWidth: '48px', padding: '0 8px' }}
              >
                +0.5
              </Button>
            </div>
          </div>

          {/* Notas */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Mensagem para o Lojista (Opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Chego em 20 min com bag grande..."
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                boxSizing: 'border-box',
                resize: 'none',
                fontFamily: 'var(--font-sans)',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)', gap: '8px' }}>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="cta"
              size="md"
              isLoading={isSubmitting}
            >
              Enviar Proposta
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CounterProposalModal;
