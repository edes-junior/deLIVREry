import React, { useState, useEffect, useRef } from 'react';
import '../../../../../packages/embed-widget/src/delivrery-button.js';
import { Code2, Settings, Radio, Copy, Check } from 'lucide-react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'delivrery-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'client-id'?: string;
        'city-id'?: string;
        'neighborhood-id'?: string;
        'store-name'?: string;
        'label'?: string;
        'text'?: string;
        'theme'?: string;
        'mode'?: string;
        'base-rate'?: string | number;
      };
    }
  }
}

interface EventLogEntry {
  id: string;
  type: string;
  timestamp: string;
  detail: any;
}

export const EmbedWidgetPlayground: React.FC = () => {
  const [clientId, setClientId] = useState('dlv_test_sample99');
  const [cityId, setCityId] = useState('sao_paulo');
  const [neighborhoodId, setNeighborhoodId] = useState('Pinheiros');
  const [storeName, setStoreName] = useState('Pizzaria Bella Roma');
  const [label, setLabel] = useState('Pedir Motoboy Livre');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mode, setMode] = useState<'modal' | 'redirect' | 'event'>('modal');
  const [baseRate, setBaseRate] = useState('14.50');
  const [eventLogs, setEventLogs] = useState<EventLogEntry[]>([]);
  const [copied, setCopied] = useState(false);

  const widgetContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = widgetContainerRef.current;
    if (!container) return;

    const handleCustomEvent = (e: Event) => {
      const customEvt = e as CustomEvent;
      const entry: EventLogEntry = {
        id: Math.random().toString(36).substring(2, 9),
        type: e.type,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        detail: customEvt.detail
      };
      setEventLogs(prev => [entry, ...prev.slice(0, 19)]);
    };

    container.addEventListener('delivrery:click', handleCustomEvent);
    container.addEventListener('delivrery:submit', handleCustomEvent);
    container.addEventListener('delivrery:close', handleCustomEvent);

    return () => {
      container.removeEventListener('delivrery:click', handleCustomEvent);
      container.removeEventListener('delivrery:submit', handleCustomEvent);
      container.removeEventListener('delivrery:close', handleCustomEvent);
    };
  }, []);

  const generatedHtmlSnippet = `<!-- 1. Importação do Web Component nativo deLIVREry (< 50ms de montagem) -->
<script type="module" src="https://cdn.delivrery.app.br/embed/delivrery-button.js"></script>

<!-- 2. Tag declarativa customizada -->
<delivrery-button
  client-id="${clientId}"
  city-id="${cityId}"
  neighborhood-id="${neighborhoodId}"
  store-name="${storeName}"
  label="${label}"
  theme="${theme}"
  mode="${mode}"
  base-rate="${baseRate}">
</delivrery-button>

<!-- 3. (Opcional) Captura de Eventos DOM da Entrega -->
<script>
  const btn = document.querySelector('delivrery-button');
  btn.addEventListener('delivrery:submit', (e) => {
    console.log('Entrega solicitada via deLIVREry:', e.detail);
    // Ex: salvar ID da entrega no seu PDV ou cardápio
  });
</script>`;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(generatedHtmlSnippet);
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([20]);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClearLogs = () => {
    setEventLogs([]);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      backgroundColor: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '12px',
      padding: '24px'
    }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Code2 size={24} style={{ color: '#60a5fa', flexShrink: 0 }} />
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#60a5fa' }}>
            Playground & Gerador do Web Component (<code style={{ fontFamily: 'monospace' }}>&lt;delivrery-button /&gt;</code>)
          </h2>
        </div>
        <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>
          Incorpore o botão de solicitação de entrega descentralizada em qualquer cardápio digital, PDV web ou e-commerce com zero dependências de runtime, isolamento via Shadow DOM e conformidade ergonômica NFR-9.
        </p>
      </div>

      {/* Grid Principal: Configuração & Preview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px'
      }}>
        {/* Painel Esquerdo: Controles Interativos */}
        <div style={{
          backgroundColor: '#0f172a',
          padding: '20px',
          borderRadius: '10px',
          border: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc', borderBottom: '1px solid #1e293b', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} /> Atributos Declarativos
          </h3>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
              Texto do Botão (label):
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                minHeight: '48px',
                borderRadius: '6px',
                border: '1px solid #334155',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                Tema Visual:
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  minHeight: '48px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="dark">Escuro (Dark)</option>
                <option value="light">Claro (Light)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                Modo de Ação:
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'modal' | 'redirect' | 'event')}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  minHeight: '48px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="modal">Modal Integrado (modal)</option>
                <option value="redirect">Redirecionamento (redirect)</option>
                <option value="event">Apenas Evento DOM (event)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                Estabelecimento (store-name):
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  minHeight: '48px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                Tarifa Base (R$):
              </label>
              <input
                type="number"
                step="0.50"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  minHeight: '48px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                Município (city-id):
              </label>
              <select
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  minHeight: '48px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="sao_paulo">São Paulo (SP)</option>
                <option value="rio_de_janeiro">Rio de Janeiro (RJ)</option>
                <option value="belo_horizonte">Belo Horizonte (MG)</option>
                <option value="curitiba">Curitiba (PR)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                Bairro (neighborhood-id):
              </label>
              <input
                type="text"
                value={neighborhoodId}
                onChange={(e) => setNeighborhoodId(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  minHeight: '48px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
              Identificador do Cliente API (client-id):
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                minHeight: '48px',
                borderRadius: '6px',
                border: '1px solid #334155',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                fontSize: '14px',
                fontFamily: 'monospace'
              }}
            />
          </div>
        </div>

        {/* Painel Direito: Preview ao Vivo & Log de Eventos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Card de Preview */}
          <div style={{
            backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc',
            color: theme === 'dark' ? '#f8fafc' : '#0f172a',
            border: '2px dashed #475569',
            borderRadius: '10px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '180px',
            transition: 'background-color 0.3s ease'
          }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', marginBottom: '16px', fontWeight: 700 }}>
              Preview Interativo em Tempo Real (Shadow DOM)
            </span>

            {/* Container onde o custom element é renderizado */}
            <div ref={widgetContainerRef}>
              <delivrery-button
                client-id={clientId}
                city-id={cityId}
                neighborhood-id={neighborhoodId}
                store-name={storeName}
                label={label}
                theme={theme}
                mode={mode}
                base-rate={baseRate}
              />
            </div>

            <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '14px' }}>
              Clique no botão para disparar ações ou abrir o modal integrado.
            </span>
          </div>

          {/* Console de Eventos Customizados */}
          <div style={{
            backgroundColor: '#0f172a',
            borderRadius: '10px',
            border: '1px solid #334155',
            padding: '16px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Radio size={16} /> Monitor de Eventos DOM ({eventLogs.length})
              </span>
              {eventLogs.length > 0 && (
                <button
                  onClick={handleClearLogs}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: '4px 8px'
                  }}
                >
                  Limpar
                </button>
              )}
            </div>

            <div style={{
              flex: 1,
              maxHeight: '160px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {eventLogs.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic', padding: '10px 0' }}>
                  Aguardando eventos (clique no botão acima para testar)...
                </div>
              ) : (
                eventLogs.map((log) => (
                  <div key={log.id} style={{
                    backgroundColor: '#1e293b',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a7f3d0' }}>
                      <strong>{log.type}</strong>
                      <span style={{ color: '#94a3b8' }}>{log.timestamp}</span>
                    </div>
                    <div style={{ color: '#cbd5e1', marginTop: '4px', overflowX: 'auto' }}>
                      {JSON.stringify(log.detail)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Snippet de Integração HTML para o Integrador */}
      <div style={{
        backgroundColor: '#0f172a',
        padding: '20px',
        borderRadius: '10px',
        border: '1px solid #334155',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Copy size={18} /> Código de Integração Pronto (Copy & Paste)
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
              Cole diretamente no arquivo HTML do seu cardápio ou PDV.
            </p>
          </div>

          <button
            onClick={handleCopy}
            style={{
              padding: '10px 18px',
              minHeight: '48px',
              backgroundColor: copied ? '#059669' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background-color 0.2s ease'
            }}
          >
            {copied ? (
              <>
                <Check size={18} /> Código Copiado!
              </>
            ) : (
              <>
                <Copy size={18} /> Copiar Snippet HTML
              </>
            )}
          </button>
        </div>

        <pre style={{
          margin: 0,
          padding: '16px',
          backgroundColor: '#020617',
          borderRadius: '8px',
          color: '#38bdf8',
          fontFamily: 'monospace',
          fontSize: '13px',
          overflowX: 'auto',
          lineHeight: 1.5
        }}>
          {generatedHtmlSnippet}
        </pre>
      </div>
    </div>
  );
};

export default EmbedWidgetPlayground;
