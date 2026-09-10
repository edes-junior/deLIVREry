/**
 * @file RegionalPricingWidget.tsx
 * @description Componente visual do Preço Médio Regional de Mercado (Story 3.4).
 * Apresenta a média praticada na região, piso e teto, seletor ergonômico de modalidade
 * e botão de autopreenchimento com linguagem 100% natural e acessível.
 */

import React, { useState, useEffect } from 'react';
import { Bike, Zap, ShieldCheck, Sparkles, Check, Loader2 } from 'lucide-react';
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
    { id: 'all', label: 'Todos', icon: null },
    { id: 'motorcycle', label: 'Moto', icon: Bike },
    { id: 'bicycle', label: 'Bike', icon: Bike },
    { id: 'ebike_scooter', label: 'E-Bike', icon: Zap }
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
            {metrics.isConsolidated ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Check size={12} /> Consolidado no Bairro
              </span>
            ) : (
              'Em Consolidação (Ref. Cidade)'
            )}
          </Badge>
        )}
      </div>

      {/* Seletor de Modal com alvos touch >= 48px */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px', marginBottom: '16px' }}>
        {modals.map(m => {
          const isSelected = selectedModal === m.id;
          const IconComp = m.icon;
          return (
            <Button
              key={m.id}
              type="button"
              variant="pill"
              size="sm"
              isActive={isSelected}
              onClick={() => setSelectedModal(m.id)}
              style={{ fontSize: '11px', padding: '6px 4px', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              {IconComp && <IconComp size={13} />}
              <span>{m.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Indicadores de Valores (Diária e Taxa) */}
      {isLoading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Loader2 size={16} className="animate-spin" />
          <span>Atualizando média do bairro...</span>
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
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
        <ShieldCheck size={14} style={{ color: 'var(--neon-emerald)', flexShrink: 0, marginTop: '2px' }} />
        <span>
          Sem comissão de intermediação. {metrics?.outliersCount !== undefined && `${metrics.outliersCount} proposta(s) anômala(s) expurgada(s) pelo filtro 1.5xIQR.`} Valores fora da realidade são desconsiderados para manter o mercado saudável.
        </span>
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
          {appliedFeedback ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Check size={16} /> Preço Médio Sugerido Aplicado!
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} /> Sugerir Preço de Mercado
            </span>
          )}
        </Button>
      )}
    </Card>
  );
};

export default RegionalPricingWidget;
