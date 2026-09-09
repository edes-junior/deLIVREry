/**
 * @file Card.tsx
 * @description Componente de Card com suporte a camadas tonais, bordas iluminadas e variantes de estado.
 */

import React from 'react';

export type CardVariant = 'default' | 'highlight' | 'matched' | 'raised' | 'flat';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  style,
  className = '',
  ...rest
}) => {
  const getPadding = () => {
    switch (padding) {
      case 'none': return '0';
      case 'sm': return '10px 12px';
      case 'lg': return '20px 24px';
      case 'md':
      default: return '16px';
    }
  };

  const getVariantStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      borderRadius: 'var(--radius-lg)',
      padding: getPadding(),
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
      transition: 'border-color 0.15s ease, transform 0.15s ease',
    };

    switch (variant) {
      case 'matched':
        return {
          ...base,
          backgroundColor: '#081a13',
          border: '2px solid var(--neon-emerald)',
          boxShadow: '0 0 28px rgba(0, 245, 155, 0.15)',
        };
      case 'highlight':
        return {
          ...base,
          backgroundColor: 'var(--bg-surface)',
          border: '1.5px solid rgba(0, 245, 155, 0.4)',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.3)',
        };
      case 'raised':
        return {
          ...base,
          backgroundColor: 'var(--bg-surface-raised)',
          border: '1px solid var(--border-subtle)',
        };
      case 'flat':
        return {
          ...base,
          backgroundColor: 'transparent',
          border: '1px solid var(--border-subtle)',
        };
      case 'default':
      default:
        return {
          ...base,
          backgroundColor: 'var(--bg-surface)',
          border: '1.5px solid var(--border-subtle)',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.3)',
        };
    }
  };

  return (
    <div
      style={{ ...getVariantStyles(), ...style }}
      className={`delivrery-card ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};
