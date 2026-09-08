/**
 * Contratos de tipos para o Gateway de API e Tenants Integradores
 * Em conformidade com RFC 7807 Problem Details e arquitetura Headless.
 */

export type WebhookEventType = 
  | 'job.created'
  | 'bid.submitted'
  | 'job.accepted'
  | 'job.completed';

export const VALID_WEBHOOK_EVENTS: readonly WebhookEventType[] = [
  'job.created',
  'bid.submitted',
  'job.accepted',
  'job.completed'
] as const;

export interface ApiClient {
  id: string;
  clientName: string;
  apiKeyHash: string;
  ownerEmail: string;
  allowedCities: string[];
  rateLimitRpm: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WebhookSubscription {
  id: string;
  clientId: string;
  targetUrl: string;
  eventType: WebhookEventType;
  secretToken: string;
  isActive: boolean;
  createdAt?: string;
}

/**
 * Resposta de erro padronizada conforme a especificação RFC 7807 Problem Details
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  invalidParams?: Array<{
    name: string;
    reason: string;
  }>;
  [key: string]: unknown;
}

export interface ApiGatewayRequest {
  method: string;
  url: string;
  headers?: Record<string, string | undefined>;
  queryParams?: Record<string, string | undefined>;
  body?: any;
  cityId?: string;
}

export interface ApiGatewayAuthResult {
  isAuthenticated: boolean;
  isAuthorized: boolean;
  client?: ApiClient;
  problem?: ProblemDetails;
  statusCode: number;
}

export interface ApiGatewayResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}
