// ==============================================================================
// Component: apps/pwa/src/components/jobs/StoreJobsList.tsx
// Description: Painel de gestão de vagas e matchings para o perfil Lojista.
// Story: 2.4 - Fechamento de Matching, Liberação de Contatos e Gestão de Reputação/XP
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import type { JobPost, MatchedJobContact, JobRating } from '../../jobs/types.ts';
import { listStoreJobs, getRatedJobIdsForUser } from '../../jobs/job-service.ts';
import { StoreJobManagementCard } from './StoreJobManagementCard.tsx';
import { JobRatingModal } from './JobRatingModal.tsx';
import { DonationBottomSheet } from '../donations/DonationBottomSheet.tsx';
import { ClipboardList, RefreshCw } from 'lucide-react';

interface StoreJobsListProps {
  storeUserId: string;
  refreshTrigger?: number;
}

export const StoreJobsList: React.FC<StoreJobsListProps> = ({
  storeUserId,
  refreshTrigger = 0
}) => {
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContactForRating, setSelectedContactForRating] = useState<MatchedJobContact | null>(null);
  const [isDonationOpen, setIsDonationOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [ratedJobIds, setRatedJobIds] = useState<Set<string>>(new Set());

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listStoreJobs(storeUserId);
      if (res.success) {
        setJobs(res.jobs);
        const jobIds = (res.jobs || []).map((j) => j.id);
        const ratedSet = await getRatedJobIdsForUser(storeUserId, jobIds);
        setRatedJobIds(ratedSet);
      }
    } catch {
      // Ignora para não travar
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

  const handleRatingSuccess = (rating: JobRating, earnedXp?: number) => {
    if (rating?.job_id) {
      setRatedJobIds((prev) => new Set([...prev, rating.job_id]));
    }
    if (rating.rating === 5) {
      setIsDonationOpen(true);
    } else {
      setToastMessage(
        earnedXp
          ? `Avaliação enviada com sucesso! +${earnedXp} XP creditados.`
          : 'Avaliação enviada com sucesso!'
      );
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '13px' }}>
        Carregando suas vagas e turnos...
      </div>
    );
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardList size={18} style={{ color: 'var(--neon-emerald)' }} />
          <span>Minhas Vagas e Turnos ({jobs.length})</span>
        </h3>
        <button
          type="button"
          onClick={fetchJobs}
          style={{
            padding: '6px 12px',
            backgroundColor: '#1e293b',
            color: '#94a3b8',
            border: '1px solid #334155',
            borderRadius: '8px',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RefreshCw size={13} />
          <span>Atualizar</span>
        </button>
      </div>

      {jobs.map((job) => (
        <StoreJobManagementCard
          key={job.id}
          job={job}
          storeUserId={storeUserId}
          hasRated={ratedJobIds.has(job.id)}
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

      <DonationBottomSheet
        isOpen={isDonationOpen}
        onClose={() => setIsDonationOpen(false)}
        triggerMoment="rating_5_stars"
        currentUserId={storeUserId}
        onDonated={({ amount }) => {
          setToastMessage(`Muito obrigado pela contribuição de R$ ${amount.toFixed(2)} à comunidade!`);
          setTimeout(() => setToastMessage(null), 4000);
        }}
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
