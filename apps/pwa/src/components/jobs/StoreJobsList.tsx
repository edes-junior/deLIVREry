// ==============================================================================
// Component: apps/pwa/src/components/jobs/StoreJobsList.tsx
// Description: Painel de gestão de vagas e matchings para o perfil Lojista.
// Story: 2.4 - Fechamento de Matching, Liberação de Contatos e Gestão de Reputação/XP
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import type { JobPost, MatchedJobContact, JobRating } from '../../jobs/types.ts';
import { listStoreJobs } from '../../jobs/job-service.ts';
import { StoreJobManagementCard } from './StoreJobManagementCard.tsx';
import { JobRatingModal } from './JobRatingModal.tsx';

interface StoreJobsListProps {
  storeUserId: string;
  refreshTrigger?: number;
}

export const StoreJobsList: React.FC<StoreJobsListProps> = ({
  storeUserId,
  refreshTrigger
}) => {
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContactForRating, setSelectedContactForRating] = useState<MatchedJobContact | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listStoreJobs(storeUserId);
      if (res.success) {
        setJobs(res.jobs);
      }
    } catch {
      // Ignora erro
    } finally {
      setIsLoading(false);
    }
  }, [storeUserId]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs, refreshTrigger]);

  const handleJobUpdated = (updatedJob: JobPost) => {
    setJobs((prev) => prev.map((j) => (j.id === updatedJob.id ? updatedJob : j)));
  };

  const handleRatingSuccess = (_rating: JobRating) => {
    setToastMessage('⭐ Avaliação registrada! Obrigado por fortalecer a confiança da comunidade.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (isLoading) {
    return (
      <div style={{ marginTop: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
        ⏳ Carregando seus turnos publicados...
      </div>
    );
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
          📋 Minhas Vagas e Turnos ({jobs.length})
        </h3>
        <button
          type="button"
          onClick={fetchJobs}
          style={{
            background: 'none',
            border: 'none',
            color: '#38bdf8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          🔄 Atualizar
        </button>
      </div>

      {jobs.map((job) => (
        <StoreJobManagementCard
          key={job.id}
          job={job}
          storeUserId={storeUserId}
          onJobUpdated={handleJobUpdated}
          onOpenRatingModal={(contact) => setSelectedContactForRating(contact)}
        />
      ))}

      <JobRatingModal
        isOpen={!!selectedContactForRating}
        onClose={() => setSelectedContactForRating(null)}
        contact={selectedContactForRating}
        currentUserId={storeUserId}
        isStore={true}
        onSuccess={handleRatingSuccess}
      />

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
