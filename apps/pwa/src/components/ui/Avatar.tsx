/**
 * @file Avatar.tsx
 * @description Componente universal de avatar para exibição de fotos de perfil com fallback elegante (Story 2 / CAP-2).
 * Suporta iniciais, ícones por papel ('courier' / 'store') e múltiplos tamanhos com tratamento de erro de carregamento.
 */

import React, { useState } from 'react';
import { Bike, Store } from 'lucide-react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  src?: string | null;
  name?: string;
  userType?: 'courier' | 'store';
  size?: AvatarSize;
  style?: React.CSSProperties;
  className?: string;
  alt?: string;
  showBadge?: boolean;
}

const SIZE_MAP: Record<AvatarSize, { dimension: number; fontSize: number }> = {
  xs: { dimension: 28, fontSize: 11 },
  sm: { dimension: 36, fontSize: 13 },
  md: { dimension: 48, fontSize: 16 },
  lg: { dimension: 64, fontSize: 22 },
  xl: { dimension: 88, fontSize: 32 }
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = '',
  userType = 'courier',
  size = 'md',
  style,
  className = '',
  alt,
  showBadge = false
}) => {
  const [hasError, setHasError] = useState(false);
  const { dimension, fontSize } = SIZE_MAP[size];

  // Extrai iniciais (ex: "Carlos Andrade" -> "CA", "Maria" -> "M")
  const getInitials = (n: string): string => {
    const parts = n.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return '';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(name);
  const displayImage = Boolean(src && !hasError);

  return (
    <div
      className={`delivrery-avatar ${className}`}
      style={{
        position: 'relative',
        width: `${dimension}px`,
        height: `${dimension}px`,
        borderRadius: '50%',
        backgroundColor: displayImage ? 'transparent' : 'rgba(15, 23, 42, 0.8)',
        border: '2px solid var(--border-subtle, #334155)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        boxSizing: 'border-box',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        ...style
      }}
      data-testid="delivrery-avatar"
    >
      {displayImage ? (
        <img
          src={src!}
          alt={alt || name || 'Foto de perfil'}
          onError={() => setHasError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%'
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: userType === 'courier' ? 'rgba(0, 245, 155, 0.12)' : 'rgba(255, 230, 0, 0.12)',
            color: userType === 'courier' ? 'var(--neon-emerald, #00f59b)' : 'var(--highvis-yellow, #ffe600)',
            fontWeight: 800,
            fontSize: `${fontSize}px`,
            userSelect: 'none'
          }}
        >
          {initials || (userType === 'courier' ? <Bike size={Math.round(dimension * 0.48)} /> : <Store size={Math.round(dimension * 0.48)} />)}
        </div>
      )}

      {showBadge && (
        <span
          style={{
            position: 'absolute',
            bottom: '2px',
            right: '2px',
            width: `${Math.max(8, Math.round(dimension * 0.22))}px`,
            height: `${Math.max(8, Math.round(dimension * 0.22))}px`,
            borderRadius: '50%',
            backgroundColor: 'var(--neon-emerald, #00f59b)',
            border: '2px solid #06090e',
            boxShadow: '0 0 6px var(--neon-emerald, #00f59b)'
          }}
          data-testid="avatar-online-badge"
        />
      )}
    </div>
  );
};
