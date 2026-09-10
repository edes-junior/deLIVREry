/**
 * @file Logo.tsx
 * @description Componente SVG vetorial oficial da identidade deLIVREry.
 * Implementa as diretrizes do BMad UX Design System:
 * - Variante 'emblem' (Opção 1B): Emblema vertical com o Freedom Bolt no topo e simetria axial (ideal para Hero, Login e Splash).
 * - Variante 'horizontal' (Opção 1A): Compacto com o Freedom Bolt à esquerda e lockup tipográfico perfeitamente justificado (ideal para cabeçalhos e navegação).
 * - Variante 'mark': Apenas o glifo tático Freedom Bolt com o acento amarelo viário.
 */

import React, { useId } from 'react';

export type LogoVariant = 'horizontal' | 'emblem' | 'mark';
export type LogoSize = 'sm' | 'md' | 'lg';

export interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  showTagline?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'data-testid'?: string;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  showTagline = true,
  className = '',
  style = {},
  'data-testid': testId = 'delivrery-logo'
}) => {
  const uniqueId = useId().replace(/:/g, '');
  const boltGradId = `boltGrad_${uniqueId}`;
  const glowFilterId = `glowFilter_${uniqueId}`;

  // 1. VARIANTE MARK (Apenas o glifo Freedom Bolt)
  if (variant === 'mark') {
    const markDimensions: Record<LogoSize, { width: number; height: number }> = {
      sm: { width: 24, height: 24 },
      md: { width: 36, height: 36 },
      lg: { width: 48, height: 48 }
    };
    const { width, height } = markDimensions[size];

    return (
      <svg
        viewBox="0 0 32 46"
        width={width}
        height={height}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
        data-testid={testId}
        aria-label="deLIVREry Mark"
      >
        <defs>
          <linearGradient id={boltGradId} x1="0" y1="0" x2="32" y2="46" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00F59B" />
            <stop offset="1" stopColor="#00B870" />
          </linearGradient>
          <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <g filter={`url(#${glowFilterId})`}>
          <path d="M16 2L3 24H16L12 44L29 19H16L21 2H16Z" fill={`url(#${boltGradId})`} />
          <circle cx="27" cy="6" r="2.8" fill="#FFE600" />
        </g>
      </svg>
    );
  }

  // 2. VARIANTE EMBLEM (Opção 1B - Stacked Hero)
  if (variant === 'emblem') {
    const emblemDimensions: Record<LogoSize, { width: number; height: number }> = {
      sm: { width: 140, height: showTagline ? 56 : 46 },
      md: { width: 180, height: showTagline ? 72 : 58 },
      lg: { width: 220, height: showTagline ? 88 : 72 }
    };
    const { width, height } = emblemDimensions[size];
    const viewBox = showTagline ? '0 0 200 80' : '0 0 200 64';

    return (
      <svg
        viewBox={viewBox}
        width={width}
        height={height}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ display: 'inline-block', verticalAlign: 'middle', maxWidth: '100%', height: 'auto', ...style }}
        data-testid={testId}
        aria-label="deLIVREry Emblem"
      >
        <defs>
          <linearGradient id={boltGradId} x1="86" y1="0" x2="114" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00F59B" />
            <stop offset="1" stopColor="#00B870" />
          </linearGradient>
          <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Raio Centralizado no Topo */}
        <g transform="translate(86, 0)" filter={`url(#${glowFilterId})`}>
          <path d="M15 2L3 22H15L11 40L27 17H15L20 2H15Z" fill={`url(#${boltGradId})`} />
          <circle cx="26" cy="6" r="2.5" fill="#FFE600" />
        </g>

        {/* Tipografia Centralizada contínua sem espaços extras */}
        <text
          x="100"
          y="58"
          textAnchor="middle"
          fontFamily="'Inter', -apple-system, sans-serif"
          fontWeight="900"
          fontSize="26"
          letterSpacing="-0.03em"
        >
          <tspan fill="#94A3B8" fontWeight="700">de</tspan>
          <tspan fill="#00F59B">LIVRE</tspan>
          <tspan fill="#F8FAFC">ry</tspan>
        </text>

        {/* Lema justificado com a largura exata de deLIVREry */}
        {showTagline && (
          <text
            x="100"
            y="73"
            textAnchor="middle"
            fontFamily="'Inter', -apple-system, sans-serif"
            fontWeight="800"
            fontSize="7.2"
            fill="#64748B"
            textLength="130.2"
            lengthAdjust="spacing"
          >
            LOGÍSTICA P2P • SEM TAXAS
          </text>
        )}
      </svg>
    );
  }

  // 3. VARIANTE HORIZONTAL (Opção 1A - Compacta para Header / Nav)
  const horizontalDimensions: Record<LogoSize, { width: number; height: number }> = {
    sm: { width: 145, height: showTagline ? 33 : 26 },
    md: { width: 175, height: showTagline ? 40 : 30 },
    lg: { width: 205, height: showTagline ? 46 : 36 }
  };
  const { width, height } = horizontalDimensions[size];
  const viewBox = showTagline ? '4 2 182 45' : '4 2 182 36';

  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', maxWidth: '100%', height: 'auto', ...style }}
      data-testid={testId}
      aria-label="deLIVREry Logo"
    >
      <defs>
        <linearGradient id={boltGradId} x1="0" y1="0" x2="28" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00F59B" />
          <stop offset="1" stopColor="#00B870" />
        </linearGradient>
        <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Glifo Freedom Bolt à esquerda */}
      <g transform="translate(4, 2)" filter={`url(#${glowFilterId})`}>
        <path d="M16 2L3 24H16L12 44L29 19H16L21 2H16Z" fill={`url(#${boltGradId})`} />
        <circle cx="27" cy="6" r="2.5" fill="#FFE600" />
      </g>

      {/* Tipografia contínua sem espaços adicionais */}
      <text
        x="40"
        y="32"
        fontFamily="'Inter', -apple-system, sans-serif"
        fontWeight="900"
        fontSize="28"
        letterSpacing="-0.03em"
      >
        <tspan fill="#94A3B8" fontWeight="700">de</tspan>
        <tspan fill="#00F59B">LIVRE</tspan>
        <tspan fill="#F8FAFC">ry</tspan>
      </text>

      {/* Subtítulo justificado exatamente na largura de deLIVREry */}
      {showTagline && (
        <text
          x="40"
          y="45"
          fontFamily="'Inter', -apple-system, sans-serif"
          fontWeight="800"
          fontSize="7.5"
          fill="#64748B"
          textLength="140.5"
          lengthAdjust="spacing"
        >
          LOGÍSTICA P2P • SEM TAXAS
        </text>
      )}
    </svg>
  );
};
