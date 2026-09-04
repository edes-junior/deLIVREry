/**
 * @file RegionalPricingWidget.tsx
 * @description Componente visual do Balizador Inteligente de Preços Regionais (Story 3.4).
 * Apresenta medianas (P_med), pisos (P_min) e tetos (P_max) com corte 1.5xIQR,
 * seletor de modal com alvos de toque >= 48px e botão de autopreenchimento em 1 toque.
 */

import React, { useState, useEffect } from 'react';
import { PricingService } from '../../pricing/pricing-service.ts';
import { RegionalPricingMetrics } from '../../pricing/types.ts';

export interface RegionalPricingWidgetProps {
  stateId?: string;
  cityId?: string;
  neighborhoodId?: string;
  initialModal?: string;
  onApplyRates?: (dailyRate: number, deliveryFee: number) => void;
  compact?: boolean;
  title?: string;
}

export const RegionalPricingWidget: React.FC<RegionalPricingWidgetProps> = ({
  stateId = 'RJ',
  cityId = '',
  neighborhoodId = '',
  initialModal = 'all',
  onApplyRates,
  compact = false,
  title = '📊 Balizador de Preços do Bairro'
}) => {
  const [selectedModal, setSelectedModal] = useState<string>(initialModal);
  const [metrics, setMetrics] = useState<RegionalPricingMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [appliedFeedback, setAppliedFeedback] = useState<boolean>(false);

  useEffect(() => {
    async function loadMetrics() {
      if (!cityId || !neighborhoodId) {
        setMetrics(null);
        return;
      }

      setIsLoading(true);
      try {
        const data = await PricingService.getRegionalPricing({
          stateId,
          cityId,
          neighborhoodId,
          transportModal: selectedModal
        });
        setMetrics(data);
      } catch (err) {
        console.warn('Erro ao carregar balizador regional:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadMetrics();
  }, [stateId, cityId, neighborhoodId, selectedModal]);

  const handleApply = () => {
    if (!metrics || !onApplyRates) return;

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([15, 30]);
    }

    const suggested = PricingService.calculateSuggestedPricing(metrics);

    onApplyRates(suggested.suggestedDailyRate, suggested.suggestedDeliveryFee);
    setAppliedFeedback(true);
    setTimeout(() => setAppliedFeedback(false), 2500);
  };

  const modals = [
    { id: 'all', label: 'Todos' },
    { id: 'motorcycle', label: '🏍️ Moto' },
    { id: 'bicycle', label: '🚲 Bike' },
    { id: 'ebike_scooter', label: '⚡ E-Bike' }
  ];

  return (
    <div
      style={{
        backgroundColor: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '16px',
        padding: compact ? '16px' : '20px',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Cabeçalho do Widget */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ fontSize: compact ? '14px' : '16px', fontWeight: 700, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {title}
          </h3>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            {neighborhoodId ? `${neighborhoodId.replace(/-/g, ' ')} • ${cityId}` : 'Região de atuação'}
          </span>
        </div>

        {/* Badge de Consolidação */}
        {metrics && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: metrics.isConsolidated ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: metrics.isConsolidated ? '#34d399' : '#fbbf24',
              border: `1px solid ${metrics.isConsolidated ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
            }}
          >
            {metrics.isConsolidated ? '🟢 Consolidado no Bairro' : '🟡 Em Consolidação (Ref. Cidade)'}
          </span>
        )}
      </div>

      {/* Seletor de Modal com alvos touch >= 48px */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {modals.map(m => {
          const isSelected = selectedModal === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedModal(m.id)}
              style={{
                flex: 1,
                minHeight: '48px',
                padding: '8px 12px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: isSelected ? 700 : 500,
                backgroundColor: isSelected ? '#2563eb' : '#1e293b',
                color: isSelected ? '#ffffff' : '#94a3b8',
                border: isSelected ? '1px solid #38bdf8' : '1px solid #334155',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Indicadores de Valores (Diária e Taxa) */}
      {isLoading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          ⏳ Calculando mediana e expurgando outliers...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          {/* Card Diária */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '14px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Diária de Mercado
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', margin: '4px 0 8px 0' }}>
              R$ {(metrics?.medianDailyRate || 110).toFixed(2)}
            </div>
            <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
              <span style={{ backgroundColor: '#0f172a', padding: '2px 6px', borderRadius: '6px' }}>
                Mín: R$ {(metrics?.minDailyRate || 90).toFixed(2)}
              </span>
              <span style={{ backgroundColor: '#0f172a', padding: '2px 6px', borderRadius: '6px' }}>
                Máx: R$ {(metrics?.maxDailyRate || 140).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Card Taxa por Entrega */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '14px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Taxa por Entrega
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8', margin: '4px 0 8px 0' }}>
              R$ {(metrics?.medianDeliveryFee || 7).toFixed(2)}
            </div>
            <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
              <span style={{ backgroundColor: '#0f172a', padding: '2px 6px', borderRadius: '6px' }}>
                Mín: R$ {(metrics?.minDeliveryFee || 5).toFixed(2)}
              </span>
              <span style={{ backgroundColor: '#0f172a', padding: '2px 6px', borderRadius: '6px' }}>
                Máx: R$ {(metrics?.maxDeliveryFee || 10).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Info Proteção Anti-Manipulação */}
      {metrics && metrics.outliersExpunged > 0 && (
        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          🛡️ {metrics.outliersExpunged} proposta(s) anômala(s) expurgada(s) pelo filtro 1.5xIQR nos últimos 14 dias
        </div>
      )}

      {/* Botão de Autopreenchimento */}
      {onApplyRates && (
        <button
          type="button"
          onClick={handleApply}
          disabled={isLoading}
          style={{
            width: '100%',
            minHeight: '48px',
            backgroundColor: appliedFeedback ? '#059669' : '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background-color 0.2s ease',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
          }}
        >
          {appliedFeedback ? '✓ Preços Sugeridos Aplicados!' : '💡 Sugerir Preço de Mercado (Autopreencher)'}
        </button>
      )}
    </div>
  );
};
