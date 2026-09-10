// ==============================================================================
// Component: apps/pwa/src/components/jobs/JobCard.tsx
// Description: Card de vaga de turno no feed do entregador com aceite em 1 toque e contraproposta.
// Story: 2.3 - Listagem de Vagas Filtrada por Modal e Negociação Bid/Ask (Proposta/Contraproposta)
// ==============================================================================

import React, { useState } from 'react';
import type { JobPost, JobBid } from '../../jobs/types.ts';
import { submitBid } from '../../jobs/job-service.ts';
import { Card, Button, Badge, triggerHaptic } from '../ui/index.ts';
import { Calendar, Clock, MapPin, Target, Hourglass, Zap, Handshake } from 'lucide-react';

interface JobCardProps {
  job: JobPost;
  courierUserId: string;
  hasExistingBid?: boolean;
  existingBid?: JobBid | null;
  onBidSubmitted: (jobId: string, bid: JobBid) => void;
  onOpenCounterProposal: (job: JobPost) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  courierUserId,
  hasExistingBid = false,
  existingBid = null,
  onBidSubmitted,
  onOpenCounterProposal
}) => {
  const [isSubmittingDirect, setIsSubmittingDirect] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Formatação de data e hora
  const formatShiftDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  };

  // Aceite direto em 1 clique (FR-5, NFR-9)
  const handleDirectAccept = async () => {
    setErrorMessage(null);

    triggerHaptic([20, 40, 20]);

    setIsSubmittingDirect(true);

    try {
      const result = await submitBid(courierUserId, {
        job_id: job.id,
        bid_daily_rate: job.offered_daily_rate,
        bid_delivery_fee: job.offered_delivery_fee,
        notes: 'Aceite do valor integral anunciado.'
      });

      if (!result.success || !result.bid) {
        setErrorMessage(result.error || 'Não foi possível aceitar a vaga.');
      } else {
        onBidSubmitted(job.id, result.bid);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao comunicar com o servidor.');
    } finally {
      setIsSubmittingDirect(false);
    }
  };

  const isMatched = job.status === 'matched';
  const isCancelled = job.status === 'cancelled';
  const isClosed = isMatched || isCancelled;

  return (
    <Card
      variant={hasExistingBid ? 'matched' : isClosed ? 'flat' : 'default'}
      style={{ marginBottom: '14px', width: '100%', minWidth: 0 }}
    >
      {/* Cabeçalho do Card */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '8px',
          marginBottom: '12px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ flex: 1, minWidth: '180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <Badge variant={isClosed ? 'neutral' : 'emerald'}>
              {isMatched ? 'Encerrada' : isCancelled ? 'Cancelada' : 'Turno Aberto'}
            </Badge>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
              {formatShiftDate(job.shift_date)} • <Clock size={12} style={{ color: 'var(--text-muted)' }} /> {formatTime(job.start_time)} às {formatTime(job.end_time)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>
              {job.title}
            </h3>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={12} style={{ color: 'var(--neon-emerald)' }} />
            <span>Região: <strong style={{ color: 'var(--neon-emerald)' }}>{job.neighborhood_id}</strong> ({job.city_id})</span>
          </p>
        </div>

        {/* Badge de Raio de Entrega */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 10px',
            textAlign: 'center',
            flexShrink: 0
          }}
        >
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Raio Máx.</div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
            <Target size={12} />
            <span>{job.delivery_radius_km ?? 3.0} km</span>
          </div>
        </div>
      </div>

      {/* Valores Oferecidos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: '8px',
          backgroundColor: 'var(--bg-surface-raised)',
          padding: '12px 14px',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
          marginBottom: '12px'
        }}
      >
        <div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Diária Ofertada
          </span>
          <div className="tabular-price" style={{ fontSize: '18px', color: 'var(--neon-emerald)' }}>
            R$ {Number(job.offered_daily_rate).toFixed(2).replace('.', ',')}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Taxa por Entrega
          </span>
          <div className="tabular-price" style={{ fontSize: '18px', color: 'var(--highvis-yellow)' }}>
            R$ {Number(job.offered_delivery_fee).toFixed(2).replace('.', ',')}
          </div>
        </div>
      </div>

      {/* Modais Permitidos & Descrição */}
      <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Modais aceitos:</span>
          {job.accepted_modals.map((m) => (
            <Badge key={m} variant="modal">
              {m === 'motorcycle' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Bike size={12} /> Moto</span>
              ) : m === 'bicycle' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Bike size={12} /> Bike</span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Zap size={12} /> E-Bike</span>
              )}
            </Badge>
          ))}
        </div>
        {job.description && (
          <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.4' }}>
            {job.description}
          </p>
        )}
      </div>

      {/* Mensagem de Erro se houver */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: 'var(--alert-warning-dim)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            marginBottom: '10px',
            fontSize: '12px',
            color: '#fde68a',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Estado: Proposta já enviada */}
      {hasExistingBid ? (
        <div
          style={{
            backgroundColor: 'rgba(0, 245, 155, 0.1)',
            border: '1px solid rgba(0, 245, 155, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--neon-emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={14} />
              <span>Proposta Enviada ({existingBid?.status === 'accepted' ? 'Aceita pelo Lojista!' : 'Aguardando Lojista'})</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-primary)', marginTop: '2px' }}>
              Diária: R$ {Number(existingBid?.bid_daily_rate || job.offered_daily_rate).toFixed(2).replace('.', ',')} |
              Taxa: R$ {Number(existingBid?.bid_delivery_fee || job.offered_delivery_fee).toFixed(2).replace('.', ',')}
            </div>
          </div>
          <Hourglass size={18} style={{ color: 'var(--neon-emerald)' }} />
        </div>
      ) : isClosed ? (
        <div
          style={{
            backgroundColor: 'var(--bg-surface-raised)',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: 700
          }}
        >
          {isMatched ? 'Este turno já foi preenchido.' : 'Este turno foi cancelado pelo lojista.'}
        </div>
      ) : (
        /* Botões de Ação com Dimensões Touch-Friendly (>= 48px) */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: '8px'
          }}
        >
          <Button
            type="button"
            variant="cta"
            disabled={isSubmittingDirect}
            onClick={handleDirectAccept}
            isLoading={isSubmittingDirect}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Zap size={14} />
            <span>Aceitar Valor</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenCounterProposal(job)}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Handshake size={14} />
            <span>Negociar Valor</span>
          </Button>
        </div>
      )}
    </Card>
  );
};

export default JobCard;
