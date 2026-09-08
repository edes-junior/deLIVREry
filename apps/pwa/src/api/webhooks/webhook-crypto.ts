import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * Utilitários criptográficos para Webhooks de Saída e Validação de Assinaturas (FR-17)
 */
export class WebhookCrypto {
  /**
   * Gera a assinatura HMAC-SHA256 em formato hexadecimal para um determinado payload e secret.
   *
   * @param secretToken Segredo compartilhado da subscrição de webhook
   * @param rawBody Corpo cru da requisição (string) ou objeto serializável
   * @returns Assinatura HMAC-SHA256 em formato hexadecimal
   */
  public static generateSignature(secretToken: string, rawBody: string | object): string {
    if (!secretToken || typeof secretToken !== 'string') {
      throw new Error('secretToken é obrigatório para gerar assinatura de webhook.');
    }

    const payloadString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
    return bytesToHex(hmac(sha256, utf8ToBytes(secretToken.trim()), utf8ToBytes(payloadString)));
  }

  /**
   * Valida a assinatura de um webhook recebido de forma segura contra ataques de timing.
   *
   * @param secretToken Segredo compartilhado configurado na subscrição
   * @param rawBody Corpo cru da requisição recebida
   * @param signatureHeader Valor recebido no cabeçalho X-Signature-SHA256 (com ou sem prefixo 'sha256=')
   * @returns boolean indicando se a assinatura confere
   */
  public static verifySignature(
    secretToken: string, 
    rawBody: string | object, 
    signatureHeader: string
  ): boolean {
    if (!secretToken || !signatureHeader) {
      return false;
    }

    try {
      const cleanSignature = signatureHeader.replace(/^sha256=/i, '').trim();
      const expectedSignature = this.generateSignature(secretToken, rawBody);

      if (cleanSignature.length !== expectedSignature.length) {
        return false;
      }

      let diff = 0;
      for (let i = 0; i < cleanSignature.length; i++) {
        diff |= cleanSignature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
      }

      return diff === 0;
    } catch {
      return false;
    }
  }

  /**
   * Gera um identificador único para o evento de webhook
   */
  public static generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `evt_${timestamp}${random}`;
  }
}
