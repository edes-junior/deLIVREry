import { WebhookCrypto } from './webhook-crypto.ts';
import { ApiGatewayService } from '../gateway/api-gateway-service.ts';
import { supabase } from '../../lib/supabase.ts';
import type {
  WebhookEventType,
  WebhookSubscription,
  ApiClient,
  WebhookPayload,
  WebhookDeliveryResult,
  WebhookDeliveryAttempt,
  WebhookDispatcherOptions
} from './types.ts';

export class WebhookDispatcherService {
  private static mockSubscriptions: Map<string, { subscription: WebhookSubscription; client?: ApiClient }> = new Map();

  /**
   * Registra uma subscrição em memória (útil para testes unitários e desenvolvimento local)
   */
  public static registerMockSubscription(subscription: WebhookSubscription, client?: ApiClient): void {
    this.mockSubscriptions.set(subscription.id, { subscription, client });
  }

  /**
   * Limpa as subscrições em memória
   */
  public static clearMockSubscriptions(): void {
    this.mockSubscriptions.clear();
  }

  /**
   * Retorna as subscrições em memória ativas
   */
  public static getMockSubscriptions(): WebhookSubscription[] {
    return Array.from(this.mockSubscriptions.values()).map(item => item.subscription);
  }

  /**
   * Calcula o tempo de espera do backoff exponencial para uma determinada tentativa
   * Tentativa 1: 0ms (imediata)
   * Tentativa 2: 1 * baseDelayMs
   * Tentativa 3: 2 * baseDelayMs
   */
  public static calculateBackoff(attempt: number, baseDelayMs: number): number {
    if (attempt <= 1) return 0;
    return baseDelayMs * Math.pow(2, attempt - 2);
  }

  private static sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Despacha um evento operacional para todos os parceiros com subscrições ativas e compatíveis
   */
  public static async dispatch(
    event: WebhookEventType,
    data: any,
    options: WebhookDispatcherOptions = {}
  ): Promise<WebhookDeliveryResult[]> {
    const subscriptions = await this.findActiveSubscriptions(event);
    const results: WebhookDeliveryResult[] = [];

    for (const item of subscriptions) {
      const result = await this.dispatchToSubscription(item.subscription, item.client, event, data, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Realiza a entrega HTTP para uma subscrição específica com controle de retentativas
   */
  public static async dispatchToSubscription(
    subscription: WebhookSubscription,
    client: ApiClient | undefined,
    event: WebhookEventType,
    data: any,
    options: WebhookDispatcherOptions = {}
  ): Promise<WebhookDeliveryResult> {
    const maxAttempts = options.maxAttempts ?? 3;
    const baseDelayMs = options.baseDelayMs ?? 1000;
    const timeoutMs = options.timeoutMs ?? 5000;
    const fetchFn = options.fetchFn ?? globalThis.fetch;

    // 1. Verificação de subscrição ativa
    if (!subscription.isActive) {
      return {
        subscriptionId: subscription.id,
        targetUrl: subscription.targetUrl,
        event,
        success: false,
        skipped: true,
        skipReason: 'Subscrição inativa',
        attempts: [],
        totalDurationMs: 0
      };
    }

    // 2. Verificação de Escopo Municipal (FR-3, FR-17)
    const eventCityId = data?.city_id || data?.cityId || data?.city;
    if (client && client.allowedCities && eventCityId) {
      const hasCityAccess = ApiGatewayService.validateCityAccess(client.allowedCities, eventCityId);
      if (!hasCityAccess) {
        return {
          subscriptionId: subscription.id,
          targetUrl: subscription.targetUrl,
          event,
          success: false,
          skipped: true,
          skipReason: `Cidade '${eventCityId}' não autorizada no escopo do cliente (${client.allowedCities.join(', ')})`,
          attempts: [],
          totalDurationMs: 0
        };
      }
    }

    // 3. Montagem do Payload Padronizado
    const eventId = WebhookCrypto.generateEventId();
    const timestamp = new Date().toISOString();
    const payload: WebhookPayload = {
      id: eventId,
      event,
      timestamp,
      data
    };

    const rawBody = JSON.stringify(payload);
    const signature = WebhookCrypto.generateSignature(subscription.secretToken, rawBody);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Delivery-Event': event,
      'X-Delivery-Timestamp': timestamp,
      'X-Signature-SHA256': signature
    };

    const attempts: WebhookDeliveryAttempt[] = [];
    const startTimeOverall = Date.now();
    let success = false;
    let finalStatusCode: number | undefined;
    let lastError: string | undefined;

    // 4. Ciclo de Retentativas com Backoff Exponencial
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        const backoffMs = this.calculateBackoff(attempt, baseDelayMs);
        await this.sleep(backoffMs);
      }

      const attemptStart = Date.now();
      let attemptStatusCode: number | undefined;
      let attemptError: string | undefined;

      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

        const response = await fetchFn(subscription.targetUrl, {
          method: 'POST',
          headers,
          body: rawBody,
          signal: controller?.signal
        });

        if (timeoutId) clearTimeout(timeoutId);

        attemptStatusCode = response.status;
        finalStatusCode = response.status;

        // Sucesso HTTP 2xx
        if (response.ok) {
          success = true;
          attempts.push({
            attemptNumber: attempt,
            statusCode: attemptStatusCode,
            durationMs: Date.now() - attemptStart,
            timestamp: new Date().toISOString()
          });
          break; // Sucesso: encerra ciclo de retentativas
        }

        // Falha permanente por 4xx do cliente parceiro (ex: 400 Bad Request, 404 Not Found)
        if (response.status >= 400 && response.status < 500) {
          attemptError = `Erro permanente do parceiro: HTTP ${response.status}`;
          lastError = attemptError;
          attempts.push({
            attemptNumber: attempt,
            statusCode: attemptStatusCode,
            durationMs: Date.now() - attemptStart,
            error: attemptError,
            timestamp: new Date().toISOString()
          });
          break; // Aborta imediatamente sem re-tentar
        }

        // Erro HTTP 5xx (Server Error do receptor)
        attemptError = `Erro no servidor receptor: HTTP ${response.status}`;
        lastError = attemptError;
      } catch (err: any) {
        attemptError = err?.message || 'Falha de conexão / timeout';
        lastError = attemptError;
      }

      attempts.push({
        attemptNumber: attempt,
        statusCode: attemptStatusCode,
        durationMs: Date.now() - attemptStart,
        error: attemptError,
        timestamp: new Date().toISOString()
      });

      if (attempt === maxAttempts) {
        break;
      }
    }

