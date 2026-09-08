/**
 * Serviço de Rate Limiting por Tenant para APIs Headless
 * Implementa controle de taxa em janela de 60 segundos com suporte a cabeçalhos RFC
 * (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After).
 */

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;       // Timestamp UNIX (segundos)
  retryAfter?: number; // Segundos restantes para o reset quando bloqueado (429)
}

interface ClientRateRecord {
  windowStartMs: number;
  requestCount: number;
}

export class RateLimiterService {
  private static clientWindows: Map<string, ClientRateRecord> = new Map();
  private static readonly WINDOW_DURATION_MS = 60 * 1000; // 1 minuto

  /**
   * Avalia e contabiliza uma requisição para o tenant indicado.
   * Se exceder o límite (ex: 120 RPM ou 600 RPM), retorna allowed=false com retryAfter em segundos.
   */
  public static checkRateLimit(
    clientId: string, 
    maxRpm: number = 120, 
    nowMs: number = Date.now()
  ): RateLimitCheckResult {
    const limit = Math.max(1, maxRpm);
    const clientKey = clientId || 'anonymous';
    const record = this.clientWindows.get(clientKey);

    const currentWindowStart = record?.windowStartMs ?? nowMs;
    const isWindowExpired = (nowMs - currentWindowStart) >= this.WINDOW_DURATION_MS;

    if (!record || isWindowExpired) {
      // Nova janela de 1 minuto
      const newRecord: ClientRateRecord = {
        windowStartMs: nowMs,
        requestCount: 1
      };
      this.clientWindows.set(clientKey, newRecord);

      const resetSec = Math.ceil((nowMs + this.WINDOW_DURATION_MS) / 1000);
      return {
        allowed: true,
        limit,
        remaining: limit - 1,
        reset: resetSec
      };
    }

    // Janela ativa
    const resetMs = record.windowStartMs + this.WINDOW_DURATION_MS;
    const resetSec = Math.ceil(resetMs / 1000);
    const retryAfterSec = Math.max(1, Math.ceil((resetMs - nowMs) / 1000));

    if (record.requestCount >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        reset: resetSec,
        retryAfter: retryAfterSec
      };
    }

    record.requestCount += 1;
    const remaining = Math.max(0, limit - record.requestCount);

    return {
      allowed: true,
      limit,
      remaining,
      reset: resetSec
    };
  }

  /**
   * Limpa todos os contadores de taxa em memória (útil para suítes de testes).
   */
  public static clearLimits(): void {
    this.clientWindows.clear();
  }

  /**
   * Obtém os contadores ativos para inspeção.
   */
  public static getRecord(clientId: string): ClientRateRecord | undefined {
    return this.clientWindows.get(clientId);
  }
}
