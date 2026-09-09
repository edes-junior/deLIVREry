/**
 * @file Badge.tsx
 * @description Selos, pílulas e tags de status do deLIVREry Design System.
 */

import React from 'react';

export type BadgeVariant = 'modal' | 'emerald' | 'yellow' | 'warning' | 'location' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  pulse = false,
  style,
  className = '',
  ...rest
}) => {
  const getStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '11px',
      fontWeight: 800,
      padding: '4px 8px',
      borderRadius: 'var(--radius-sm)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      lineHeight: 1.2,
      fontFamily: 'var(--font-sans)',
      boxSizing: 'border-box',
    };

    switch (variant) {
      case 'modal':
        return {
          ...base,
          backgroundColor: '#172338',
          border: '1px solid #233857',
          color: '#38bdf8',
          fontSize: '10px',
        };
      case 'emerald':
        return {
          ...base,
          backgroundColor: 'rgba(0, 245, 155, 0.1)',
          border: '1px solid rgba(0, 245, 155, 0.3)',
          color: 'var(--neon-emerald)',
        };
      case 'yellow':
        return {
          ...base,
          backgroundColor: 'var(--highvis-yellow-dim)',
          border: '1px solid rgba(255, 230, 0, 0.3)',
          color: 'var(--highvis-yellow)',
        };
      case 'warning':
        return {
          ...base,
          backgroundColor: 'var(--alert-warning-dim)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          color: '#fde68a',
          textTransform: 'none',
        };
      case 'location':
        return {
          ...base,
          backgroundColor: 'var(--bg-surface-raised)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
          borderRadius: 'var(--radius-full)',
          padding: '6px 12px',
          fontSize: '12px',
          textTransform: 'none',
        };
      case 'neutral':
      default:
        return {
          ...base,
          backgroundColor: 'var(--bg-surface-raised)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
        };
    }
  };

  return (
    <span
      style={{ ...getStyles(), ...style }}
      className={`delivrery-badge ${className}`}
      {...rest}
    >
      {pulse && (
        <span
          className="animate-pulse"
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: 'var(--neon-emerald)',
            boxShadow: '0 0 8px var(--neon-emerald)',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
};
