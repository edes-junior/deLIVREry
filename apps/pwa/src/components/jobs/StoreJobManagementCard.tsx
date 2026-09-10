// ==============================================================================
// Component: apps/pwa/src/components/jobs/StoreJobManagementCard.tsx
// Description: Card gerencial do lojista para gerir vagas, visualizar propostas e efetivar matching com 1 clique.
// Story: 2.4 - Fechamento de Matching, Liberação de Contatos e Gestão de Reputação/XP
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import type { JobPost, JobBid, MatchedJobContact } from '../../jobs/types.ts';
import { listBidsForJob, acceptBid, getMatchedJobDetails, hasUserRatedJob } from '../../jobs/job-service.ts';
import { MatchedContactCard } from './MatchedContactCard.tsx';
import { JobCancellationModal } from './JobCancellationModal.tsx';
import { Avatar } from '../ui/Avatar.tsx';
import { MapPin, AlertTriangle, Inbox, RefreshCw, Bike, Car, Zap, Star, MessageSquare, Handshake, XCircle } from 'lucide-react';

interface StoreJobManagementCardProps {
  job: JobPost;
  storeUserId: string;
  hasRated?: boolean;
  onJobUpdated: (updatedJob: JobPost) => void;
  onOpenRatingModal: (contact: MatchedJobContact) => void;
}

