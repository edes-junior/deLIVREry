import React, { useState } from 'react';
import { openApiSpec } from '../../api/openapi/openapi-spec.ts';
import { HeadlessApiRouter } from '../../api/headless/headless-api-router.ts';
import type { ApiGatewayRequest, ApiGatewayResponse } from '../../api/gateway/types.ts';
import { Key, Zap } from 'lucide-react';

interface SwaggerDocsViewerProps {
  apiKey?: string;
}

export const SwaggerDocsViewer: React.FC<SwaggerDocsViewerProps> = ({ apiKey: initialApiKey = '' }) => {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [activeTag, setActiveTag] = useState<string>('all');
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({
    '/couriers-post': true,
    '/stores-post': false,
    '/jobs-get': true,
    '/bids/{id}/accept-post': false
  });

  // Estado do Console "Try It Out"
  const [consoleParams, setConsoleParams] = useState<Record<string, string>>({
    cityId: 'sao_paulo',
    transportModal: 'motorcycle',
    bidId: 'bid_123',
    storeId: 'store_test_uuid'
  });
  const [consoleBody, setConsoleBody] = useState<Record<string, string>>({
    '/couriers': JSON.stringify({
      fullName: 'Lucas Lima Entregador',
      cpf: '12345678909',
      phoneNumber: '11999998888',
      transportModal: 'motorcycle',
      baseDailyRate: 120.00,
      baseDeliveryFee: 8.00,
      cityId: 'sao_paulo',
      stateId: 'SP',
      homeNeighborhoodId: 'pinheiros'
    }, null, 2),
    '/stores': JSON.stringify({
      fullName: 'Maria Oliveira Gerente',
      cpf: '98765432100',
      phoneNumber: '11988887777',
      storeName: 'Pizzaria Bella Delivery',
      addressStreet: 'Rua Augusta, 500',
      addressNumber: '500',
      neighborhoodId: 'consolacao',
      cityId: 'sao_paulo',
      stateId: 'SP',
      latitude: -23.55052,
      longitude: -46.65588
    }, null, 2)
  });

  const [executionResults, setExecutionResults] = useState<Record<string, {
    status: number;
    headers: Record<string, string>;
    body: any;
    durationMs: number;
  } | null>>({});

  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});

  const toggleEndpoint = (key: string) => {
    setExpandedEndpoints(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const executeTryItOut = async (method: string, path: string, key: string) => {
    setIsLoading(prev => ({ ...prev, [key]: true }));
    const startTime = Date.now();

    try {
      let resolvedUrl = `/api/v1${path}`;
      const queryParams: Record<string, string> = {};

      if (path === '/jobs') {
        if (consoleParams.cityId) queryParams.city_id = consoleParams.cityId;
        if (consoleParams.transportModal) queryParams.transport_modal = consoleParams.transportModal;
        resolvedUrl += `?city_id=${encodeURIComponent(consoleParams.cityId || 'sao_paulo')}`;
        if (consoleParams.transportModal) {
          resolvedUrl += `&transport_modal=${encodeURIComponent(consoleParams.transportModal)}`;
        }
      } else if (path === '/bids/{id}/accept') {
        resolvedUrl = `/api/v1/bids/${encodeURIComponent(consoleParams.bidId || 'bid_123')}/accept`;
      }

      let parsedBody: any = undefined;
      if (['post', 'put', 'patch'].includes(method.toLowerCase())) {
        if (path === '/bids/{id}/accept') {
          parsedBody = { storeId: consoleParams.storeId || 'store_test_uuid' };
        } else if (consoleBody[path]) {
          try {
            parsedBody = JSON.parse(consoleBody[path]);
          } catch {
            parsedBody = {};
          }
        }
      }

      const req: ApiGatewayRequest = {
        method: method.toUpperCase(),
        url: resolvedUrl,
        headers: {
          'X-API-Key': apiKey.trim() || undefined,
          'Content-Type': 'application/json'
        },
        queryParams,
        body: parsedBody,
        cityId: consoleParams.cityId || 'sao_paulo'
      };

      const response = await HeadlessApiRouter.handle(req);
      const durationMs = Date.now() - startTime;

      setExecutionResults(prev => ({
        ...prev,
        [key]: {
          status: response.status,
          headers: response.headers,
          body: response.body,
          durationMs
        }
      }));
    } catch (err: any) {
      setExecutionResults(prev => ({
        ...prev,
        [key]: {
          status: 500,
          headers: {},
          body: { error: err?.message || 'Erro inesperado' },
          durationMs: Date.now() - startTime
        }
      }));
    } finally {
      setIsLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const getMethodBadgeStyle = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return { backgroundColor: '#10b981', color: '#ffffff' };
      case 'POST':
        return { backgroundColor: '#3b82f6', color: '#ffffff' };
      case 'DELETE':
        return { backgroundColor: '#ef4444', color: '#ffffff' };
      default:
        return { backgroundColor: '#64748b', color: '#ffffff' };
    }
  };

  const endpointsList = Object.entries(openApiSpec.paths).flatMap(([path, methods]) => {
    return Object.entries(methods).map(([method, details]: [string, any]) => ({
      path,
      method: method.toUpperCase(),
      key: `${path}-${method.toLowerCase()}`,
      details
    }));
  });

  const filteredEndpoints = activeTag === 'all'
    ? endpointsList
    : endpointsList.filter(ep => ep.details.tags?.includes(activeTag));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header com Metadados da API e Configuração de Chave */}
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '24px',
        color: '#f8fafc'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>
                {openApiSpec.info.title}
              </h2>
              <span style={{
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                v{openApiSpec.info.version}
              </span>
              <span style={{
                backgroundColor: '#059669',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                OpenAPI 3.0.3
              </span>
            </div>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', maxWidth: '750px', lineHeight: 1.5 }}>
              {openApiSpec.info.description}
            </p>
          </div>

          {/* Autenticação Global para o Console */}
          <div style={{
            backgroundColor: '#0f172a',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #475569',
            minWidth: '280px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              <Key size={16} /> API Key para Testes (X-API-Key):
            </label>
            <input
              type="text"
              placeholder="Cole sua API Key aqui..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #64748b',
                fontSize: '13px',
                fontFamily: 'monospace'
              }}
            />
          </div>
        </div>

        {/* Filtro por Tags */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTag('all')}
            style={{
              padding: '8px 16px',
              minHeight: '48px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTag === 'all' ? '#3b82f6' : '#334155',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            Todos ({endpointsList.length})
          </button>
          {openApiSpec.tags.map(tag => (
            <button
              key={tag.name}
              onClick={() => setActiveTag(tag.name)}
              style={{
                padding: '8px 16px',
                minHeight: '48px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTag === tag.name ? '#3b82f6' : '#334155',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Endpoints */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredEndpoints.map(({ path, method, key, details }) => {
          const isExpanded = !!expandedEndpoints[key];
          const badgeStyle = getMethodBadgeStyle(method);
          const result = executionResults[key];
          const loading = !!isLoading[key];

          return (
            <div
              key={key}
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '10px',
                overflow: 'hidden',
                color: '#f8fafc'
              }}
            >
              {/* Barra do Endpoint */}
              <div
                onClick={() => toggleEndpoint(key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '14px 18px',
                  cursor: 'pointer',
                  backgroundColor: '#1e293b',
                  userSelect: 'none',
                  gap: '12px'
                }}
              >
                <span style={{
                  ...badgeStyle,
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '13px',
                  minWidth: '60px',
                  textAlign: 'center'
                }}>
                  {method}
                </span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '15px' }}>
                  /api/v1{path}
                </span>
                <span style={{ color: '#94a3b8', fontSize: '13px', marginLeft: 'auto', marginRight: '10px' }}>
                  {details.summary}
                </span>
                <span style={{ color: '#64748b', fontSize: '16px' }}>
                  {isExpanded ? '▲' : '▼'}
                </span>
              </div>

              {/* Corpo Expandido do Endpoint */}
              {isExpanded && (
                <div style={{ padding: '20px', borderTop: '1px solid #334155', backgroundColor: '#0f172a' }}>
                  <p style={{ margin: '0 0 16px 0', color: '#cbd5e1', fontSize: '14px' }}>
                    {details.description}
                  </p>

                  {/* Parâmetros se houver */}
                  {details.parameters && details.parameters.length > 0 && (
                    <div style={{ marginBottom: '18px' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Parâmetros:</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {details.parameters.map((param: any) => (
                          <div key={param.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                            <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{param.name}</span>
                            <span style={{ color: '#64748b' }}>({param.in})</span>
                            {param.required && <span style={{ color: '#ef4444', fontSize: '11px' }}>obrigatório</span>}
                            <span style={{ color: '#94a3b8' }}>— {param.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Seção "Try It Out" / Console de Teste Interativo */}
                  <div style={{
                    marginTop: '20px',
                    padding: '16px',
                    backgroundColor: '#1e293b',
                    borderRadius: '8px',
                    border: '1px solid #3b82f6'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', color: '#60a5fa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Zap size={16} /> Console Interativo (Try It Out)
                      </h4>
                      <button
                        onClick={() => executeTryItOut(method, path, key)}
                        disabled={loading}
                        style={{
                          backgroundColor: loading ? '#64748b' : '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '10px 20px',
                          minHeight: '48px',
                          fontWeight: 600,
                          fontSize: '14px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        {loading ? 'Executando...' : '▶ Executar Requisição'}
                      </button>
                    </div>

                    {/* Inputs de parâmetros interativos */}
                    {path === '/jobs' && (
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '180px' }}>
                          <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                            city_id:
                          </label>
                          <input
                            type="text"
                            value={consoleParams.cityId}
                            onChange={(e) => setConsoleParams(p => ({ ...p, cityId: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '4px',
                              backgroundColor: '#0f172a',
                              color: '#fff',
                              border: '1px solid #475569'
                            }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: '180px' }}>
                          <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                            transport_modal:
                          </label>
                          <select
                            value={consoleParams.transportModal}
                            onChange={(e) => setConsoleParams(p => ({ ...p, transportModal: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '4px',
                              backgroundColor: '#0f172a',
                              color: '#fff',
                              border: '1px solid #475569'
                            }}
                          >
                            <option value="all">all</option>
                            <option value="motorcycle">motorcycle</option>
                            <option value="bicycle">bicycle</option>
                            <option value="e_bike">e_bike</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {path === '/bids/{id}/accept' && (
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '180px' }}>
                          <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                            bid_id (Path):
                          </label>
                          <input
                            type="text"
                            value={consoleParams.bidId}
                            onChange={(e) => setConsoleParams(p => ({ ...p, bidId: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '4px',
                              backgroundColor: '#0f172a',
                              color: '#fff',
                              border: '1px solid #475569'
                            }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: '180px' }}>
                          <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                            storeId (Body):
                          </label>
                          <input
                            type="text"
                            value={consoleParams.storeId}
                            onChange={(e) => setConsoleParams(p => ({ ...p, storeId: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '4px',
                              backgroundColor: '#0f172a',
                              color: '#fff',
                              border: '1px solid #475569'
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {consoleBody[path] && (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                          Payload JSON da Requisição:
                        </label>
                        <textarea
                          rows={6}
                          value={consoleBody[path]}
                          onChange={(e) => setConsoleBody(b => ({ ...b, [path]: e.target.value }))}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '10px',
                            backgroundColor: '#0f172a',
                            color: '#38bdf8',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            borderRadius: '4px',
                            border: '1px solid #475569'
                          }}
                        />
                      </div>
                    )}

                    {/* Exibição do Resultado da Chamada */}
                    {result && (
                      <div style={{
                        marginTop: '16px',
                        padding: '14px',
                        backgroundColor: '#0f172a',
                        borderRadius: '6px',
                        border: '1px solid #334155'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>Status HTTP:</span>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '12px',
                            backgroundColor: result.status >= 200 && result.status < 300 ? '#059669' : '#dc2626',
                            color: '#fff'
                          }}>
                            {result.status}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            ({result.durationMs}ms)
                          </span>
                        </div>

                        <pre style={{
                          margin: 0,
                          padding: '10px',
                          backgroundColor: '#020617',
                          borderRadius: '4px',
                          color: result.status >= 400 ? '#fca5a5' : '#86efac',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          overflowX: 'auto'
                        }}>
                          {JSON.stringify(result.body, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
