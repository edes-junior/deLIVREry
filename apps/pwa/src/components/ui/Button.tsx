/**
 * @file Button.tsx
 * @description Componente de botão tático e ergonômico do deLIVREry Design System.
 * Atende às especificações de DESIGN.md: áreas de toque amplas (min 48px), contraste alto e feedback tátil.
 */

import React from 'react';
import { triggerHaptic } from './Haptics.ts';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'cta' | 'secondary' | 'whatsapp' | 'pix' | 'pill' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  haptic?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  isActive?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  haptic = true,
  isLoading = false,
  icon,
  fullWidth = false,
  isActive = false,
  onClick,
  disabled,
  style,
  className = '',
  ...rest
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) return;
    if (haptic) {
      triggerHaptic(40);
    }
    if (onClick) {
      onClick(e);
    }
  };

  const getBaseStyle = (): React.CSSProperties => {
    const minHeight = size === 'lg' ? '52px' : size === 'sm' ? '40px' : '48px';
    const padding = size === 'lg' ? '12px 18px' : size === 'sm' ? '8px 12px' : '10px 14px';
    const fontSize = size === 'lg' ? '15px' : size === 'sm' ? '12px' : '13px';

    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      minHeight,
      padding,
      fontSize,
      fontWeight: 800,
      borderRadius: 'var(--radius-md)',
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'all 0.15s ease',
      width: fullWidth ? '100%' : 'auto',
      maxWidth: '100%',
      wordBreak: 'break-word',
      textAlign: 'center',
      outline: 'none',
      fontFamily: 'var(--font-sans)',
      boxSizing: 'border-box',
    };

    switch (variant) {
      case 'cta':
        return {
          ...base,
          backgroundColor: 'var(--neon-emerald)',
          color: '#032314',
          border: 'none',
          boxShadow: '0 4px 14px var(--neon-emerald-glow)',
        };
      case 'whatsapp':
        return {
          ...base,
          backgroundColor: 'var(--whatsapp-green)',
          color: '#052410',
          border: 'none',
          boxShadow: '0 4px 14px rgba(37, 211, 102, 0.3)',
        };
      case 'pix':
        return {
          ...base,
          backgroundColor: 'transparent',
          border: '1.5px dashed var(--neon-emerald)',
          color: 'var(--neon-emerald)',
        };
      case 'pill':
        return {
          ...base,
          backgroundColor: isActive ? 'var(--bg-surface-raised)' : 'var(--bg-surface)',
          border: isActive ? '1.5px solid var(--neon-emerald)' : '1.5px solid var(--border-subtle)',
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          boxShadow: isActive ? '0 0 12px rgba(0, 245, 155, 0.2)' : 'none',
        };
      case 'danger':
        return {
          ...base,
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
        };
      case 'ghost':
        return {
          ...base,
          backgroundColor: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
        };
      case 'secondary':
      default:
        return {
          ...base,
          backgroundColor: 'transparent',
          border: '1.5px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
        };
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      style={{ ...getBaseStyle(), ...style }}
      className={`delivrery-btn ${className}`}
      {...rest}
    >
      {isLoading ? (
        <>
          <Loader2 size={16} className="animate-spin" style={{ display: 'inline-block' }} />
          <span>Carregando...</span>
        </>
      ) : (
        <>
          {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};
