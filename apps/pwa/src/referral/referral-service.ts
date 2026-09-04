/**
 * @file referral-service.ts
 * @description Motor de indicação viral, compartilhamento multicanal e rastreamento de links (FR-15, NFR-9).
 * Suporta Web Share API nativa, cópia com Haptic Feedback, disparo WhatsApp e detecção de referral na URL.
 */

const REFERRAL_STORAGE_KEY = 'delivrery_referred_by_code';

export interface ShareResult {
  success: boolean;
  method: 'web-share' | 'clipboard' | 'fallback';
  message: string;
}

export class ReferralService {
  /**
   * Gera a URL canônica de indicação viral contendo o parâmetro ?ref=.
   */
  public static generateReferralUrl(referralCode: string, origin?: string): string {
    const baseOrigin =
      origin ||
      (typeof window !== 'undefined' ? window.location.origin : 'https://delivrery.app');
    const cleanCode = (referralCode || '').trim().toUpperCase();
    return `${baseOrigin}/?ref=${encodeURIComponent(cleanCode)}`;
  }

  /**
   * Gera o link direto de compartilhamento para grupos e contatos do WhatsApp.
   */
  public static generateWhatsAppShareUrl(
    referralCode: string,
    neighborhoodName?: string,
    origin?: string
  ): string {
    const link = this.generateReferralUrl(referralCode, origin);
    const local = neighborhoodName ? `no bairro ${neighborhoodName}` : 'na nossa região';
    const message = `Bora ativar o deLIVREry ${local}! Entregas locais diretas, sem taxa de comissão e com preço justo para lojistas e motoboys. Cadastre-se pelo meu link de indicação: ${link}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  }

  /**
   * Compartilha o link de indicação via Web Share API ou cópia para Clipboard com Haptic Feedback.
   */
  public static async shareReferral(
    referralCode: string,
    neighborhoodName?: string,
    origin?: string
  ): Promise<ShareResult> {
    const link = this.generateReferralUrl(referralCode, origin);
    const local = neighborhoodName ? `no bairro ${neighborhoodName}` : 'na nossa região';
    const title = 'deLIVREry — Plataforma Livre de Entregas';
    const text = `Ajude a ativar o deLIVREry ${local}! Cadastre-se pelo meu link:`;

    // 1. Tenta Web Share API nativa (dispositivos móveis modernos)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: link
        });

        this.triggerHapticFeedback();
        return {
          success: true,
          method: 'web-share',
          message: 'Compartilhamento realizado com sucesso!'
        };
      } catch (err: any) {
        // Se o usuário cancelou o drawer nativo, encerra graciosamente
        if (err.name === 'AbortError') {
          return {
            success: false,
            method: 'web-share',
            message: 'Compartilhamento cancelado.'
          };
        }
        // Em caso de outro erro, cai para o fallback do clipboard
      }
    }

    // 2. Fallback: Cópia para a Área de Transferência com Haptic Feedback
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(link);
        this.triggerHapticFeedback();
        return {
          success: true,
          method: 'clipboard',
          message: 'Link de indicação copiado para a área de transferência!'
        };
      } catch (clipErr) {
        console.warn('Falha na cópia via clipboard:', clipErr);
      }
    }

    // 3. Fallback passivo
    return {
      success: false,
      method: 'fallback',
      message: link
    };
  }

  /**
   * Dispara vibração tátil (Haptic Feedback) em dispositivos compatíveis (guidão/mobile - NFR-9).
   */
  public static triggerHapticFeedback(): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([40, 25, 40]);
      } catch (e) {
        // Silenciosamente ignorado se o dispositivo não tiver motor de vibração
      }
    }
  }

  /**
   * Extrai o código de indicação presente na query string (?ref=) ou hash (#ref=).
   */
  public static extractReferralCodeFromUrl(searchString?: string): string | null {
    let search =
      searchString !== undefined
        ? searchString
        : typeof window !== 'undefined'
        ? window.location.search
        : '';

    // Se search estiver vazio, verifica se veio no hash (ex: #/cadastro?ref=... ou #ref=...)
    if (!search && typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash;
      const questionIndex = hash.indexOf('?');
      if (questionIndex !== -1) {
        search = hash.slice(questionIndex);
      } else if (hash.includes('ref=')) {
        search = `?${hash.replace(/^#\/?/, '')}`;
      }
    }

    if (!search) return null;

    const cleanSearch = search.startsWith('?') ? search : `?${search}`;
    const urlParams = new URLSearchParams(cleanSearch);
    const ref = urlParams.get('ref');
    if (ref && ref.trim().length > 0) {
      return ref.trim().toUpperCase();
    }

    return null;
  }

  /**
   * Salva o código de indicação capturado no LocalStorage para auto-preenchimento futuro.
   */
  public static saveReferralCodeToStorage(code: string): void {
    if (typeof localStorage !== 'undefined' && code) {
      try {
        localStorage.setItem(REFERRAL_STORAGE_KEY, code.trim().toUpperCase());
      } catch (e) {
        console.warn('Não foi possível salvar referral code no localStorage:', e);
      }
    }
  }

  /**
   * Recupera o código de indicação salvo no LocalStorage.
   */
  public static getStoredReferralCode(): string | null {
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(REFERRAL_STORAGE_KEY);
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}
