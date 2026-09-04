// ==============================================================================
// Component: apps/pwa/src/components/jobs/JobCard.tsx
// Description: Card de vaga de turno no feed do entregador com aceite em 1 toque e contraproposta.
// Story: 2.3 - Listagem de Vagas Filtrada por Modal e Negociação Bid/Ask (Proposta/Contraproposta)
// ==============================================================================

import React, { useState } from 'react';
import type { JobPost, JobBid } from '../../jobs/types.ts';
import { submitBid } from '../../jobs/job-service.ts';

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

    // Haptic feedback tátil em dispositivos móveis
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([20, 40, 20]);
    }

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
    <div
      style={{
        backgroundColor: '#131822',
        border: hasExistingBid ? '1px solid #059669' : '1px solid #1e293b',
        borderRadius: '16px',
        padding: '18px',
        marginBottom: '16px',
        boxShadow: hasExistingBid
          ? '0 4px 16px rgba(16, 185, 129, 0.15)'
          : '0 4px 12px rgba(0, 0, 0, 0.25)',
        transition: 'all 0.2s ease',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#f8fafc'
      }}
    >
      {/* Cabeçalho do Card */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '12px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: isClosed ? '#475569' : '#0369a1',
                color: '#fff'
              }}
            >
              {isMatched ? 'Encerrada' : isCancelled ? 'Cancelada' : 'Turno Aberto'}
            </span>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              📅 {formatShiftDate(job.shift_date)} • ⏰ {formatTime(job.start_time)} às {formatTime(job.end_time)}
            </span>
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '2px 0 0 0', color: '#f1f5f9' }}>
            {job.title}
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#cbd5e1' }}>
            📍 Região: <strong style={{ color: '#38bdf8' }}>{job.neighborhood_id}</strong> ({job.city_id})
          </p>
        </div>

        {/* Badge de Raio de Entrega */}
        <div
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '10px',
            padding: '6px 10px',
            textAlign: 'center',
            minWidth: '70px'
          }}
        >
          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Raio Máx.</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8' }}>
            🎯 {job.delivery_radius_km ?? 3.0} km
          </div>
        </div>
      </div>

      {/* Valores Oferecidos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          backgroundColor: '#0a0f1d',
          padding: '12px',
          borderRadius: '12px',
          marginBottom: '14px',
          border: '1px solid #1e293b'
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Diária Oferecida</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981' }}>
            R$ {Number(job.offered_daily_rate).toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Taxa por Entrega</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981' }}>
            R$ {Number(job.offered_delivery_fee).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Modais Permitidos & Descrição */}
      <div style={{ marginBottom: '14px', fontSize: '12px', color: '#94a3b8' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Modais aceitos:</span>
          {job.accepted_modals.map((m) => (
            <span
              key={m}
              style={{
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600
              }}
            >
              {m === 'motorcycle' ? '🏍️ Moto' : m === 'bicycle' ? '🚲 Bicicleta' : '⚡ E-Bike'}
            </span>
          ))}
        </div>
        {job.description && (
          <p style={{ margin: '8px 0 0 0', color: '#cbd5e1', fontSize: '13px', lineHeight: '1.4' }}>
            {job.description}
          </p>
        )}
      </div>

      {/* Mensagem de Erro se houver */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: '#450a0a',
            border: '1px solid #dc2626',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '12px',
            fontSize: '13px',
            color: '#fca5a5'
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Estado: Proposta já enviada */}
      {hasExistingBid ? (
        <div
          style={{
            backgroundColor: '#064e3b',
            border: '1px solid #059669',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#34d399' }}>
              ✓ Proposta Registrada ({existingBid?.status === 'accepted' ? 'Aceita' : 'Pendente'})
            </div>
            <div style={{ fontSize: '12px', color: '#a7f3d0' }}>
              Diária: R$ {Number(existingBid?.bid_daily_rate || job.offered_daily_rate).toFixed(2)} |
              Taxa: R$ {Number(existingBid?.bid_delivery_fee || job.offered_delivery_fee).toFixed(2)}
            </div>
          </div>
          <span style={{ fontSize: '20px' }}>⏳</span>
        </div>
      ) : isClosed ? (
        <div
          style={{
            backgroundColor: '#1e293b',
            padding: '12px',
            borderRadius: '10px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          {isMatched ? 'Esta vaga já foi preenchida.' : 'Esta vaga foi cancelada pelo lojista.'}
        </div>
      ) : (
        /* Botões de Ação com Dimensões Touch-Friendly (>= 48px) */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px'
          }}
        >
          {/* Botão de Aceite Direto em 1 Toque */}
          <button
            type="button"
            disabled={isSubmittingDirect}
            onClick={handleDirectAccept}
            style={{
              minHeight: '48px',
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: isSubmittingDirect ? '#065f46' : '#10b981',
              border: 'none',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: '14px',
              cursor: isSubmittingDirect ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              transition: 'background-color 0.2s'
            }}
          >
            {isSubmittingDirect ? 'Enviando...' : '⚡ Aceitar Valor'}
          </button>

          {/* Botão para Contraproposta */}
          <button
            type="button"
            onClick={() => onOpenCounterProposal(job)}
            style={{
              minHeight: '48px',
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              color: '#f8fafc',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'background-color 0.2s'
            }}
          >
            💬 Contrapropor
          </button>
        </div>
      )}
    </div>
  );
};
