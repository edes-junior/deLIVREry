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
import { Button, Card, triggerHaptic } from '../ui/index.ts';

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
    triggerHaptic(20);
    fetchJobs();
  };

  const handleBidSuccess = (jobId: string, bid: JobBid) => {
    setUserBids((prev) => ({
      ...prev,
      [jobId]: bid
    }));
    showToast('🚀 Proposta enviada com sucesso para o restaurante!');
  };

  const modalLabel =
    transportModal === 'bicycle'
      ? '🚲 Bicicleta (Até 3km)'
      : transportModal === 'motorcycle'
      ? '🏍️ Moto'
      : '⚡ E-Bike';

  return (
    <div style={{ marginTop: '16px', width: '100%', minWidth: 0 }}>
      {/* Barra de Filtros e Título do Feed */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#ffffff' }}>
            Turnos com Vagas Abertas
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Filtradas para o seu modal: <strong style={{ color: 'var(--neon-emerald)' }}>{modalLabel}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <Button
            size="sm"
            variant={filterNeighborhood ? 'cta' : 'secondary'}
            onClick={() => setFilterNeighborhood((prev) => !prev)}
            style={{ fontSize: '11px', padding: '6px 10px', minHeight: '40px' }}
          >
            {filterNeighborhood ? '📍 Meu Bairro' : '🌐 Toda a Região'}
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleRefresh}
            style={{ fontSize: '11px', padding: '6px 10px', minHeight: '40px' }}
          >
            🔄 Atualizar
          </Button>
        </div>
      </div>

      {/* Alerta Ergonômico Informativo para Ciclistas (FR-5) */}
      {transportModal === 'bicycle' && (
        <div
          style={{
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: '14px',
            fontSize: '12px',
            color: '#bae6fd',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>🛡️</span>
          <span>
            <strong>Segurança Ativa:</strong> Exibindo apenas turnos com raio de até 3km para proteger sua ergonomia física.
          </span>
        </div>
      )}

      {/* Mensagem de Erro */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: 'var(--alert-warning-dim)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: '14px',
            color: '#fde68a',
            fontSize: '13px'
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
          <div className="animate-spin" style={{ fontSize: '24px', marginBottom: '8px', display: 'inline-block' }}>⚡</div>
          <div style={{ fontSize: '13px' }}>Buscando turnos no seu bairro...</div>
        </div>
      )}

      {/* Lista de Vagas */}
      {!isLoading && jobs.length === 0 && (
        <Card style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛵</div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>
            Nenhum turno aberto no momento
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
            {filterNeighborhood
              ? 'Não há vagas no seu bairro agora. Tente alternar para "Toda a Região" acima.'
              : 'Nenhum estabelecimento publicou turnos nesta região hoje. Volte em instantes!'}
          </p>
        </Card>
      )}

      {!isLoading &&
        jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            courierUserId={courierUserId}
            hasExistingBid={Boolean(userBids[job.id])}
            existingBid={userBids[job.id] || null}
            onBidSubmitted={handleBidSuccess}
            onOpenCounterProposal={(j) => setSelectedJobForCounter(j)}
          />
        ))}

      {/* Modal de Contraproposta (Bid/Ask) */}
      {selectedJobForCounter && (
        <CounterProposalModal
          job={selectedJobForCounter}
          courierUserId={courierUserId}
          onClose={() => setSelectedJobForCounter(null)}
          onSuccess={(bid) => {
            handleBidSuccess(selectedJobForCounter.id, bid);
            setSelectedJobForCounter(null);
          }}
        />
      )}

      {/* Toast Flutuante de Confirmação */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '74px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--neon-emerald)',
            color: '#032314',
            padding: '10px 18px',
            borderRadius: 'var(--radius-full)',
            fontWeight: 800,
            fontSize: '13px',
            boxShadow: '0 8px 24px var(--neon-emerald-glow)',
            zIndex: 1100,
            textAlign: 'center',
            maxWidth: '90%',
            wordBreak: 'break-word'
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default JobFeed;
