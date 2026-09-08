// ==============================================================================
// Component: apps/pwa/src/components/jobs/StoreJobManagementCard.tsx
// Description: Card gerencial do lojista para gerir vagas, visualizar propostas e efetivar matching com 1 clique.
// Story: 2.4 - Fechamento de Matching, Liberação de Contatos e Gestão de Reputação/XP
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import type { JobPost, JobBid, MatchedJobContact } from '../../jobs/types.ts';
import { listBidsForJob, acceptBid, getMatchedJobDetails } from '../../jobs/job-service.ts';
import { MatchedContactCard } from './MatchedContactCard.tsx';

interface StoreJobManagementCardProps {
  job: JobPost;
  storeUserId: string;
  onJobUpdated: (updatedJob: JobPost) => void;
  onOpenRatingModal: (contact: MatchedJobContact) => void;
}

export const StoreJobManagementCard: React.FC<StoreJobManagementCardProps> = ({
  job,
  storeUserId,
  onJobUpdated,
  onOpenRatingModal
}) => {
  const [bids, setBids] = useState<JobBid[]>([]);
  const [isLoadingBids, setIsLoadingBids] = useState(false);
  const [isAcceptingBidId, setIsAcceptingBidId] = useState<string | null>(null);
  const [matchedContact, setMatchedContact] = useState<MatchedJobContact | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              📍 {job.neighborhood_id}
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
            fontSize: '12px'
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Caso a vaga esteja casada ou concluída, exibe os contatos liberados */}
      {(job.status === 'matched' || job.status === 'completed') && matchedContact && (
        <MatchedContactCard
          contact={matchedContact}
          currentUserId={storeUserId}
          isStore={true}
          onJobUpdated={onJobUpdated}
          onOpenRatingModal={onOpenRatingModal}
        />
      )}

      {/* Caso a vaga esteja aberta, exibe a lista de propostas recebidas */}
      {job.status === 'open' && (
        <div style={{ marginTop: '14px', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: '#38bdf8' }}>
              📥 Propostas Recebidas ({bids.length})
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
                padding: '4px'
              }}
            >
              🔄 Atualizar
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
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: isCounter ? '#0369a1' : '#065f46',
                            color: '#fff'
                          }}
                        >
                          {isCounter ? '💬 Contraproposta' : '⚡ Valor Integral'}
                        </span>
                        {((bid as any).is_supporter || (bid as any).community_supporter) && (
                          <span
                            data-testid="badge-bid-supporter"
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: '#064e3b',
                              color: '#34d399',
                              border: '1px solid #059669',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <span>💚</span>
                            <span>Apoiador</span>
                          </span>
                        )}
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                          Diária: R$ {Number(bid.bid_daily_rate).toFixed(2)} | Taxa: R$ {Number(bid.bid_delivery_fee).toFixed(2)}
                        </span>
                      </div>
                      {bid.notes && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                          "{bid.notes}"
                        </p>
                      )}
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
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      {isAccepting ? 'Fechando...' : '🤝 Aceitar'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
