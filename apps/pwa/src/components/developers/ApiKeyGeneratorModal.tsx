import React, { useState } from 'react';
import { generateApiKey, hashApiKey } from '../../../../../packages/api-client-sdk/src/index.js';
import { ApiGatewayService } from '../../api/gateway/api-gateway-service.ts';
import { supabase } from '../../lib/supabase.ts';
import type { ApiClient } from '../../api/gateway/types.ts';

interface ApiKeyGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyGenerated?: (key: string, client: ApiClient) => void;
}

export const ApiKeyGeneratorModal: React.FC<ApiKeyGeneratorModalProps> = ({
  isOpen,
  onClose,
  onKeyGenerated
}) => {
  const [clientName, setClientName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [isNational, setIsNational] = useState(true);
  const [customCities, setCustomCities] = useState('sao_paulo, rio_de_janeiro');
  const [rateLimitRpm, setRateLimitRpm] = useState<number>(120);

  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!clientName.trim()) {
      setErrorMsg('O nome do cliente ou aplicação integradora é obrigatório.');
      return;
    }

    if (!ownerEmail.trim() || !ownerEmail.includes('@')) {
      setErrorMsg('Um e-mail de contato técnico válido é obrigatório.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Determina as cidades autorizadas
      let allowedCities: string[] = ['*'];
      if (!isNational) {
        allowedCities = customCities
          .split(',')
          .map(c => c.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'))
          .filter(Boolean);

        if (allowedCities.length === 0) {
          allowedCities = ['*'];
        }
      }

      // 2. Gera chave em texto plano e calcula hash SHA-256
      const rawApiKey = generateApiKey('dlv_live', 24);
      const apiKeyHash = hashApiKey(rawApiKey);
      const clientId = `client_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

      const newClient: ApiClient = {
        id: clientId,
        clientName: clientName.trim(),
        apiKeyHash,
        ownerEmail: ownerEmail.trim(),
        allowedCities,
        rateLimitRpm,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      // 3. Registra no serviço do Gateway em memória para uso imediato
      ApiGatewayService.registerMockClient(newClient);

      // 4. Se Supabase estiver conectado, persiste no banco
      if (supabase) {
        try {
          await supabase.from('api_clients').insert({
            id: clientId,
            client_name: newClient.clientName,
            api_key_hash: newClient.apiKeyHash,
            owner_email: newClient.ownerEmail,
            allowed_cities: newClient.allowedCities,
            rate_limit_rpm: newClient.rateLimitRpm,
            is_active: true
          });
        } catch {
          // Mantém integridade em mock local
        }
      }

      setGeneratedKey(rawApiKey);
      if (onKeyGenerated) {
        onKeyGenerated(rawApiKey, newClient);
      }

      // Haptic feedback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([20]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao emitir API Key.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(generatedKey);
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([15]);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        borderRadius: '16px',
        border: '1px solid #334155',
        width: '100%',
        maxWidth: '540px',
        padding: '28px',
        color: '#f8fafc',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#60a5fa' }}>
            🔑 Emissão de Nova API Key
          </h3>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              minWidth: '48px',
              minHeight: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {!generatedKey ? (
          <form onSubmit={handleGenerateKey} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {errorMsg && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px'
              }}>
                {errorMsg}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Nome do Integrador ou Sistema:
              </label>
              <input
                type="text"
                placeholder="Ex: PDV Soft, Cardápio Web, Portal Pref. SP"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
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
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                E-mail do Responsável Técnico:
              </label>
              <input
                type="email"
                placeholder="dev@parceiro.com.br"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
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
              />
            </div>

            {/* Escopo Geográfico */}
            <div style={{
              backgroundColor: '#0f172a',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid #334155'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isNational}
                  onChange={(e) => setIsNational(e.target.checked)}
                  style={{ width: '20px', height: '20px' }}
                />
                <span style={{ fontWeight: 600 }}>Acesso Nacional Irrestrito (*)</span>
              </label>

              {!isNational && (
                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                    Cidades autorizadas (separadas por vírgula):
                  </label>
                  <input
                    type="text"
                    value={customCities}
                    onChange={(e) => setCustomCities(e.target.value)}
                    placeholder="sao_paulo, rio_de_janeiro, campinas"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#1e293b',
                      color: '#fff',
                      border: '1px solid #475569',
                      fontSize: '13px',
                      minHeight: '48px'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Limite de Taxa (RPM) */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Plano / Limite de Requisições por Minuto (RPM):
              </label>
              <select
                value={rateLimitRpm}
                onChange={(e) => setRateLimitRpm(Number(e.target.value))}
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
                <option value={120}>Plano Parceiro Comunitário (120 RPM Free)</option>
                <option value={600}>Plano Enterprise / Municipal (600 RPM)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '12px',
                  minHeight: '48px',
                  backgroundColor: '#334155',
                  color: '#f8fafc',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  minHeight: '48px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {isLoading ? 'Emitindo...' : '✨ Gerar API Key'}
              </button>
            </div>
          </form>
        ) : (
          /* Visualização da Chave Gerada */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              borderRadius: '8px',
              padding: '14px',
              color: '#a7f3d0',
              fontSize: '14px'
            }}>
              ✅ <strong>API Key gerada com sucesso!</strong> Armazene-a em local seguro. Por motivos de segurança, ela <strong>não poderá ser visualizada novamente</strong>.
            </div>

            <div style={{
              backgroundColor: '#0f172a',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid #475569',
              wordBreak: 'break-all',
              fontFamily: 'monospace',
              fontSize: '15px',
              color: '#38bdf8'
            }}>
              {generatedKey}
            </div>

            <button
              type="button"
              onClick={handleCopyKey}
              style={{
                width: '100%',
                padding: '14px',
                minHeight: '48px',
                backgroundColor: copied ? '#059669' : '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color 0.2s'
              }}
            >
              {copied ? '✔ Chave Copiada para a Área de Transferência!' : '📋 Copiar API Key'}
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '12px',
                minHeight: '48px',
                backgroundColor: '#334155',
                color: '#f8fafc',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Concluir e Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
