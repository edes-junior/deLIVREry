/**
 * @file ProfileCompletionForm.tsx
 * @description Formulário PWA mobile-first para complementação cadastral e ativação de perfil.
 * Suporta Entregadores e Lojistas com validação rigorosa de CPF, telefones com DDD e árvore geográfica nacional (FR-2, AD-8, NFR-9).
 */

import React, { useState, useEffect } from 'react';
import { validateCPF, formatCPF, validatePhone, formatPhone } from '../../profile/cpf-validator.ts';
import { GeographyService, StateItem, CityItem, NeighborhoodItem } from '../../geography/geography-service.ts';
import { ProfileService, TransportModal } from '../../profile/profile-service.ts';

interface ProfileCompletionFormProps {
  userId: string;
  userEmail: string;
  onProfileCompleted: (data: any) => void;
}

export const ProfileCompletionForm: React.FC<ProfileCompletionFormProps> = ({
  userId,
  userEmail,
  onProfileCompleted
}) => {
  // Tipo de Usuário: 'courier' ou 'store'
  const [userType, setUserType] = useState<'courier' | 'store'>('courier');

  // Dados Pessoais / Civis
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Árvore Geográfica
  const [states, setStates] = useState<StateItem[]>([]);
  const [selectedState, setSelectedState] = useState<string>('SP');
  const [cities, setCities] = useState<CityItem[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodItem[]>([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('');
  const [customNeighborhood, setCustomNeighborhood] = useState<string>('');
  const [isCustomNeighborhood, setIsCustomNeighborhood] = useState<boolean>(false);

  // Campos específicos de Entregador
  const [transportModal, setTransportModal] = useState<TransportModal>('motorcycle');
  const [baseDailyRate, setBaseDailyRate] = useState<string>('120.00');
  const [baseDeliveryFee, setBaseDeliveryFee] = useState<string>('8.00');
  const [referralCodeInput, setReferralCodeInput] = useState<string>('');

  // Campos específicos de Lojista
  const [storeName, setStoreName] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');

  // Estados de Controle de UI
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Carrega lista de estados ao montar
  useEffect(() => {
    const loadedStates = GeographyService.getStates();
    setStates(loadedStates);
    if (loadedStates.length > 0) {
      handleStateChange('SP');
    }
  }, []);

  const handleStateChange = (stateId: string) => {
    setSelectedState(stateId);
    const loadedCities = GeographyService.getCitiesByState(stateId);
    setCities(loadedCities);
    if (loadedCities.length > 0) {
      handleCityChange(loadedCities[0].id);
    } else {
      setSelectedCity('');
      setNeighborhoods([]);
      setSelectedNeighborhood('');
    }
  };

  const handleCityChange = (cityId: string) => {
    setSelectedCity(cityId);
    const loadedNeighborhoods = GeographyService.getNeighborhoodsByCity(cityId);
    setNeighborhoods(loadedNeighborhoods);
    if (loadedNeighborhoods.length > 0) {
      setSelectedNeighborhood(loadedNeighborhoods[0].id);
      setIsCustomNeighborhood(false);
    } else {
      setSelectedNeighborhood('');
      setIsCustomNeighborhood(true);
    }
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);
    if (formatted.length === 14) {
      if (!validateCPF(formatted)) {
        setCpfError('CPF inválido. Verifique os dígitos digitados.');
      } else {
        setCpfError(null);
      }
    } else {
      setCpfError(null);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
    if (formatted.length === 15) {
      if (!validatePhone(formatted)) {
        setPhoneError('Telefone inválido. Utilize DDD válido e 9 dígitos.');
      } else {
        setPhoneError(null);
      }
    } else {
      setPhoneError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validações imediatas
    if (!fullName || fullName.trim().length < 3) {
      setErrorMessage('Informe seu nome completo.');
      return;
    }

    if (!validateCPF(cpf)) {
      setCpfError('CPF inválido. Verifique os dígitos digitados.');
      setErrorMessage('Por favor, corrija o CPF informado.');
      return;
    }

    if (!validatePhone(phone)) {
      setPhoneError('Telefone inválido. Utilize DDD e 9 dígitos.');
      setErrorMessage('Por favor, informe um telefone celular válido com DDD.');
      return;
    }

    const neighborhoodFinalId = isCustomNeighborhood
      ? customNeighborhood.trim()
      : selectedNeighborhood;

    if (!neighborhoodFinalId) {
      setErrorMessage('Selecione ou informe seu bairro de atuação.');
      return;
    }

    setIsLoading(true);

    try {
      if (userType === 'courier') {
        const result = await ProfileService.completeCourierProfile({
          userId,
          fullName,
          cpf,
          phoneNumber: phone,
          transportModal,
          baseDailyRate: parseFloat(baseDailyRate) || 0,
          baseDeliveryFee: parseFloat(baseDeliveryFee) || 0,
          stateId: selectedState,
          cityId: selectedCity,
          homeNeighborhoodId: neighborhoodFinalId,
          referredByCode: referralCodeInput.trim() || undefined
        });

        setSuccessMessage('Perfil de entregador ativado com sucesso!');
        onProfileCompleted(result);
      } else {
        if (!storeName || storeName.trim().length < 2) {
          setErrorMessage('Informe o nome da sua loja ou estabelecimento.');
          setIsLoading(false);
          return;
        }

        const result = await ProfileService.completeStoreProfile({
          userId,
          fullName,
          cpf,
          phoneNumber: phone,
          storeName,
          addressStreet,
          addressNumber,
          stateId: selectedState,
          cityId: selectedCity,
          neighborhoodId: neighborhoodFinalId
        });

        setSuccessMessage('Perfil de lojista ativado com sucesso!');
        onProfileCompleted(result);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado ao salvar perfil.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '520px',
        margin: '0 auto',
        padding: '24px 20px',
        backgroundColor: '#131822',
        color: '#f3f4f6',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '9999px',
            backgroundColor: '#1e293b',
            color: '#38bdf8',
            fontSize: '12px',
            fontWeight: 600,
            marginBottom: '8px'
          }}
        >
          ONBOARDING UNIVERSAL
        </span>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 700 }}>
          Complete seu Perfil
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
          Conectado como: <strong>{userEmail}</strong>
        </p>
      </div>

      {/* Seletor de Tipo de Usuário (Entregador vs Lojista) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '24px'
        }}
      >
        <button
          type="button"
          onClick={() => setUserType('courier')}
          style={{
            minHeight: '48px',
            padding: '12px',
            borderRadius: '12px',
            border: userType === 'courier' ? '2px solid #38bdf8' : '1px solid #334155',
            backgroundColor: userType === 'courier' ? 'rgba(56, 189, 248, 0.15)' : '#1e293b',
            color: userType === 'courier' ? '#38bdf8' : '#cbd5e1',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s ease'
          }}
        >
          🛵 Sou Entregador
        </button>

        <button
          type="button"
          onClick={() => setUserType('store')}
          style={{
            minHeight: '48px',
            padding: '12px',
            borderRadius: '12px',
            border: userType === 'store' ? '2px solid #10b981' : '1px solid #334155',
            backgroundColor: userType === 'store' ? 'rgba(16, 185, 129, 0.15)' : '#1e293b',
            color: userType === 'store' ? '#10b981' : '#cbd5e1',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s ease'
          }}
        >
          🏪 Sou Lojista
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Dados Civis */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
            {userType === 'courier' ? 'Nome Completo' : 'Nome do Responsável'} *
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ex: Carlos Silva"
            style={{
              width: '100%',
              minHeight: '48px',
              padding: '0 14px',
              borderRadius: '8px',
              border: '1px solid #334155',
              backgroundColor: '#0f172a',
              color: '#fff',
              fontSize: '15px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
              CPF *
            </label>
            <input
              type="text"
              required
              maxLength={14}
              value={cpf}
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
              style={{
                width: '100%',
                minHeight: '48px',
                padding: '0 12px',
                borderRadius: '8px',
                border: cpfError ? '1px solid #ef4444' : '1px solid #334155',
                backgroundColor: '#0f172a',
                color: '#fff',
                fontSize: '15px',
                boxSizing: 'border-box'
              }}
            />
            {cpfError && (
              <span style={{ display: 'block', color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>
                {cpfError}
              </span>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
              Celular com DDD *
            </label>
            <input
              type="text"
              required
              maxLength={15}
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(11) 98765-4321"
              style={{
                width: '100%',
                minHeight: '48px',
                padding: '0 12px',
                borderRadius: '8px',
                border: phoneError ? '1px solid #ef4444' : '1px solid #334155',
                backgroundColor: '#0f172a',
                color: '#fff',
                fontSize: '15px',
                boxSizing: 'border-box'
              }}
            />
            {phoneError && (
              <span style={{ display: 'block', color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>
                {phoneError}
              </span>
            )}
          </div>
        </div>

        {/* Localização Geográfica em Cascata */}
        <div style={{ marginBottom: '16px', padding: '14px', borderRadius: '10px', backgroundColor: '#1e293b' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8', marginBottom: '12px' }}>
            📍 Micro-Região de Atuação
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#94a3b8' }}>
                UF
              </label>
              <select
                value={selectedState}
                onChange={(e) => handleStateChange(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  padding: '0 8px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  fontSize: '15px'
                }}
              >
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#94a3b8' }}>
                Cidade / Município
              </label>
              <select
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  fontSize: '14px'
                }}
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#94a3b8' }}>
              Bairro Principal
            </label>
            {!isCustomNeighborhood ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={selectedNeighborhood}
                  onChange={(e) => setSelectedNeighborhood(e.target.value)}
                  style={{
                    flex: 1,
                    minHeight: '48px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                >
                  {neighborhoods.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCustomNeighborhood(true)}
                  style={{
                    minHeight: '48px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #475569',
                    backgroundColor: '#334155',
                    color: '#cbd5e1',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Outro
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={customNeighborhood}
                  onChange={(e) => setCustomNeighborhood(e.target.value)}
                  placeholder="Digite o nome do seu bairro"
                  style={{
                    flex: 1,
                    minHeight: '48px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #38bdf8',
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setIsCustomNeighborhood(false)}
                  style={{
                    minHeight: '48px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #475569',
                    backgroundColor: '#334155',
                    color: '#cbd5e1',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Voltar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Campos de Entregador */}
        {userType === 'courier' && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500 }}>
              Modal de Transporte *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {[
                { id: 'motorcycle', label: 'Moto', icon: '🏍️' },
                { id: 'bicycle', label: 'Bicicleta', icon: '🚲' },
                { id: 'ebike_scooter', label: 'E-Bike', icon: '⚡' }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTransportModal(m.id as TransportModal)}
                  style={{
                    minHeight: '48px',
                    padding: '8px',
                    borderRadius: '8px',
                    border: transportModal === m.id ? '2px solid #38bdf8' : '1px solid #334155',
                    backgroundColor: transportModal === m.id ? 'rgba(56, 189, 248, 0.2)' : '#0f172a',
                    color: transportModal === m.id ? '#38bdf8' : '#cbd5e1',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#94a3b8' }}>
                  Diária Base Pretendida (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5.00"
                  value={baseDailyRate}
                  onChange={(e) => setBaseDailyRate(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '48px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#94a3b8' }}>
                  Taxa por Entrega (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1.00"
                  value={baseDeliveryFee}
                  onChange={(e) => setBaseDeliveryFee(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '48px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#94a3b8' }}>
                Código de Indicação (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: LIVRE-M84KD2"
                value={referralCodeInput}
                onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        )}

        {/* Campos de Lojista */}
        {userType === 'store' && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
                Nome da Loja / Fantasia *
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ex: Pizzaria Forno Nobre"
                style={{
                  width: '100%',
                  minHeight: '48px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  fontSize: '15px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#94a3b8' }}>
                  Rua / Logradouro
                </label>
                <input
                  type="text"
                  value={addressStreet}
                  onChange={(e) => setAddressStreet(e.target.value)}
                  placeholder="Ex: Rua das Flores"
                  style={{
                    width: '100%',
                    minHeight: '48px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#94a3b8' }}>
                  Número
                </label>
                <input
                  type="text"
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                  placeholder="Ex: 120"
                  style={{
                    width: '100%',
                    minHeight: '48px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Mensagens de Feedback */}
        {errorMessage && (
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              fontSize: '13px',
              marginBottom: '16px'
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              color: '#6ee7b7',
              fontSize: '13px',
              marginBottom: '16px'
            }}
          >
            ✅ {successMessage}
          </div>
        )}

        {/* Botão de Envio (Alvo de toque >= 48px) */}
        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: '100%',
            minHeight: '52px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: userType === 'courier' ? '#0284c7' : '#059669',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '16px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
            transition: 'background-color 0.2s ease',
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
          }}
        >
          {isLoading ? 'Salvando Perfil...' : 'Finalizar Cadastro e Ativar Perfil'}
        </button>
      </form>
    </div>
  );
};
