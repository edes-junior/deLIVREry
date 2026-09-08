/**
 * @file TransparencyPanel.tsx
 * @description Painel público de transparência dos custos reais de servidor vs. arrecadação comunitária (Story 4.4 - FR-12).
 * Exibe o termômetro mensal com barra de progresso, breakdown detalhado de custos e o banner comemorativo de Vitória Coletiva
 * quando a arrecadação voluntária cobre 100% da meta de infraestrutura.
 */

import React, { useState, useEffect } from 'react';
import { DonationService } from '../../donations/donation-service.ts';
import type { TransparencyReport, DonationTriggerMoment } from '../../donations/types.ts';

export interface TransparencyPanelProps {
  onOpenDonationModal?: (triggerMoment: DonationTriggerMoment) => void;
  refreshTrigger?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const TransparencyPanel: React.FC<TransparencyPanelProps> = ({
  onOpenDonationModal,
  refreshTrigger = 0,
  className,
  style,
}) => {
  const [report, setReport] = useState<TransparencyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadReport() {
      setIsLoading(true);
      try {
        const data = await DonationService.getTransparencyReport();
        if (isMounted) {
          setReport(data);
        }
      } catch {
        // Fallback silencioso para manter UX resiliente
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadReport();
    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  const handleSupportClick = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([15, 50, 15]);
      } catch {
        // Fallback silencioso
      }
    }
    onOpenDonationModal?.('manual_donation');
  };

  if (isLoading && !report) {
    return (
      <div
        data-testid="transparency-panel-loading"
        style={{
          backgroundColor: '#131822',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid #1e293b',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '14px',
          ...style,
        }}
      >
        Carregando painel de sustentabilidade comunitária...
      </div>
    );
  }

  const percentage = report?.percentage || 0;
  const isGoalReached = report?.isGoalReached || false;
  const totalEstimatedAmount = report?.totalEstimatedAmount || 0;
  const totalMonthlyTarget = report?.totalMonthlyTarget || 150;
  const remainingAmount = report?.remainingAmount || 0;
  const uniqueDonorsCount = report?.uniqueDonorsCount || 0;
  const totalIntents = report?.totalIntents || 0;
  const breakdownItems = report?.costBreakdown.items || [];

  // Cores dinâmicas para a barra de termômetro
  const progressColor = isGoalReached
    ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
    : percentage >= 50
    ? 'linear-gradient(90deg, #0ea5e9 0%, #10b981 100%)'
    : 'linear-gradient(90deg, #f59e0b 0%, #0ea5e9 100%)';

