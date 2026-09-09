/**
 * @file Haptics.ts
 * @description Utilitário de feedback tátil (vibração) para dispositivos móveis.
 * Proporciona confirmação física sutil ao realizar ações operacionais no PWA.
 */

export const triggerHaptic = (pattern: number | number[] = 40) => {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Falha silenciosa caso o dispositivo ou permissão não suporte vibração
    }
  }
};
