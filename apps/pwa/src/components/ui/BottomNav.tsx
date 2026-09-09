/**
 * @file BottomNav.tsx
 * @description Barra de navegação inferior fixa para operação com uma mão no PWA.
 * Ativa no mobile e oculta no desktop (>= 900px).
 */

import React from 'react';
import { triggerHaptic } from './Haptics.ts';

export type NavTab = 'turnos' | 'precos' | 'quorum' | 'doar';

export interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: NavTab; label: string; icon: string }[] = [
    { id: 'turnos', label: 'Turnos', icon: '⚡' },
    { id: 'precos', label: 'Preços', icon: '📊' },
    { id: 'quorum', label: 'Meta Bairro', icon: '📍' },
    { id: 'doar', label: 'Apoiar', icon: '💚' },
  ];

  const handleSelect = (id: NavTab) => {
    triggerHaptic(30);
    onTabChange(id);
  };

  return (
    <nav
      className="delivrery-bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        height: '60px',
        backgroundColor: 'rgba(13, 18, 28, 0.96)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '0 8px',
        zIndex: 1000,
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @media (min-width: 900px) {
          .delivrery-bottom-nav {
            display: none !important;
          }
        }
      `}</style>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => handleSelect(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              color: isActive ? 'var(--neon-emerald)' : 'var(--text-muted)',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: '6px 12px',
              minHeight: '44px',
              fontFamily: 'var(--font-sans)',
              transition: 'color 0.15s ease',
              outline: 'none',
            }}
          >
            <span style={{ fontSize: '16px' }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