  return (
    <section
      data-testid="transparency-panel"
      aria-label="Painel Público de Transparência e Custos de Servidor"
      className={className}
      style={{
        backgroundColor: '#131822',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid #1e293b',
        color: '#f8fafc',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
        marginTop: '20px',
        ...style,
      }}
    >
      {/* 1. Header do Painel */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }} role="img" aria-label="Sustentabilidade">
              🌱
            </span>
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 700,
                margin: 0,
                color: '#f8fafc',
                letterSpacing: '-0.01em',
              }}
            >
              Transparência de Custos do Servidor
            </h3>
          </div>
          <p
            style={{
              fontSize: '12px',
              color: '#94a3b8',
              margin: '4px 0 0 0',
            }}
          >
            A plataforma opera com taxa 0% e sustentabilidade por microdoações PIX voluntárias.
          </p>
        </div>

        <span
          data-testid="badge-zero-tax"
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            backgroundColor: '#064e3b',
            color: '#34d399',
            padding: '4px 8px',
            borderRadius: '6px',
            border: '1px solid #059669',
          }}
        >
          0% Comissão sobre Entregas
        </span>
      </div>

      {/* 2. Banner Comemorativo de Vitória Coletiva (Quando meta >= 100%) */}
      {isGoalReached && (
        <div
          data-testid="collective-victory-banner"
          style={{
            backgroundColor: '#064e3b',
            background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.95) 0%, rgba(16, 185, 129, 0.25) 100%)',
            border: '1px solid #10b981',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 8px 20px -4px rgba(16, 185, 129, 0.3)',
          }}
        >
          <div
            style={{
              fontSize: '28px',
              lineHeight: 1,
              backgroundColor: '#10b981',
              color: '#0f172a',
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            🏆
          </div>
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: 800,
                color: '#6ee7b7',
              }}
            >
              🎉 Vitória Coletiva! Meta Mensal Atingida!
            </h4>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '12px',
                color: '#d1fae5',
                lineHeight: 1.4,
              }}
            >
              Graças aos microapoiadores, 100% dos servidores deste mês já estão pagos! Nossa infraestrutura
              descentralizada segue livre e perene para todos.
            </p>
          </div>
        </div>
      )}

      {/* 3. Termômetro / Barra de Progresso */}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 600 }}>
            Arrecadação Comunitária do Mês:
          </span>
          <span
            data-testid="transparency-percentage"
            style={{
              fontSize: '16px',
              fontWeight: 800,
              color: isGoalReached ? '#10b981' : '#38bdf8',
            }}
          >
            {percentage.toFixed(1)}%
          </span>
        </div>

        {/* Barra Termômetro */}
        <div
          style={{
            width: '100%',
            height: '14px',
            backgroundColor: '#0f172a',
            borderRadius: '999px',
            overflow: 'hidden',
            border: '1px solid #334155',
            position: 'relative',
          }}
        >
          <div
            data-testid="transparency-progress-bar"
            style={{
              width: `${Math.min(percentage, 100)}%`,
              height: '100%',
              background: progressColor,
              borderRadius: '999px',
              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>

        {/* Valores Arrecadado vs Meta */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '8px',
            fontSize: '12px',
          }}
        >
          <span data-testid="transparency-collected-amount" style={{ color: '#f8fafc', fontWeight: 700 }}>
            R$ {totalEstimatedAmount.toFixed(2).replace('.', ',')} arrecadados
          </span>
          <span data-testid="transparency-target-cost" style={{ color: '#94a3b8' }}>
            Meta: R$ {totalMonthlyTarget.toFixed(2).replace('.', ',')} / mês
          </span>
        </div>

        {!isGoalReached && remainingAmount > 0 && (
          <p
            style={{
              fontSize: '12px',
              color: '#38bdf8',
              margin: '6px 0 0 0',
              fontWeight: 500,
            }}
          >
            Faltam apenas <strong>R$ {remainingAmount.toFixed(2).replace('.', ',')}</strong> para garantir 100% dos servidores deste mês.
          </p>
        )}
      </div>

      {/* 4. Métricas Rápidas de Apoio */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            backgroundColor: '#0b111e',
            padding: '10px 12px',
            borderRadius: '10px',
            border: '1px solid #1e293b',
          }}
        >
          <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Apoiadores Únicos</span>
          <span
            data-testid="transparency-donors-count"
            style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}
          >
            👥 {uniqueDonorsCount} {uniqueDonorsCount === 1 ? 'membro' : 'membros'}
          </span>
        </div>

        <div
          style={{
            backgroundColor: '#0b111e',
            padding: '10px 12px',
            borderRadius: '10px',
            border: '1px solid #1e293b',
          }}
        >
          <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Apoios via PIX</span>
          <span
            data-testid="transparency-intents-count"
            style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}
          >
            📋 {totalIntents} {totalIntents === 1 ? 'registro' : 'registros'}
          </span>
        </div>
      </div>

      {/* 5. Detalhamento Expansível de Custos Operacionais (NFR-8 / Transparência Radical) */}
      <div style={{ marginBottom: '16px' }}>
        <button
          type="button"
          data-testid="btn-toggle-cost-breakdown"
          onClick={() => setIsBreakdownExpanded((prev) => !prev)}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 0',
            minHeight: '48px', // NFR-9 Touch Target
            color: '#38bdf8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            width: '100%',
            textAlign: 'left',
          }}
        >
          <span>{isBreakdownExpanded ? '▼ Ocultar custos reais' : '▶ Ver custos reais de infraestrutura'}</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            ({breakdownItems.length} itens transparentes)
          </span>
        </button>

        {isBreakdownExpanded && (
          <div
            data-testid="transparency-cost-breakdown"
            style={{
              backgroundColor: '#0b111e',
              borderRadius: '10px',
              padding: '12px',
              border: '1px solid #1e293b',
              marginTop: '4px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {breakdownItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    borderBottom: '1px solid #1e293b',
                    paddingBottom: '8px',
                  }}
                >
                  <div style={{ paddingRight: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      {item.description}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#38bdf8',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    R$ {item.monthlyCostBrl.toFixed(2).replace('.', ',')}
                  </div>
                </div>
              ))}
            </div>

            <p
              style={{
                fontSize: '11px',
                color: '#64748b',
                margin: '10px 0 0 0',
                fontStyle: 'italic',
              }}
            >
              * Utilizamos infraestrutura serverless frugal (Postgres Supabase, Web Push FCM e Edge CDN). Sem taxas ocultas.
            </p>
          </div>
        )}
      </div>

      {/* 6. Botão de Apoio Touch-Friendly (NFR-9 >= 48px) */}
      <button
        type="button"
        data-testid="btn-support-server"
        onClick={handleSupportClick}
        style={{
          width: '100%',
          minHeight: '48px', // NFR-9 Touch Target
          padding: '12px 20px',
          borderRadius: '12px',
          backgroundColor: '#10b981',
          color: '#0f172a',
          fontWeight: 800,
          fontSize: '14px',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.35)',
          transition: 'transform 0.15s ease, background-color 0.2s ease',
        }}
      >
        <span role="img" aria-label="Coração verde">
          💚
        </span>
        <span>Apoiar Manutenção do Servidor com PIX</span>
      </button>
    </section>
  );
};
