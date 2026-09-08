/**
 * Contratos de tipos para o Dispatcher de Webhooks de Saída
 * Em conformidade com FR-17, NFR-6 e NFR-10 (HMAC-SHA256 e resiliência).
 */

import type { WebhookEventType, WebhookSubscription, ApiClient } from '../gateway/types.ts';

export type { WebhookEventType, WebhookSubscription, ApiClient };

/**
 * Estrutura padronizada de payload transmitido nos webhooks
 */
export interface WebhookPayload<T = any> {
  id: string;             // ex: evt_01J7K...
  event: WebhookEventType;
  timestamp: string;      // ISO 8601 UTC
  data: T;
}

/**
 * Registro de uma tentativa individual de entrega HTTP
 */
export interface WebhookDeliveryAttempt {
  attemptNumber: number;
  statusCode?: number;
  durationMs: number;
  error?: string;
  timestamp: string;
}

/**
 * Resultado consolidado do ciclo de entrega do webhook
 */
export interface WebhookDeliveryResult {
  subscriptionId: string;
  targetUrl: string;
  event: WebhookEventType;
  success: boolean;
  attempts: WebhookDeliveryAttempt[];
  totalDurationMs: number;
  finalStatusCode?: number;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Opções de configuração do despachante de webhooks
 */
export interface WebhookDispatcherOptions {
  maxAttempts?: number;   // Padrão: 3 tentativas
  baseDelayMs?: number;   // Padrão: 1000ms (ajustável em testes)
  timeoutMs?: number;     // Padrão: 5000ms
  fetchFn?: typeof fetch; // Injeção de dependência para testes unitários
}
