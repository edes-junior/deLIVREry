/**
 * @file RegionalPricingWidget.tsx
 * @description Componente visual do Preço Médio Regional de Mercado (Story 3.4).
 * Apresenta a média praticada na região, piso e teto, seletor ergonômico de modalidade
 * e botão de autopreenchimento com linguagem 100% natural e acessível.
 */

import React, { useState, useEffect } from 'react';
import { PricingService } from '../../pricing/pricing-service.ts';
import { RegionalPricingMetrics } from '../../pricing/types.ts';
import { Card, Badge, Button, triggerHaptic } from '../ui/index.ts';

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
  title = 'Preço Médio na Sua Região'
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
        console.warn('Erro ao carregar preços médios regionais:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadMetrics();
  }, [stateId, cityId, neighborhoodId, selectedModal]);

  const handleApply = () => {
    if (!metrics || !onApplyRates) return;

    triggerHaptic([20, 40]);

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
    <Card
      style={{
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Faixa decorativa superior */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, var(--neon-emerald), var(--highvis-yellow))',
        }}
      />

      {/* Cabeçalho do Widget */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ fontSize: compact ? '14px' : '16px', fontWeight: 800, color: '#ffffff', margin: '0 0 3px 0' }}>
            {title}
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {neighborhoodId ? `${neighborhoodId.replace(/-/g, ' ')} • ${cityId}` : 'Valores praticados no bairro'}
          </span>
        </div>

        {/* Badge de Consolidação */}
        {metrics && (
          <Badge variant={metrics.isConsolidated ? 'emerald' : 'yellow'}>
            {metrics.isConsolidated ? '✓ Consolidado no Bairro' : 'Em Consolidação (Ref. Cidade)'}
          </Badge>
        )}
      </div>

      {/* Seletor de Modal com alvos touch >= 48px */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px', marginBottom: '16px' }}>
        {modals.map(m => {
          const isSelected = selectedModal === m.id;
          return (
            <Button
              key={m.id}
              variant="pill"
              size="sm"
              isActive={isSelected}
              onClick={() => setSelectedModal(m.id)}
              style={{ fontSize: '11px', padding: '6px 4px', minHeight: '48px' }}
            >
              {m.label}
            </Button>
          );
        })}
      </div>

      {/* Indicadores de Valores (Diária e Taxa) */}
      {isLoading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
          <span className="animate-spin" style={{ display: 'inline-block', marginRight: '6px' }}>⚡</span>
          Atualizando média do bairro...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px', marginBottom: '14px' }}>
          {/* Card Diária */}
          <div style={{ backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Diária Média
            </span>
            <div className="tabular-price" style={{ fontSize: '24px', color: 'var(--neon-emerald)', margin: '4px 0 6px 0' }}>
              R$ {(metrics?.medianDailyRate || 110).toFixed(2).replace('.', ',')}
            </div>
            <div style={{ display: 'flex', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span>Mín: R$ {(metrics?.minDailyRate || 90).toFixed(2).replace('.', ',')}</span>
              <span>•</span>
              <span>Máx: R$ {(metrics?.maxDailyRate || 140).toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          {/* Card Taxa por Entrega */}
          <div style={{ backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Taxa por Entrega
            </span>
            <div className="tabular-price" style={{ fontSize: '24px', color: 'var(--highvis-yellow)', margin: '4px 0 6px 0' }}>
              R$ {(metrics?.medianDeliveryFee || 7).toFixed(2).replace('.', ',')}
            </div>
            <div style={{ display: 'flex', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span>Mín: R$ {(metrics?.minDeliveryFee || 5).toFixed(2).replace('.', ',')}</span>
              <span>•</span>
              <span>Máx: R$ {(metrics?.maxDeliveryFee || 10).toFixed(2).replace('.', ',')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Info Proteção Anti-Manipulação com Contador de Outliers */}
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.35 }}>
        🛡️ Sem comissão de intermediação. {metrics?.outliersCount !== undefined && `${metrics.outliersCount} proposta(s) anômala(s) expurgada(s) pelo filtro 1.5xIQR.`} Valores fora da realidade são desconsiderados para manter o mercado saudável.
      </div>

      {/* Botão de Autopreenchimento com Sugerir Preço de Mercado */}
      {onApplyRates && (
        <Button
          type="button"
          variant="cta"
          size="md"
          fullWidth
          onClick={() => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([15, 30]);
            }
            handleApply();
          }}
          disabled={isLoading}
          style={{ minHeight: '48px' }}
        >
          {appliedFeedback ? '✓ Preço Médio Sugerido Aplicado!' : '💡 Sugerir Preço de Mercado'}
        </Button>
      )}
    </Card>
  );
};

export default RegionalPricingWidget;
