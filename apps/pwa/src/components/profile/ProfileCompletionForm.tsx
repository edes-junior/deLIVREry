/**
 * @file ProfileCompletionForm.tsx
 * @description Formulário PWA mobile-first para complementação cadastral e ativação de perfil.
 * Suporta Entregadores e Lojistas com validação rigorosa de CPF, telefones com DDD e árvore geográfica nacional (FR-2, AD-8, NFR-9).
 */

import React, { useState, useEffect } from 'react';
import { validateCPF, formatCPF, validatePhone, formatPhone } from '../../profile/cpf-validator.ts';
import { GeographyService, StateItem, CityItem, NeighborhoodItem } from '../../geography/geography-service.ts';
import { ProfileService, TransportModal } from '../../profile/profile-service.ts';
import { ReferralService } from '../../referral/referral-service.ts';
import { Card } from '../ui/Card.tsx';
import { Button } from '../ui/Button.tsx';
import { Badge } from '../ui/Badge.tsx';

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

  // Carrega lista de estados e recupera referral_code do storage ao montar
  useEffect(() => {
    const loadedStates = GeographyService.getStates();
    setStates(loadedStates);
    if (loadedStates.length > 0) {
      handleStateChange('SP');
    }

    const storedRef = ReferralService.getStoredReferralCode();
    if (storedRef && !referralCodeInput) {
      setReferralCodeInput(storedRef);
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
      ? GeographyService.createCustomNeighborhood(selectedCity, customNeighborhood.trim()).id
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
    <Card
      variant="raised"
      style={{
        maxWidth: '520px',
        width: '100%',
        margin: '0 auto',
        padding: '24px 18px',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <Badge variant="quorum" style={{ marginBottom: '8px' }}>
          ATIVAR CONTA NO BAIRRO
        </Badge>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
          Complete seu Cadastro
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
          Conectado como: <strong style={{ color: 'var(--text-primary)' }}>{userEmail}</strong>
        </p>
      </div>

      {/* Seletor de Tipo de Usuário (Entregador vs Lojista) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: '10px',
          marginBottom: '20px'
        }}
      >
        <button
          type="button"
          onClick={() => setUserType('courier')}
          style={{
            minHeight: '52px',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            border: userType === 'courier' ? '2px solid var(--neon-emerald)' : '1px solid var(--border-subtle)',
            backgroundColor: userType === 'courier' ? 'rgba(0, 245, 155, 0.12)' : 'var(--bg-surface)',
            color: userType === 'courier' ? 'var(--neon-emerald)' : 'var(--text-secondary)',
            fontWeight: 800,
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          🛵 Sou Entregador
        </button>

        <button
          type="button"
          onClick={() => setUserType('store')}
          style={{
            minHeight: '52px',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            border: userType === 'store' ? '2px solid var(--highvis-yellow)' : '1px solid var(--border-subtle)',
            backgroundColor: userType === 'store' ? 'var(--highvis-yellow-dim)' : 'var(--bg-surface)',
            color: userType === 'store' ? 'var(--highvis-yellow)' : 'var(--text-secondary)',
            fontWeight: 800,
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          🏪 Sou Comerciante
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Dados Pessoais */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {userType === 'courier' ? 'Nome Completo' : 'Nome do Responsável'} *
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ex: Carlos Silva"
            className="tactical-input"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              CPF *
            </label>
            <input
              type="text"
              required
              maxLength={14}
              value={cpf}
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
              className="tactical-input"
              style={{
                borderColor: cpfError ? '#ef4444' : undefined,
                fontFamily: 'var(--font-mono)'
              }}
            />
            {cpfError && (
              <span style={{ display: 'block', color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>
                {cpfError}
              </span>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Celular com DDD *
            </label>
            <input
              type="text"
              required
              maxLength={15}
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(11) 98765-4321"
              className="tactical-input"
              style={{
                borderColor: phoneError ? '#ef4444' : undefined,
                fontFamily: 'var(--font-mono)'
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
        <div
          style={{
            marginBottom: '16px',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-base)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--neon-emerald)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📍 Região de Atuação
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '80px minmax(0, 1fr)', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                UF
              </label>
              <select
                value={selectedState}
                onChange={(e) => handleStateChange(e.target.value)}
                className="tactical-input"
                style={{ padding: '0 8px' }}
              >
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Cidade
              </label>
              <select
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                className="tactical-input"
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
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Bairro Principal
            </label>
            {!isCustomNeighborhood ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={selectedNeighborhood}
                  onChange={(e) => setSelectedNeighborhood(e.target.value)}
                  className="tactical-input"
                  style={{ flex: 1 }}
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
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-surface-raised)',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 700,
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
                  placeholder="Nome do seu bairro"
                  className="tactical-input"
                  style={{ flex: 1, borderColor: 'var(--neon-emerald)' }}
                />
                <button
                  type="button"
                  onClick={() => setIsCustomNeighborhood(false)}
                  style={{
                    minHeight: '48px',
                    padding: '0 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-surface-raised)',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 700,
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
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Como você vai fazer entregas? *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBottom: '14px' }}>
              {[
                { id: 'motorcycle', label: 'Moto', icon: '🏍️' },
                { id: 'bicycle', label: 'Bike', icon: '🚲' },
                { id: 'ebike_scooter', label: 'E-Bike', icon: '⚡' }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTransportModal(m.id as TransportModal)}
                  style={{
                    minHeight: '48px',
                    padding: '6px',
                    borderRadius: 'var(--radius-md)',
                    border: transportModal === m.id ? '2px solid var(--neon-emerald)' : '1px solid var(--border-subtle)',
                    backgroundColor: transportModal === m.id ? 'rgba(0, 245, 155, 0.15)' : 'var(--bg-surface)',
                    color: transportModal === m.id ? 'var(--neon-emerald)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <span>{m.icon}</span> <span>{m.label}</span>
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Diária pretendida (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5.00"
                  value={baseDailyRate}
                  onChange={(e) => setBaseDailyRate(e.target.value)}
                  className="tactical-input tabular-price"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Taxa por entrega (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1.00"
                  value={baseDeliveryFee}
                  onChange={(e) => setBaseDeliveryFee(e.target.value)}
                  className="tactical-input tabular-price"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Código de indicação de colega (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: LIVRE-M84KD2"
                value={referralCodeInput}
                onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                className="tactical-input"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>
        )}

        {/* Campos de Comerciante */}
        {userType === 'store' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Nome da Loja ou Restaurante *
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ex: Pizzaria Forno Nobre"
                className="tactical-input"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Rua ou Avenida
                </label>
                <input
                  type="text"
                  value={addressStreet}
                  onChange={(e) => setAddressStreet(e.target.value)}
                  placeholder="Ex: Rua das Flores"
                  className="tactical-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Número
                </label>
                <input
                  type="text"
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                  placeholder="Ex: 120"
                  className="tactical-input"
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
              borderRadius: 'var(--radius-md)',
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
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(0, 245, 155, 0.15)',
              border: '1px solid var(--neon-emerald)',
              color: 'var(--neon-emerald)',
              fontSize: '13px',
              marginBottom: '16px'
            }}
          >
            ✅ {successMessage}
          </div>
        )}

        {/* Botão de Envio */}
        <Button
          variant="cta"
          disabled={isLoading}
          style={{ width: '100%' }}
        >
          {isLoading ? 'Salvando Perfil...' : 'Cadastrar e Começar Agora'}
        </Button>
      </form>
    </Card>
  );
};
