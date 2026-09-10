// ==============================================================================
// Component: apps/pwa/src/components/jobs/JobPublishModal.tsx
// Description: Modal touch-friendly para lojistas publicarem vagas de turno.
// Features: Cálculo de antecedência >48h com badge de +50 XP, haptic feedback e validações.
// Story: 2.2 - Publicação de Vagas de Turno e Notificações Web Push (FCM)
// ==============================================================================

import React, { useState, useMemo, useEffect } from 'react';
import { Megaphone, X, Sparkles, Lightbulb, Bike, Zap } from 'lucide-react';
import type { TransportModal } from '../../profile/types.ts';
import { createJobPost } from '../../jobs/job-service.ts';
import { isEligibleForEarlyXpBonus } from '../../notifications/notification-service.ts';
import { RegionalPricingWidget } from '../pricing/RegionalPricingWidget.tsx';

interface JobPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeUserId: string;
  storeName: string;
  defaultStateId: string;
  defaultCityId: string;
  defaultNeighborhoodId: string;
  onSuccess: (job: any, earnedXp: boolean) => void;
}

export const JobPublishModal: React.FC<JobPublishModalProps> = ({
  isOpen,
  onClose,
  storeUserId,
  storeName,
  defaultStateId,
  defaultCityId,
  defaultNeighborhoodId,
  onSuccess
}) => {
  // Define horários sugeridos (amanhã 18h às 23h por padrão)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDateStr = tomorrow.toISOString().split('T')[0];

  const [startTime, setStartTime] = useState(`${defaultDateStr}T18:00`);
  const [endTime, setEndTime] = useState(`${defaultDateStr}T23:00`);
  const [dailyRate, setDailyRate] = useState('80.00');
  const [deliveryFee, setDeliveryFee] = useState('6.00');
  const [selectedModals, setSelectedModals] = useState<TransportModal[]>(['motorcycle', 'ebike_scooter']);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Restaura rascunho salvo anteriormente se existir
  useEffect(() => {
    if (!isOpen || !storeUserId || typeof window === 'undefined') return;
    try {
      const saved = sessionStorage.getItem(`delivrery_job_draft_${storeUserId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.startTime) setStartTime(parsed.startTime);
        if (parsed.endTime) setEndTime(parsed.endTime);
        if (parsed.dailyRate) setDailyRate(parsed.dailyRate);
        if (parsed.deliveryFee) setDeliveryFee(parsed.deliveryFee);
        if (parsed.selectedModals && Array.isArray(parsed.selectedModals) && parsed.selectedModals.length > 0) {
          setSelectedModals(parsed.selectedModals);
        }
        if (parsed.description) setDescription(parsed.description);
      }
    } catch {
      // Ignora erro de parsing
    }
  }, [isOpen, storeUserId]);

  // Salva rascunho a cada alteração enquanto o modal estiver aberto
  useEffect(() => {
    if (!isOpen || !storeUserId || typeof window === 'undefined') return;
    try {
      const draft = {
        startTime,
        endTime,
        dailyRate,
        deliveryFee,
        selectedModals,
        description
      };
      sessionStorage.setItem(`delivrery_job_draft_${storeUserId}`, JSON.stringify(draft));
    } catch {
      // Ignora erro de storage
    }
  }, [isOpen, startTime, endTime, dailyRate, deliveryFee, selectedModals, description, storeUserId]);

  // Verifica dinamicamente se qualifica para o bônus de antecedência de +50 XP (>48h)
  const qualifiesForEarlyBonus = useMemo(() => {
    if (!startTime) return false;
    return isEligibleForEarlyXpBonus(startTime);
  }, [startTime]);

  if (!isOpen) return null;

  const toggleModal = (modal: TransportModal) => {
    if (selectedModals.includes(modal)) {
      if (selectedModals.length > 1) {
        setSelectedModals(selectedModals.filter(m => m !== modal));
      }
    } else {
      setSelectedModals([...selectedModals, modal]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Haptic feedback ao submeter (NFR-9)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([10, 30, 10]);
    }

    const daily = parseFloat(dailyRate);
    const fee = parseFloat(deliveryFee);

    if (isNaN(daily) || daily < 0) {
      setErrorMessage('O valor da diária deve ser um número positivo.');
      return;
    }

    if (isNaN(fee) || fee < 0) {
      setErrorMessage('A taxa por entrega deve ser um número positivo.');
      return;
    }

    if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
      setErrorMessage('O horário de término deve ser posterior ao início do turno.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createJobPost(
        storeUserId,
        {
          shift_start_time: new Date(startTime).toISOString(),
          shift_end_time: new Date(endTime).toISOString(),
          offered_daily_rate: daily,
          offered_delivery_fee: fee,
          accepted_modals: selectedModals,
          state_id: defaultStateId,
          city_id: defaultCityId,
          neighborhood_id: defaultNeighborhoodId,
          description: description.trim() || undefined
        },
        undefined,
        storeName
      );

      if (!result.success) {
        setErrorMessage(result.error || 'Erro ao publicar vaga.');
      } else {
        try {
          sessionStorage.removeItem(`delivrery_job_draft_${storeUserId}`);
        } catch {}
        onSuccess(result.job, !!result.earnedXpBonus);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha inesperada de conexão.');
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
        backgroundColor: 'rgba(5, 8, 16, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 1000,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          color: '#f8fafc',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Megaphone size={20} style={{ color: 'var(--neon-emerald)' }} />
            <span>Publicar Vaga de Turno</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              minWidth: '48px',
              minHeight: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Badge Dinâmico de Antecedência (+50 XP) */}
        {qualifiesForEarlyBonus ? (
          <div
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid #f59e0b',
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <Sparkles size={24} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>
                Bônus de Antecipação Ativo (+50 XP)!
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                Você está agendando com mais de 48h de antecedência e acumulará 50 pontos ao publicar.
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: '#1e293b',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Lightbulb size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <span>
              <strong>Dica Pro:</strong> Agende turnos com mais de 48h de antecedência para acumular <strong>+50 XP</strong> no seu perfil de lojista.
            </span>
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '12px',
              borderRadius: '10px',
              fontSize: '13px',
              marginBottom: '16px'
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Horários */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                Início do Turno
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '14px',
                  minHeight: '48px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                Término do Turno
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '14px',
                  minHeight: '48px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Balizador Regional Inteligente de Preços */}
          <div style={{ marginBottom: '16px' }}>
            <RegionalPricingWidget
              stateId={defaultStateId}
              cityId={defaultCityId}
              neighborhoodId={defaultNeighborhoodId}
              compact={true}
              title="Balizador de Preços da sua Região"
              onApplyRates={(suggestedDaily, suggestedFee) => {
                setDailyRate(suggestedDaily.toFixed(2));
                setDeliveryFee(suggestedFee.toFixed(2));
              }}
            />
          </div>

          {/* Valores Ofertados */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                Diária Ofertada (R$)
              </label>
              <input
                type="number"
                step="0.50"
                min="0"
                value={dailyRate}
                onChange={e => setDailyRate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#10b981',
                  fontWeight: 700,
                  fontSize: '16px',
                  minHeight: '48px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                Taxa por Entrega (R$)
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={deliveryFee}
                onChange={e => setDeliveryFee(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#10b981',
                  fontWeight: 700,
                  fontSize: '16px',
                  minHeight: '48px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Modais Aceitos */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
              Modais de Transporte Aceitos
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'motorcycle', label: 'Moto', icon: Bike },
                { id: 'bicycle', label: 'Bicicleta', icon: Bike },
                { id: 'ebike_scooter', label: 'E-Bike / Patinete', icon: Zap }
              ].map(m => {
                const isSelected = selectedModals.includes(m.id as TransportModal);
                const IconComp = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleModal(m.id as TransportModal)}
                    style={{
                      flex: '1 1 120px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: `1px solid ${isSelected ? '#10b981' : '#334155'}`,
                      backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.15)' : '#1e293b',
                      color: isSelected ? '#10b981' : '#cbd5e1',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      minHeight: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <IconComp size={16} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Descrição */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
              Observações Operacionais (Opcional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Turno de alta demanda; necessário baú térmico grande..."
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box',
                resize: 'none'
              }}
            />
          </div>

          {/* Botões de Ação Touch-Friendly */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '14px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#94a3b8',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                minHeight: '48px'
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                flex: 2,
                padding: '14px',
                backgroundColor: isSubmitting ? '#059669' : '#10b981',
                border: 'none',
                color: '#0f172a',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '15px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                minHeight: '48px',
                boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)'
              }}
            >
              {isSubmitting ? 'Publicando...' : 'Confirmar e Publicar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
