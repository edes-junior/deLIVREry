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
import { MapPin, Globe, RefreshCw, Radar, ShieldCheck, AlertCircle, Bike, Zap } from 'lucide-react';

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
  const [filterNeighborhood, setFilterNeighborhood] = useState(true); // Padrão: Meu Bairro cadastrado (CAP-6)
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
        modal: transportModal,
        courier_user_id: courierUserId // Exclui oportunidades conflitantes com a agenda aceita (CAP-5)
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
  }, [stateId, cityId, neighborhoodId, transportModal, filterNeighborhood, courierUserId]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleRefresh = () => {
    triggerHaptic(25);
    fetchJobs();
  };

  const handleBidSuccess = (jobId: string, bid: JobBid) => {
    setUserBids((prev) => ({
      ...prev,
      [jobId]: bid
    }));
    showToast('Proposta enviada com sucesso para o restaurante!');
  };

  const modalLabel =
    transportModal === 'bicycle'
      ? 'Bicicleta (Até 3km)'
      : transportModal === 'motorcycle'
      ? 'Moto'
      : 'E-Bike';

  return (
    <div style={{ marginTop: '4px', width: '100%', minWidth: 0 }}>
      {/* Barra de Filtros e Título do Feed (320px-proof) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
          gap: '8px',
          width: '100%'
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Turnos com Vagas Abertas
          </h2>
          <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Filtradas para o seu modal:{' '}
            <strong style={{ color: 'var(--neon-emerald)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <Bike size={12} />
              {modalLabel}
            </strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setFilterNeighborhood((prev) => !prev)}
            style={{
              minHeight: '32px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: filterNeighborhood ? 'rgba(0, 245, 155, 0.15)' : 'var(--bg-surface-raised)',
              border: filterNeighborhood ? '1px solid var(--neon-emerald)' : '1px solid var(--border-subtle)',
              color: filterNeighborhood ? 'var(--neon-emerald)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s ease'
            }}
          >
            {filterNeighborhood ? <MapPin size={12} /> : <Globe size={12} />}
            <span>{filterNeighborhood ? 'Meu Bairro' : 'Região'}</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            style={{
              minHeight: '32px',
              width: '32px',
              padding: 0,
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            title="Atualizar lista de vagas"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </button>
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
          <ShieldCheck size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
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
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertCircle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
          <div className="animate-spin" style={{ marginBottom: '8px', display: 'inline-block' }}>
            <Zap size={24} style={{ color: 'var(--neon-emerald)' }} />
          </div>
          <div style={{ fontSize: '13px' }}>Buscando turnos no seu bairro...</div>
        </div>
      )}

      {/* Lista de Vagas - Radar Tático (320px-proof) */}
      {!isLoading && jobs.length === 0 && (
        <Card
          variant="raised"
          style={{
            textAlign: 'center',
            padding: '24px 14px',
            border: '1px dashed var(--border-subtle)',
            backgroundColor: 'rgba(13, 18, 28, 0.6)'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 245, 155, 0.1)',
              border: '1px solid rgba(0, 245, 155, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 10px auto'
            }}
          >
            <Radar size={22} style={{ color: 'var(--neon-emerald)' }} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
            Nenhum turno aberto no momento
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: 1.4 }}>
            {filterNeighborhood
              ? 'Seu radar está ligado no seu bairro. Toque abaixo para ver vagas em toda a região.'
              : 'Nenhum estabelecimento publicou turnos nesta região hoje. Seu radar segue escutando!'}
          </p>

          {filterNeighborhood && (
            <button
              type="button"
              onClick={() => setFilterNeighborhood(false)}
              style={{
                minHeight: '36px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(0, 245, 155, 0.12)',
                border: '1px solid var(--neon-emerald)',
                color: 'var(--neon-emerald)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Globe size={13} />
              <span>Ver Vagas em Toda a Região</span>
            </button>
          )}
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
