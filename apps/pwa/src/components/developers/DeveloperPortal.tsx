import React, { useState } from 'react';
import { SwaggerDocsViewer } from './SwaggerDocsViewer.tsx';
import { ApiKeyGeneratorModal } from './ApiKeyGeneratorModal.tsx';
import { WebhookTester } from './WebhookTester.tsx';
import { EmbedWidgetPlayground } from './EmbedWidgetPlayground.tsx';
import type { ApiClient } from '../../api/gateway/types.ts';

interface DeveloperPortalProps {
  onBack?: () => void;
}

export const DeveloperPortal: React.FC<DeveloperPortalProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'docs' | 'keys' | 'webhooks' | 'sdk' | 'widget'>('docs');
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [activeApiKey, setActiveApiKey] = useState('');
  const [activeClient, setActiveClient] = useState<ApiClient | null>(null);

  const handleBack = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([15]);
    }
    if (onBack) {
      onBack();
    }
  };

  const handleKeyGenerated = (key: string, client: ApiClient) => {
    setActiveApiKey(key);
    setActiveClient(client);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0b1120',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Top Header */}
      <header style={{
        backgroundColor: '#0f172a',
        borderBottom: '1px solid #1e293b',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {onBack && (
            <button
              onClick={handleBack}
              style={{
                backgroundColor: '#1e293b',
                color: '#94a3b8',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 16px',
                minHeight: '48px',
                minWidth: '48px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              ← Voltar ao App
            </button>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>⚡</span>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>
                deLIVREry <span style={{ color: '#38bdf8' }}>Developer Portal</span>
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Documentação OpenAPI 3.0, Emissão de Chaves B2B e Webhooks Assinados
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setIsKeyModalOpen(true)}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              minHeight: '48px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)'
            }}
          >
            ✨ Emitir Nova API Key
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Active Key Banner se houver chave gerada recentemente */}
        {activeApiKey && (
          <div style={{
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid #3b82f6',
            borderRadius: '10px',
            padding: '14px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ fontSize: '14px' }}>
              <strong style={{ color: '#60a5fa' }}>Chave Ativa em Uso:</strong>{' '}
              <code style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{activeApiKey}</code>{' '}
              ({activeClient?.clientName} - {activeClient?.allowedCities.includes('*') ? 'Nacional' : activeClient?.allowedCities.join(', ')})
            </div>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Pronta para testes no console</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #1e293b',
          paddingBottom: '12px',
          marginBottom: '24px',
          overflowX: 'auto'
        }}>
          <button
            onClick={() => setActiveTab('docs')}
            style={{
              padding: '12px 20px',
              minHeight: '48px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'docs' ? '#1e293b' : 'transparent',
              color: activeTab === 'docs' ? '#38bdf8' : '#94a3b8',
              fontWeight: 700,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: activeTab === 'docs' ? '2px solid #38bdf8' : 'none'
            }}
          >
            📖 Documentação OpenAPI & Console
          </button>

          <button
            onClick={() => setActiveTab('keys')}
            style={{
              padding: '12px 20px',
              minHeight: '48px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'keys' ? '#1e293b' : 'transparent',
              color: activeTab === 'keys' ? '#38bdf8' : '#94a3b8',
              fontWeight: 700,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: activeTab === 'keys' ? '2px solid #38bdf8' : 'none'
            }}
          >
            🔑 Gestão de Credenciais
          </button>

          <button
            onClick={() => setActiveTab('webhooks')}
            style={{
              padding: '12px 20px',
              minHeight: '48px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'webhooks' ? '#1e293b' : 'transparent',
              color: activeTab === 'webhooks' ? '#38bdf8' : '#94a3b8',
              fontWeight: 700,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: activeTab === 'webhooks' ? '2px solid #38bdf8' : 'none'
            }}
          >
            🔔 Simulador de Webhooks (HMAC)
          </button>

          <button
            onClick={() => setActiveTab('sdk')}
            style={{
              padding: '12px 20px',
              minHeight: '48px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'sdk' ? '#1e293b' : 'transparent',
              color: activeTab === 'sdk' ? '#38bdf8' : '#94a3b8',
              fontWeight: 700,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: activeTab === 'sdk' ? '2px solid #38bdf8' : 'none'
            }}
          >
            📦 SDK & Exemplos de Código
          </button>

          <button
            onClick={() => setActiveTab('widget')}
            style={{
              padding: '12px 20px',
              minHeight: '48px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'widget' ? '#1e293b' : 'transparent',
              color: activeTab === 'widget' ? '#38bdf8' : '#94a3b8',
              fontWeight: 700,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: activeTab === 'widget' ? '2px solid #38bdf8' : 'none'
            }}
          >
            🧩 Web Component (&lt;delivrery-button /&gt;)
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'docs' && (
          <SwaggerDocsViewer apiKey={activeApiKey} />
        )}

        {activeTab === 'keys' && (
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '28px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 700, color: '#60a5fa' }}>
              🔑 Gestão e Emissão de Credenciais de API
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>
              Para integrar seu PDV, cardápio digital ou sistema municipal à rede descentralizada deLIVREry, gere sua API Key delimitando as cidades de operação e limites de taxa.
            </p>

            <button
              onClick={() => setIsKeyModalOpen(true)}
              style={{
                padding: '12px 24px',
                minHeight: '48px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              + Gerar Nova Chave de API
            </button>

            {activeClient && (
              <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #475569' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#cbd5e1' }}>Último Integrador Registrado:</h4>
                <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#94a3b8' }}>
                  <div>Nome: <strong style={{ color: '#fff' }}>{activeClient.clientName}</strong></div>
                  <div>E-mail Técnico: <strong style={{ color: '#fff' }}>{activeClient.ownerEmail}</strong></div>
                  <div>Cidades Autorizadas: <strong style={{ color: '#38bdf8' }}>{activeClient.allowedCities.join(', ')}</strong></div>
                  <div>Limite de Taxa: <strong style={{ color: '#a7f3d0' }}>{activeClient.rateLimitRpm} RPM</strong></div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'webhooks' && (
          <WebhookTester />
        )}

        {activeTab === 'sdk' && (
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#60a5fa' }}>
                📦 Início Rápido com o SDK (@delivrery/api-client-sdk)
              </h3>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>
                Utilize o SDK oficial para TypeScript / JavaScript com suporte nativo a autenticação, controle de taxa, erros RFC 7807 e validação de Webhooks HMAC-SHA256.
              </p>
            </div>

            <div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#cbd5e1' }}>1. Instalação:</h4>
              <pre style={{
                margin: 0,
                padding: '14px',
                backgroundColor: '#020617',
                borderRadius: '8px',
                color: '#38bdf8',
                fontFamily: 'monospace',
                fontSize: '13px'
              }}>
                npm install @delivrery/api-client-sdk
              </pre>
            </div>

            <div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#cbd5e1' }}>2. Consultando vagas abertas via API Headless:</h4>
              <pre style={{
                margin: 0,
                padding: '14px',
                backgroundColor: '#020617',
                borderRadius: '8px',
                color: '#a7f3d0',
                fontFamily: 'monospace',
                fontSize: '13px',
                overflowX: 'auto'
              }}>
{`import { DelivreryClient } from '@delivrery/api-client-sdk';

const client = new DelivreryClient({
  apiKey: 'sua_api_key_aqui',
  baseUrl: 'https://delivrery.app.br/api/v1'
});

// Listar vagas abertas em São Paulo
const jobs = await client.getJobs({
  cityId: 'sao_paulo',
  transportModal: 'motorcycle'
});
console.log('Vagas disponíveis:', jobs);`}
              </pre>
            </div>

            <div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#cbd5e1' }}>3. Validando a Assinatura HMAC de um Webhook:</h4>
              <pre style={{
                margin: 0,
                padding: '14px',
                backgroundColor: '#020617',
                borderRadius: '8px',
                color: '#fde047',
                fontFamily: 'monospace',
                fontSize: '13px',
                overflowX: 'auto'
              }}>
{`import { verifyWebhookSignature } from '@delivrery/api-client-sdk';

// No seu endpoint receptor (Express, Fastify, Next.js, etc.):
app.post('/api/webhooks', (req, res) => {
  const signature = req.headers['x-signature-sha256'];
  const isValid = verifyWebhookSignature(
    process.env.DELIVRERY_WEBHOOK_SECRET,
    req.body,
    signature
  );

  if (!isValid) {
    return res.status(401).send('Assinatura inválida');
  }

  const { event, data } = req.body;
  console.log(\`Evento \${event} autenticado com sucesso:\`, data);
  res.status(200).send({ ok: true });
});`}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'widget' && (
          <EmbedWidgetPlayground />
        )}
      </main>

      {/* Modal de Emissão de Chaves */}
      <ApiKeyGeneratorModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onKeyGenerated={handleKeyGenerated}
      />
    </div>
  );
};