export const StoreJobManagementCard: React.FC<StoreJobManagementCardProps> = ({
  job,
  storeUserId,
  hasRated,
  onJobUpdated,
  onOpenRatingModal
}) => {
  const [bids, setBids] = useState<JobBid[]>([]);
  const [isLoadingBids, setIsLoadingBids] = useState(false);
  const [isAcceptingBidId, setIsAcceptingBidId] = useState<string | null>(null);
  const [matchedContact, setMatchedContact] = useState<MatchedJobContact | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localHasRated, setLocalHasRated] = useState<boolean | null>(null);

  useEffect(() => {
    if (job.status === 'completed' && hasRated === undefined) {
      hasUserRatedJob(storeUserId, job.id).then(setLocalHasRated);
    }
  }, [job.status, job.id, storeUserId, hasRated]);

  const isShiftRated = hasRated !== undefined ? hasRated : (localHasRated ?? false);

  const fetchBids = useCallback(async () => {
    if (job.status !== 'open') return;
    setIsLoadingBids(true);
    try {
      const res = await listBidsForJob(storeUserId, job.id);
      if (res.success) {
        setBids(res.bids);
      }
    } catch {
      // Ignora erro
    } finally {
      setIsLoadingBids(false);
    }
  }, [storeUserId, job.id, job.status]);

  const fetchMatchedContact = useCallback(async () => {
    if (job.status !== 'matched' && job.status !== 'completed') return;
    try {
      const res = await getMatchedJobDetails(storeUserId, job.id);
      if (res.success && res.contact) {
        setMatchedContact(res.contact);
      }
    } catch {
      // Ignora erro
    }
  }, [storeUserId, job.id, job.status]);

  useEffect(() => {
    if (job.status === 'open') {
      fetchBids();
    } else if (job.status === 'matched' || job.status === 'completed') {
      fetchMatchedContact();
    }
  }, [job.status, fetchBids, fetchMatchedContact]);

  const handleAcceptBid = async (bid: JobBid) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([20, 50, 20]);
    }
    setIsAcceptingBidId(bid.id);
    setErrorMessage(null);

    try {
      const res = await acceptBid(storeUserId, job.id, bid.id, bid.courier_id);
      if (!res.success || !res.job) {
        setErrorMessage(res.error || 'Erro ao fechar matching.');
      } else {
        onJobUpdated(res.job);
        // Atualiza contatos imediatamente
        const contactRes = await getMatchedJobDetails(storeUserId, job.id);
        if (contactRes.success && contactRes.contact) {
          setMatchedContact(contactRes.contact);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha de conexão.');
    } finally {
      setIsAcceptingBidId(null);
    }
  };

  const isClosed = job.status === 'completed' || job.status === 'cancelled';

  return (
    <div
      style={{
        backgroundColor: '#131822',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        padding: '18px',
        marginBottom: '16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#f8fafc'
      }}
    >
      {/* Cabeçalho da Vaga */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor:
                  job.status === 'open'
                    ? '#0284c7'
                    : job.status === 'matched'
                    ? '#059669'
                    : job.status === 'completed'
                    ? '#d97706'
                    : '#475569',
                color: '#fff'
              }}
            >
              {job.status === 'open'
                ? 'Aberta para Propostas'
                : job.status === 'matched'
                ? 'Turno Casado'
                : job.status === 'completed'
                ? 'Concluída'
                : 'Cancelada'}
            </span>
            <span style={{ fontSize: '13px', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={13} /> {job.neighborhood_id}
            </span>
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '2px 0 0 0' }}>
            {job.title || `Turno Operacional (#${job.id.slice(0, 6)})`}
          </h3>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Ofertado</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#10b981' }}>
            R$ {Number(job.offered_daily_rate).toFixed(2)} + R$ {Number(job.offered_delivery_fee).toFixed(2)}/ent
          </div>
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            backgroundColor: '#450a0a',
            border: '1px solid #dc2626',
            borderRadius: '8px',
            padding: '8px 12px',
            marginBottom: '10px',
            color: '#fca5a5',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Caso a vaga esteja casada ou concluída, exibe os contatos liberados ou status de encerramento */}
      {(job.status === 'matched' || job.status === 'completed') && matchedContact && (
        <MatchedContactCard
          contact={matchedContact}
          currentUserId={storeUserId}
          isStore={true}
          jobStatus={job.status}
          hasRated={isShiftRated}
          onJobUpdated={onJobUpdated}
          onOpenRatingModal={onOpenRatingModal}
        />
      )}

      {/* Caso a vaga esteja aberta, exibe a lista de propostas recebidas */}
      {job.status === 'open' && (
        <div style={{ marginTop: '14px', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Inbox size={15} />
              <span>Propostas Recebidas ({bids.length})</span>
            </h4>
            <button
              type="button"
              onClick={fetchBids}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RefreshCw size={12} />
              <span>Atualizar</span>
            </button>
          </div>

          {isLoadingBids && (
            <div style={{ fontSize: '12px', color: '#94a3b8', padding: '8px 0' }}>
              Carregando propostas de entregadores...
            </div>
          )}

          {!isLoadingBids && bids.length === 0 && (
            <div
              style={{
                backgroundColor: '#0a0f1d',
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '12px'
              }}
            >
              Aguardando primeiras propostas de entregadores da região.
            </div>
          )}

          {!isLoadingBids && bids.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bids.map((bid) => {
                const isAccepting = isAcceptingBidId === bid.id;
                const isCounter =
                  bid.bid_daily_rate !== job.offered_daily_rate ||
                  bid.bid_delivery_fee !== job.offered_delivery_fee;

                return (
                  <div
                    key={bid.id}
                    style={{
                      backgroundColor: '#0a0f1d',
                      border: isCounter ? '1px solid #0284c7' : '1px solid #10b981',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '240px' }}>
                      <Avatar
                        src={bid.courier_avatar_url}
                        name={bid.courier_name || 'Entregador'}
                        userType="courier"
                        size="sm"
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                            {bid.courier_name || 'Entregador Parceiro'}
                          </span>
                          {bid.courier_modal && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#1e293b',
                                color: '#94a3b8'
                              }}
                            >
                              {bid.courier_modal === 'motorcycle' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Bike size={11} /> Moto</span>
                              ) : bid.courier_modal === 'bicycle' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Bike size={11} /> Bike</span>
                              ) : bid.courier_modal === 'e-bike' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Zap size={11} /> E-Bike</span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Car size={11} /> Carro</span>
                              )}
                            </span>
                          )}
                          {bid.courier_level && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(255, 230, 0, 0.1)',
                                color: '#ffe600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Star size={10} fill="currentColor" /> {bid.courier_level} ({bid.courier_xp ?? 0} XP)
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: isCounter ? '#0369a1' : '#065f46',
                              color: '#fff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            {isCounter ? (
                              <>
                                <MessageSquare size={10} />
                                <span>Contraproposta</span>
                              </>
                            ) : (
                              <>
                                <Zap size={10} />
                                <span>Valor Integral</span>
                              </>
                            )}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#10b981' }}>
                            Diária: R$ {Number(bid.bid_daily_rate).toFixed(2)} | Taxa: R$ {Number(bid.bid_delivery_fee).toFixed(2)}
                          </span>
                        </div>

                        {bid.notes && (
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                            "{bid.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botão de Aceite em 1 Clique (FR-6, NFR-9) */}
                    <button
                      type="button"
                      disabled={isAccepting}
                      onClick={() => handleAcceptBid(bid)}
                      style={{
                        minHeight: '48px',
                        padding: '0 16px',
                        borderRadius: '10px',
                        backgroundColor: isAccepting ? '#065f46' : '#10b981',
                        border: 'none',
                        color: '#0f172a',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: isAccepting ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      {isAccepting ? 'Fechando...' : (
                        <>
                          <Handshake size={15} />
                          <span>Aceitar</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Ação de Cancelamento de Vaga Aberta */}
          <div
            style={{
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid #1e293b',
              display: 'flex',
              justifyContent: 'flex-end'
            }}
          >
            <button
              type="button"
              onClick={() => setIsCancelModalOpen(true)}
              style={{
                minHeight: '38px',
                padding: '0 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
            >
              <XCircle size={14} />
              <span>Cancelar Turno</span>
            </button>
          </div>
        </div>
      )}

      {/* Detalhes de Turno Cancelado */}
      {job.status === 'cancelled' && (
        <div
          style={{
            marginTop: '12px',
            backgroundColor: '#181216',
            border: '1px solid #4a1d24',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '12px',
            color: '#fca5a5'
          }}
        >
          <strong style={{ color: '#f87171', display: 'block', marginBottom: '2px' }}>
            Turno Cancelado
          </strong>
          {job.cancellation_reason && (
            <span>Motivo: <em>{job.cancellation_reason}</em></span>
          )}
        </div>
      )}

      {/* Modal de Cancelamento com Validação de Tolerância e Motivo */}
      <JobCancellationModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        job={job}
        storeUserId={storeUserId}
        bidsCount={bids.length}
        onJobCancelled={(updatedJob) => {
          onJobUpdated(updatedJob);
        }}
      />
    </div>
  );
};
