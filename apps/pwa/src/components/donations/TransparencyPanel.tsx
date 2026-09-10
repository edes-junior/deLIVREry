/**
 * @file TransparencyPanel.tsx
 * @description Painel público de vitalidade e sustentação da operação comunitária (Story 4.4 - FR-12).
 * Exibe o indicador de fôlego operacional em faixas qualitativas sem expor valores monetários em R$,
 * comemorando a autossuficiência e o esforço contínuo da equipe com o banner de Vitória Coletiva.
 */

import React, { useState, useEffect } from 'react';
import { DonationService } from '../../donations/donation-service.ts';
import type { TransparencyReport, DonationTriggerMoment } from '../../donations/types.ts';
import { ShieldCheck, Trophy, Users, ClipboardCheck, Heart, ChevronDown, ChevronRight } from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadReport() {
      try {
        setIsLoading(true);
        const data = await DonationService.getTransparencyReport();
        if (isMounted) {
          setReport(data);
        }
      } catch (err) {
        console.error('Falha ao carregar relatório de sustentabilidade:', err);
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
        // Ignora silenciosamente
      }
    }
    if (onOpenDonationModal) {
      onOpenDonationModal('spontaneous');
    }
  };

  if (isLoading && !report) {
    return (
      <div
        data-testid="transparency-panel-loading"
        style={{
          padding: '24px',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '13px',
          backgroundColor: '#0a0f1d',
          borderRadius: '16px',
          border: '1px solid #1e293b',
          ...style,
        }}
      >
        Carregando transparência de custos operacionais...
      </div>
    );
  }

  const percentage = report?.percentage || 0;
  const isGoalReached = report?.isGoalReached || false;
  const uniqueDonorsCount = report?.uniqueDonorsCount || 0;
  const totalIntents = report?.totalIntents || 0;
  const healthStatusLabel = report?.healthStatusLabel || 'Operação Básica';
  const healthDescription =
    report?.healthDescription ||
    'Infraestrutura e conectividade essenciais mantidas pelo compromisso da comunidade.';

  // Cores dinâmicas para a barra de fôlego operacional
  const progressColor = isGoalReached
    ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
    : percentage >= 50
    ? 'linear-gradient(90deg, #0ea5e9 0%, #10b981 100%)'
    : 'linear-gradient(90deg, #f59e0b 0%, #0ea5e9 100%)';

  const operationalPillars = [
    {
      id: 'core-infra',
      name: 'Banco de Dados & Autenticação Segura',
      description: 'Isolamento rigoroso de contatos, segurança de dados e login sem senha para entregadores e lojistas.',
    },
    {
      id: 'edge-network',
      name: 'Rede Edge & Disponibilidade em Alta Velocidade',
      description: 'Carregamento instantâneo do PWA em qualquer bairro do Brasil, mesmo em conexões 3G/4G oscilantes.',
    },
    {
      id: 'realtime-dispatch',
      name: 'Notificações Web Push & Despacho em Tempo Real',
      description: 'Comunicação instantânea de novas vagas, turnos de emergência e propostas sem intermediários.',
    },
    {
      id: 'team-evolution',
      name: 'Suporte Humanizado & Evolução Técnica Contínua',
      description: 'Esforço diário da equipe para aprimorar algoritmos justos, balizadores de preço e suporte à comunidade.',
    },
  ];

  return (
    <section
      data-testid="transparency-panel"
      aria-label="Painel de Transparência e Sustentação Comunitária"
      className={className}
      style={{
        backgroundColor: '#0a0f1d',
        borderRadius: '16px',
        border: '1px solid #1e293b',
        padding: '20px',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc',
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
            <ShieldCheck size={20} style={{ color: '#34d399' }} />
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 700,
                margin: 0,
                color: '#f8fafc',
                letterSpacing: '-0.01em',
              }}
            >
              Vitalidade e Sustentação da Operação
            </h3>
          </div>
          <p
            style={{
              fontSize: '12px',
              color: '#94a3b8',
              margin: '4px 0 0 0',
              lineHeight: 1.4,
            }}
          >
            O deLIVREry não cobra comissões nem vende seus dados. A operação, o suporte humanizado e o
            esforço da equipe são mantidos pelo compromisso de quem acredita na logística livre.
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

      {/* 2. Banner Comemorativo de Vitória Coletiva (Quando fôlego >= 100%) */}
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
            <Trophy size={22} style={{ color: '#0f172a' }} />
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
              Vitória Coletiva! Operação 100% Sustentada!
            </h4>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '12px',
                color: '#d1fae5',
                lineHeight: 1.4,
              }}
            >
              Graças ao apoio da comunidade, toda a infraestrutura, suporte dedicado e desenvolvimento
              deste mês estão plenamente assegurados. A logística livre segue forte e independente!
            </p>
          </div>
        </div>
      )}

      {/* 3. Barra de Fôlego Operacional (Objetivo Visual sem Cifras em R$) */}
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
            Fôlego Operacional da Comunidade:
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

        {/* Barra Visual */}
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

        {/* Indicadores de Objetivo Qualitativo */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '8px',
            fontSize: '12px',
          }}
        >
          <span
            data-testid="transparency-collected-amount"
            style={{
              color: isGoalReached ? '#34d399' : '#38bdf8',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ● Status: {healthStatusLabel}
          </span>
          <span data-testid="transparency-target-cost" style={{ color: '#94a3b8' }}>
            Meta: 100% Autonomia Operacional
          </span>
        </div>

        <p
          style={{
            fontSize: '12px',
            color: '#94a3b8',
            margin: '6px 0 0 0',
            lineHeight: 1.4,
          }}
        >
          {healthDescription}
        </p>
      </div>

      {/* 4. Métricas de Participação Comunitária */}
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
          <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Apoiadores Ativos</span>
          <span
            data-testid="transparency-donors-count"
            style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Users size={15} style={{ color: 'var(--neon-emerald)' }} />
            <span>{uniqueDonorsCount} {uniqueDonorsCount === 1 ? 'membro' : 'membros'}</span>
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
            style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ClipboardCheck size={15} style={{ color: 'var(--highvis-yellow)' }} />
            <span>{totalIntents} {totalIntents === 1 ? 'registro' : 'registros'}</span>
          </span>
        </div>
      </div>

      {/* 5. Pilares da Operação Mantida pela Comunidade */}
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
          {isBreakdownExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>{isBreakdownExpanded ? 'Ocultar pilares da operação' : 'Ver o que sua contribuição mantém'}</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            ({operationalPillars.length} pilares ativos)
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
              {operationalPillars.map((item) => (
                <div
                  key={item.id}
                  style={{
                    borderBottom: '1px solid #1e293b',
                    paddingBottom: '8px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', lineHeight: 1.3 }}>
                    {item.description}
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
              * Modelo Digital Commons: mantido por doação pura, sem intermediários financeiros, sem anúncios e sem rastreamento invasivo.
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
        <Heart size={16} fill="currentColor" />
        <span>Manter a Operação Livre com PIX</span>
      </button>
    </section>
  );
};