    return {
      subscriptionId: subscription.id,
      targetUrl: subscription.targetUrl,
      event,
      success,
      attempts,
      totalDurationMs: Date.now() - startTimeOverall,
      finalStatusCode,
      error: lastError
    };
  }

  /**
   * Busca subscrições ativas para o evento a partir da memória ou do banco Supabase
   */
  private static async findActiveSubscriptions(
    event: WebhookEventType
  ): Promise<Array<{ subscription: WebhookSubscription; client?: ApiClient }>> {
    const results: Array<{ subscription: WebhookSubscription; client?: ApiClient }> = [];

    // 1. Busca das subscrições em memória
    for (const item of this.mockSubscriptions.values()) {
      if (item.subscription.isActive && item.subscription.eventType === event) {
        results.push(item);
      }
    }

    // 2. Se não houver em memória, consulta o Supabase se configurado
    if (results.length === 0 && supabase) {
      try {
        const { data, error } = await supabase
          .from('webhooks_subscriptions')
          .select(`
            id,
            client_id,
            target_url,
            event_type,
            secret_token,
            is_active,
            created_at,
            api_clients (
              id,
              client_name,
              api_key_hash,
              owner_email,
              allowed_cities,
              rate_limit_rpm,
              is_active
            )
          `)
          .eq('is_active', true)
          .eq('event_type', event);

        if (!error && data) {
          for (const row of data as any[]) {
            const clientData = row.api_clients;
            const client: ApiClient | undefined = clientData ? {
              id: clientData.id,
              clientName: clientData.client_name,
              apiKeyHash: clientData.api_key_hash,
              ownerEmail: clientData.owner_email,
              allowedCities: clientData.allowed_cities || ['*'],
              rateLimitRpm: clientData.rate_limit_rpm || 120,
              isActive: clientData.is_active ?? true
            } : undefined;

            results.push({
              subscription: {
                id: row.id,
                clientId: row.client_id,
                targetUrl: row.target_url,
                eventType: row.event_type as WebhookEventType,
                secretToken: row.secret_token,
                isActive: row.is_active,
                createdAt: row.created_at
              },
              client
            });
          }
        }
      } catch {
        // Fallback seguro em caso de indisponibilidade momentânea do DB
      }
    }

    return results;
  }
}
