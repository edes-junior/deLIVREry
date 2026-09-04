/**
 * Supabase Edge Function: pricing-stats
 * Endpoint: GET /functions/v1/pricing-stats (ou /api/v1/analytics/pricing-stats)
 * Retorna métricas analíticas consolidadas de preços regionais com filtro 1.5xIQR e latência < 100ms (NFR-3).
 */

import { PricingService } from '../../../apps/pwa/src/pricing/pricing-service.ts';

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url, 'http://localhost');
  const queryParams: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    queryParams[key] = value;
  }

  const reqHeaders: Record<string, string> = {};
  if (req.headers && typeof req.headers.entries === 'function') {
    for (const [key, value] of req.headers.entries()) {
      reqHeaders[key] = value;
    }
  }

  const result = await PricingService.handlePricingStatsRequest({
    method: req.method,
    url: req.url,
    queryParams,
    headers: reqHeaders
  });

  return new Response(result.body ? JSON.stringify(result.body) : null, {
    status: result.status,
    headers: result.headers
  });
}

// Se executando no Deno Edge Runtime
// @ts-ignore
if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  // @ts-ignore
  Deno.serve(handler);
}

export default handler;
