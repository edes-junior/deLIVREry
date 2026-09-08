// ==============================================================================
// Component: apps/pwa/src/components/jobs/JobFeed.tsx
// Description: Feed de vagas abertas filtradas por modal e alcance ergonômico para entregadores.
// Story: 2.3 - Listagem de Vagas Filtrada por Modal e Negociação Bid/Ask (Proposta/Contraproposta)
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import type { JobPost, JobBid, TransportModal } from '../../jobs/types.ts';
import { listOpenJobs } from '../../jobs/job-service.ts';
import { JobCard } from './JobCard.tsx';
import { CounterProposalModal } from './CounterProposalModal.tsx';

interface JobFeedProps {
  courierUserId: string;
  transportModal: TransportModal;
  stateId: string;
  cityId: string;
  neighborhoodId: string;
}

export const JobFeed: React.FC<JobFeedProps> = ({
  courierUserId,
  transportModal,
  stateId,
  cityId,
  neighborhoodId
}) => {
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [userBids, setUserBids] = useState<Record<string, JobBid>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterNeighborhood, setFilterNeighborhood] = useState(false);
  const [selectedJobForCounter, setSelectedJobForCounter] = useState<JobPost | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await listOpenJobs({
        state_id: stateId,
        city_id: cityId,
        neighborhood_id: filterNeighborhood ? neighborhoodId : undefined,
        modal: transportModal
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Erro ao carregar vagas abertas.');
        setJobs([]);
      } else {
        setJobs(res.jobs || []);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao carregar vagas abertas.');
    } finally {
      setIsLoading(false);
    }
  }, [stateId, cityId, neighborhoodId, transportModal, filterNeighborhood]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleRefresh = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
    fetchJobs();
  };

  const handleBidSuccess = (jobId: string, bid: JobBid) => {
    setUserBids((prev) => ({
      ...prev,
      [jobId]: bid
    }));
    showToast('🚀 Proposta enviada com sucesso ao estabelecimento!');
  };

  const modalLabel =
    transportModal === 'bicycle'
      ? '🚲 Bicicleta (Raio $\\le$ 3km)'
      : transportModal === 'motorcycle'
      ? '🏍️ Motocicleta'
      : '⚡ E-Bike';

  return (
    <div style={{ marginTop: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Barra de Filtros e Título do Feed */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
            📋 Vagas de Turnos Disponíveis
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Filtradas para o seu perfil: <strong style={{ color: '#38bdf8' }}>{modalLabel}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setFilterNeighborhood((prev) => !prev)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: filterNeighborhood ? '#0284c7' : '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {filterNeighborhood ? '📍 Meu Bairro' : '🌐 Toda a Região'}
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#38bdf8',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            🔄 Atualizar
          </button>
        </div>
      </div>

      {/* Alerta Ergonômico Informativo para Ciclistas (FR-5) */}
      {transportModal === 'bicycle' && (
        <div
          style={{
            backgroundColor: '#0c2238',
            border: '1px solid #0284c7',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#bae6fd',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>🛡️</span>
          <span>
            <strong>Filtro de Segurança Ativo:</strong> Exibindo apenas turnos com raio de entrega de até 3km para proteger sua ergonomia e prevenir exaustão física.
          </span>
        </div>
      )}

      {/* Mensagem de Erro */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: '#450a0a',
            border: '1px solid #dc2626',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            color: '#fca5a5',
            fontSize: '13px'
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
          <p style={{ margin: 0, fontSize: '14px' }}>Buscando oportunidades na sua região...</p>
        </div>
      )}

      {/* Lista Vazia */}
      {!isLoading && jobs.length === 0 && (
        <div
          style={{
            backgroundColor: '#131822',
            border: '1px dashed #334155',
            borderRadius: '16px',
            padding: '36px 20px',
            textAlign: 'center',
            color: '#94a3b8'
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>📦</div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 6px 0' }}>
            Nenhuma vaga aberta no momento
          </h3>
          <p style={{ margin: '0 0 14px 0', fontSize: '13px', maxWidth: '380px', marginInline: 'auto' }}>
            {filterNeighborhood
              ? 'Não há turnos abertos para o seu modal neste bairro. Experimente desmarcar o filtro de bairro para ver oportunidades em bairros vizinhos.'
              : 'Não há turnos abertos com o seu modal de transporte agora. Conforme novos lojistas publicarem, as vagas aparecerão aqui.'}
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              color: '#f8fafc',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Verificar Novamente
          </button>
        </div>
      )}

      {/* Lista de Cards de Vagas */}
      {!isLoading && jobs.length > 0 && (
        <div>
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              courierUserId={courierUserId}
              hasExistingBid={!!userBids[job.id]}
              existingBid={userBids[job.id]}
              onBidSubmitted={handleBidSuccess}
              onOpenCounterProposal={(targetJob) => setSelectedJobForCounter(targetJob)}
            />
          ))}
        </div>
      )}

      {/* Modal de Contraproposta */}
      <CounterProposalModal
        isOpen={!!selectedJobForCounter}
        job={selectedJobForCounter}
        courierUserId={courierUserId}
        onClose={() => setSelectedJobForCounter(null)}
        onSuccess={(bid) => {
          if (selectedJobForCounter) {
            handleBidSuccess(selectedJobForCounter.id, bid);
          }
        }}
      />

      {/* Toast de Feedback */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#10b981',
            color: '#0f172a',
            padding: '12px 24px',
            borderRadius: '999px',
            fontWeight: 700,
            fontSize: '14px',
            boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.5)',
            zIndex: 1100
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};
