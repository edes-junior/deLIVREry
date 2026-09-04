/**
 * @file RegionalQuorumThermometer.tsx
 * @description Componente visual de Termômetro de Desbloqueio Regional e Quórum Hiperlocal (FR-13, AD-8).
 * Apresenta o progresso de ativação territorial (10 lojas / 50 entregadores) com status pre_launch vs unlocked.
 */

import React from 'react';
import { RegionQuorum } from '../../quorum/quorum-service.ts';

interface RegionalQuorumThermometerProps {
  quorum: RegionQuorum;
  neighborhoodName?: string;
  cityName?: string;
  stateId?: string;
  onShareClick?: () => void;
}

export const RegionalQuorumThermometer: React.FC<RegionalQuorumThermometerProps> = ({
  quorum,
  neighborhoodName,
  cityName,
  stateId,
  onShareClick
}) => {
  const isUnlocked = quorum.isUnlocked;
  const locationLabel = neighborhoodName || quorum.neighborhoodId || 'Sua Região';
  const cityStateLabel = cityName && stateId ? ` • ${cityName} - ${stateId}` : '';

  const missingStores = Math.max(0, quorum.requiredStores - quorum.storesCount);
  const missingCouriers = Math.max(0, quorum.requiredCouriers - quorum.couriersCount);

  return (
    <div
      style={{
        backgroundColor: '#131822',
        borderRadius: '16px',
        padding: '20px',
        border: isUnlocked ? '1px solid #059669' : '1px solid #334155',
        boxShadow: isUnlocked
          ? '0 0 20px rgba(16, 185, 129, 0.15)'
          : '0 4px 20px rgba(0, 0, 0, 0.3)',
        marginBottom: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      {/* Cabeçalho com Localização e Badge */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#38bdf8',
              letterSpacing: '0.5px'
            }}
          >
            TERMÔMETRO DE ATIVAÇÃO
          </span>
          <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
            📍 {locationLabel}
            <span style={{ fontSize: '13px', fontWeight: 400, color: '#94a3b8' }}>
              {cityStateLabel}
            </span>
          </h3>
        </div>

        <div>
          {isUnlocked ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid #10b981'
              }}
            >
              🟢 Região Desbloqueada & Ativa
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#fbbf24',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid #f59e0b'
              }}
            >
              ⏳ Pré-Lançamento (Quórum {quorum.overallPercentage}%)
            </span>
          )}
        </div>
      </div>

      {/* Barra de Progresso de Lojistas */}
      <div style={{ marginBottom: '14px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
            fontSize: '13px'
          }}
        >
          <span style={{ color: '#cbd5e1', fontWeight: 500 }}>
            🏪 Lojistas Cadastrados
          </span>
          <span style={{ color: '#38bdf8', fontWeight: 700 }}>
            {quorum.storesCount}/{quorum.requiredStores} lojas ({quorum.storePercentage}%)
          </span>
        </div>
        <div
          style={{
            width: '100%',
            height: '10px',
            backgroundColor: '#1e293b',
            borderRadius: '9999px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${quorum.storePercentage}%`,
              height: '100%',
              backgroundColor: quorum.storePercentage >= 100 ? '#10b981' : '#38bdf8',
              borderRadius: '9999px',
              transition: 'width 0.4s ease'
            }}
          />
        </div>
      </div>

      {/* Barra de Progresso de Entregadores */}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
            fontSize: '13px'
          }}
        >
          <span style={{ color: '#cbd5e1', fontWeight: 500 }}>
            🛵 Entregadores / Motoboys
          </span>
          <span style={{ color: '#f59e0b', fontWeight: 700 }}>
            {quorum.couriersCount}/{quorum.requiredCouriers} motoboys ({quorum.courierPercentage}%)
          </span>
        </div>
        <div
          style={{
            width: '100%',
            height: '10px',
            backgroundColor: '#1e293b',
            borderRadius: '9999px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${quorum.courierPercentage}%`,
              height: '100%',
              backgroundColor: quorum.courierPercentage >= 100 ? '#10b981' : '#f59e0b',
              borderRadius: '9999px',
              transition: 'width 0.4s ease'
            }}
          />
        </div>
      </div>

      {/* Mensagem de Incentivo & Call to Action */}
      {!isUnlocked ? (
        <div
          style={{
            backgroundColor: '#0f172a',
            padding: '12px 14px',
            borderRadius: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
            Faltam <strong>{missingStores} lojas</strong> e <strong>{missingCouriers} entregadores</strong> para liberar as entregas neste bairro!
          </div>

          {onShareClick && (
            <button
              onClick={onShareClick}
              style={{
                minHeight: '48px',
                padding: '0 16px',
                borderRadius: '8px',
                backgroundColor: '#0284c7',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📢 Convidar Bairro
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#6ee7b7'
          }}
        >
          🎉 Parabéns! O quórum mínimo foi atingido. Operações de matching e entregas liberadas na região!
        </div>
      )}
    </div>
  );
};
