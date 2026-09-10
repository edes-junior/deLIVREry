/**
 * @file RegionalQuorumThermometer.tsx
 * @description Componente visual de Meta de Cadastros no Bairro (FR-13, AD-8).
 * Apresenta o progresso de ativação territorial com linguagem natural, barras de progresso neon e convite viral.
 */
import React from 'react';
import { RegionQuorum } from '../../quorum/quorum-service.ts';
import { Card, Badge, Button } from '../ui/index.ts';
import { MapPin, Store, Bike, Megaphone, Trophy, Check } from 'lucide-react';

export interface RegionalQuorumThermometerProps {
  quorum: RegionQuorum;
  neighborhoodName?: string;
  cityName?: string;
  onShareClick?: () => void;
}

export const RegionalQuorumThermometer: React.FC<RegionalQuorumThermometerProps> = ({
  quorum,
  neighborhoodName,
  cityName,
  onShareClick
}) => {
  const isUnlocked = quorum.isUnlocked;
  const missingStores = Math.max(0, quorum.requiredStores - quorum.storesCount);
  const missingCouriers = Math.max(0, quorum.requiredCouriers - quorum.couriersCount);

  const locationLabel = neighborhoodName || quorum.neighborhoodId.replace(/-/g, ' ');
  const cityStateLabel = cityName ? ` • ${cityName} - ${quorum.stateId}` : ` - ${quorum.stateId}`;

  return (
    <Card
      style={{
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Indicador de progresso decorativo no topo */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: isUnlocked
            ? 'linear-gradient(90deg, var(--neon-emerald), var(--neon-emerald-glow))'
            : 'linear-gradient(90deg, #38bdf8, var(--highvis-yellow))'
        }}
      />

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: 'var(--neon-emerald)',
              letterSpacing: '0.05em'
            }}
          >
            Meta do Bairro
          </span>
          <h3 style={{ margin: '3px 0 0 0', fontSize: '17px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <MapPin size={16} style={{ color: 'var(--neon-emerald)' }} />
            <span>{locationLabel}</span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              {cityStateLabel}
            </span>
          </h3>
        </div>

        <div>
          {isUnlocked ? (
            <Badge variant="emerald" pulse>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Check size={12} /> Bairro 100% Ativo
              </span>
            </Badge>
          ) : (
            <Badge variant="yellow">
              Meta: {quorum.overallPercentage}% Concluída
            </Badge>
          )}
        </div>
      </div>

      {/* Barra de Progresso de Lojistas */}
      <div style={{ marginBottom: '12px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
            fontSize: '12px'
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Store size={14} />
            <span>Lojas Cadastradas</span>
          </span>
          <span className="tabular-price" style={{ color: '#38bdf8', fontSize: '13px' }}>
            {quorum.storesCount}/{quorum.requiredStores} ({quorum.storePercentage}%)
          </span>
        </div>
        <div
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#1e293b',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${Math.min(100, quorum.storePercentage)}%`,
              height: '100%',
              backgroundColor: quorum.storePercentage >= 100 ? 'var(--neon-emerald)' : '#38bdf8',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.4s ease',
              boxShadow: quorum.storePercentage >= 100 ? '0 0 8px var(--neon-emerald-glow)' : 'none'
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
            marginBottom: '4px',
            fontSize: '12px'
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Bike size={14} />
            <span>Entregadores Cadastrados</span>
          </span>
          <span className="tabular-price" style={{ color: 'var(--highvis-yellow)', fontSize: '13px' }}>
            {quorum.couriersCount}/{quorum.requiredCouriers} ({quorum.courierPercentage}%)
          </span>
        </div>
        <div
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#1e293b',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${Math.min(100, quorum.courierPercentage)}%`,
              height: '100%',
              backgroundColor: quorum.courierPercentage >= 100 ? 'var(--neon-emerald)' : 'var(--highvis-yellow)',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.4s ease',
              boxShadow: quorum.courierPercentage >= 100 ? '0 0 8px var(--neon-emerald-glow)' : 'none'
            }}
          />
        </div>
      </div>

      {/* Mensagem de Incentivo & Call to Action */}
      {!isUnlocked ? (
        <div
          style={{
            backgroundColor: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-subtle)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.35, flex: 1, minWidth: '180px' }}>
            Faltam apenas <strong>{missingStores} lojas</strong> e <strong>{missingCouriers} entregadores</strong> para liberar 100% dos turnos no bairro!
          </div>

          {onShareClick && (
            <Button
              variant="cta"
              size="sm"
              onClick={onShareClick}
              icon={<Megaphone size={14} />}
            >
              Convidar Amigos
            </Button>
          )}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'rgba(0, 245, 155, 0.1)',
            border: '1px solid rgba(0, 245, 155, 0.3)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            color: 'var(--neon-emerald)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Trophy size={16} />
          <span>Parabéns! Meta alcançada: entregas e turnos 100% livres no bairro!</span>
        </div>
      )}
    </Card>
  );
};

export default RegionalQuorumThermometer;
