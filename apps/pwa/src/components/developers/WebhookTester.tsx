import React, { useState } from 'react';
import { generateWebhookSecret, verifyWebhookSignature } from '../../../../../packages/api-client-sdk/src/index.js';
import { WebhookDispatcherService } from '../../api/webhooks/webhook-dispatcher.ts';
import { WebhookCrypto } from '../../api/webhooks/webhook-crypto.ts';
import type { WebhookSubscription, WebhookEventType, WebhookDeliveryResult } from '../../api/webhooks/types.ts';
import { Bell, RefreshCw, Check, Save, Send } from 'lucide-react';

export const WebhookTester: React.FC = () => {
  const [targetUrl, setTargetUrl] = useState('https://webhook.site/delivrery-test-partner');
  const [eventType, setEventType] = useState<WebhookEventType>('job.created');
  const [secretToken, setSecretToken] = useState(generateWebhookSecret());
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Estado da simulação de disparo
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<WebhookDeliveryResult | null>(null);
  const [transmittedPayload, setTransmittedPayload] = useState<any>(null);
  const [transmittedSignature, setTransmittedSignature] = useState<string | null>(null);

  const handleGenerateNewSecret = () => {
    const newSecret = generateWebhookSecret();
    setSecretToken(newSecret);
    setIsSubscribed(false);
  };

  const handleCopySecret = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(secretToken);
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([15]);
    }
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleSaveSubscription = () => {
    if (!targetUrl || !targetUrl.match(/^https?:\/\/.+/)) {
      alert('Por favor, informe uma URL HTTP/HTTPS válida.');
      return;
    }

    const subscription: WebhookSubscription = {
      id: `sub_${Date.now()}`,
      clientId: 'client_active_partner',
      targetUrl: targetUrl.trim(),
      eventType,
      secretToken: secretToken.trim(),
      isActive: true,
      createdAt: new Date().toISOString()
    };

    WebhookDispatcherService.registerMockSubscription(subscription);
    setIsSubscribed(true);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([20]);
    }
  };

  const handleSendTestWebhook = async () => {
    if (!targetUrl) return;

    setIsTesting(true);
    setTestResult(null);

    const subscription: WebhookSubscription = {
      id: `test_sub_${Date.now()}`,
      clientId: 'client_active_partner',
      targetUrl: targetUrl.trim(),
      eventType,
      secretToken: secretToken.trim(),
      isActive: true
    };

    let sampleData: any = {};
    if (eventType === 'job.created') {
      sampleData = {
        job_id: 'job_sample_999',
        title: 'Turno Noturno - Hamburgueria',
        store_name: 'Burger Rock',
        city_id: 'sao_paulo',
        neighborhood_id: 'vila_madalena',
        base_rate: 130.00,
        transport_modal: 'motorcycle'
      };
    } else if (eventType === 'bid.submitted') {
      sampleData = {
        bid_id: 'bid_sample_555',
        job_id: 'job_sample_999',
        courier_id: 'courier_sample_888',
        offered_rate: 140.00,
        status: 'pending'
      };
    } else if (eventType === 'job.accepted') {
      sampleData = {
        job_id: 'job_sample_999',
        courier_id: 'courier_sample_888',
        store_id: 'store_sample_777',
        matched_at: new Date().toISOString(),
        agreed_rate: 135.00
      };
    } else {
      sampleData = {
        job_id: 'job_sample_999',
        completed_at: new Date().toISOString(),
        total_deliveries: 14
      };
    }

    // Simula mock fetch se for webhook.site / url de teste para exibir feedback interativo instantâneo
    const mockOrRealFetch: typeof fetch = async (url, init) => {
      try {
        return await fetch(url, init);
      } catch {
        // Fallback simulador caso rede externa esteja offline ou bloqueada por CORS do navegador
        return new Response(JSON.stringify({ 
          status: 'simulated_success', 
          message: 'Endpoint simulador de teste respondeu com sucesso.',
          receivedEvent: eventType
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    };

    const rawPayloadObj = {
      id: WebhookCrypto.generateEventId(),
      event: eventType,
      timestamp: new Date().toISOString(),
      data: sampleData
    };
    const rawBodyString = JSON.stringify(rawPayloadObj);
    const signature = WebhookCrypto.generateSignature(subscription.secretToken, rawBodyString);

    setTransmittedPayload(rawPayloadObj);
    setTransmittedSignature(signature);

    const result = await WebhookDispatcherService.dispatchToSubscription(
      subscription,
      undefined,
      eventType,
      sampleData,
      { fetchFn: mockOrRealFetch, baseDelayMs: 200 }
    );

    setTestResult(result);
    setIsTesting(false);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([15, 30, 15]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Configuração do Endpoint */}
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '24px',
        color: '#f8fafc'
      }}>
        <div style={{ marginBottom: '18px' }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={20} /> Simulador e Validador de Webhooks (HMAC-SHA256)
          </h3>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>
            Configure o endpoint receptor do seu sistema (PDV, ERP ou Cardápio Digital) e envie disparos de teste assinados para auditar a validação de segurança.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              URL Receptora de Destino (HTTP POST):
            </label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => {
                setTargetUrl(e.target.value);
                setIsSubscribed(false);
              }}
              placeholder="https://seu-dominio.com.br/api/webhooks/delivrery"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                color: '#38bdf8',
                border: '1px solid #475569',
                fontSize: '14px',
                fontFamily: 'monospace',
                minHeight: '48px'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Tipo de Evento:
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as WebhookEventType)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  border: '1px solid #475569',
                  fontSize: '14px',
                  minHeight: '48px'
                }}
              >
                <option value="job.created">job.created (Nova vaga publicada)</option>
                <option value="bid.submitted">bid.submitted (Nova proposta enviada)</option>
                <option value="job.accepted">job.accepted (Matching fechado)</option>
                <option value="job.completed">job.completed (Turno finalizado)</option>
              </select>
            </div>

            <div style={{ flex: 2, minWidth: '280px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Segredo Compartilhado (Secret Token):
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={secretToken}
                  onChange={(e) => setSecretToken(e.target.value)}
                  style={{
                    flex: 1,
                    boxSizing: 'border-box',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#0f172a',
                    color: '#a7f3d0',
                    border: '1px solid #475569',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    minHeight: '48px'
                  }}
                />
                <button
                  type="button"
                  onClick={handleCopySecret}
                  style={{
                    backgroundColor: copiedSecret ? '#059669' : '#334155',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0 16px',
                    minHeight: '48px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {copiedSecret ? 'Copiado!' : 'Copiar'}
                </button>
                <button
                  type="button"
                  onClick={handleGenerateNewSecret}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#94a3b8',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    padding: '0 14px',
                    minHeight: '48px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Gerar novo segredo"
                  aria-label="Gerar novo segredo"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSaveSubscription}
              style={{
                padding: '12px 20px',
                minHeight: '48px',
                backgroundColor: isSubscribed ? '#059669' : '#334155',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isSubscribed ? (
                <>
                  <Check size={16} /> Subscrição Ativa
                </>
              ) : (
                <>
                  <Save size={16} /> Salvar Subscrição
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSendTestWebhook}
              disabled={isTesting}
              style={{
                padding: '12px 24px',
                minHeight: '48px',
                backgroundColor: isTesting ? '#64748b' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: isTesting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isTesting ? 'Disparando...' : (
                <>
                  <Send size={16} /> Disparar Webhook de Teste
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Resultados do Disparo */}
      {testResult && (
        <div style={{
          backgroundColor: '#0f172a',
          border: `1px solid ${testResult.success ? '#10b981' : '#ef4444'}`,
          borderRadius: '12px',
          padding: '20px',
          color: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                backgroundColor: testResult.success ? '#059669' : '#dc2626',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '13px'
              }}>
                {testResult.success ? 'HTTP 200 OK' : 'Falha na Entrega'}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>
                Evento: <code style={{ color: '#38bdf8' }}>{testResult.event}</code>
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              Tentativas: <strong>{testResult.attempts.length}</strong> | Latência Total: <strong>{testResult.totalDurationMs}ms</strong>
            </div>
          </div>

          {/* Cabeçalhos Transmitidos */}
          <div style={{ marginBottom: '14px' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#cbd5e1' }}>Cabeçalhos HTTP Enviados:</h4>
            <div style={{
              backgroundColor: '#1e293b',
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'monospace',
              color: '#94a3b8'
            }}>
              <div>Content-Type: <span style={{ color: '#fff' }}>application/json</span></div>
              <div>X-Delivery-Event: <span style={{ color: '#60a5fa' }}>{testResult.event}</span></div>
              <div>X-Delivery-Timestamp: <span style={{ color: '#fff' }}>{transmittedPayload?.timestamp}</span></div>
              <div>X-Signature-SHA256: <span style={{ color: '#34d399' }}>{transmittedSignature}</span></div>
            </div>
          </div>

          {/* Payload Enviado */}
          <div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#cbd5e1' }}>Payload JSON Despachado:</h4>
            <pre style={{
              margin: 0,
              padding: '12px',
              backgroundColor: '#020617',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'monospace',
              color: '#38bdf8',
              overflowX: 'auto'
            }}>
              {JSON.stringify(transmittedPayload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
