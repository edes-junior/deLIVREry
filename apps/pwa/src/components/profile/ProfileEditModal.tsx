/**
 * @file ProfileEditModal.tsx
 * @description Modal de edição de dados cadastrais para entregadores e lojistas (Story 1 / CAP-1 / CAP-6).
 * Garante a imutabilidade do CPF e tipo de conta, permitindo atualização de dados de contato,
 * modal de transporte, estabelecimento e bairro de atuação com recálculo de quórum.
 */

import React, { useState, useEffect, useRef } from 'react';
import { validatePhone, formatPhone } from '../../profile/cpf-validator.ts';
import { GeographyService, StateItem, CityItem, NeighborhoodItem } from '../../geography/geography-service.ts';
import { fetchAddressByCep, formatCEP, cleanCEP } from '../../geography/cep-service.ts';
import { GeolocationService } from '../../geography/geolocation-service.ts';
import { 
  ProfileService, 
  UserProfileResponse, 
  TransportModal, 
  UpdateCourierProfileDTO, 
  UpdateStoreProfileDTO 
} from '../../profile/profile-service.ts';
import { Button } from '../ui/Button.tsx';
import { AvatarUpload } from './AvatarUpload.tsx';
import { X, AlertTriangle, Lock, Bike, Zap, Save, Crosshair, Loader2 } from 'lucide-react';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileData: UserProfileResponse;
  onProfileUpdated: (updatedProfile: UserProfileResponse) => void;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  isOpen,
  onClose,
  profileData,
  onProfileUpdated
}) => {
  const isCourier = profileData.user.userType === 'courier';

  // Campos Pessoais / Gerais
  const [fullName, setFullName] = useState(profileData.user.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(profileData.user.phoneNumber || '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profileData.user.avatarUrl || null);

  const handleAvatarUploaded = (newUrl: string) => {
    setAvatarUrl(newUrl);
    onProfileUpdated({
      ...profileData,
      user: {
        ...profileData.user,
        avatarUrl: newUrl
      }
    });
  };

  // Campos de Entregador
  const [transportModal, setTransportModal] = useState<TransportModal>(
    (profileData.profile?.transport_modal as TransportModal) || 'motorcycle'
  );

  // Campos de Lojista
  const [storeName, setStoreName] = useState(profileData.profile?.store_name || '');
  const [postalCode, setPostalCode] = useState(profileData.profile?.postal_code || '');
  const [addressStreet, setAddressStreet] = useState(profileData.profile?.address_street || '');
  const [addressNumber, setAddressNumber] = useState(profileData.profile?.address_number || '');
  const [addressComplement, setAddressComplement] = useState(profileData.profile?.address_complement || '');
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  // Campos adicionais de Entregador
  const [operatingNeighborhoods, setOperatingNeighborhoods] = useState<string[]>(
    profileData.profile?.operating_neighborhoods || []
  );

  // Geolocalização
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);

  // Referência para foco no número
  const addressNumberInputRef = useRef<HTMLInputElement>(null);

  // Geografia
  const [states, setStates] = useState<StateItem[]>([]);
  const [selectedState, setSelectedState] = useState<string>(
    profileData.profile?.state_id || 'SP'
  );
  const [cities, setCities] = useState<CityItem[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>(
    profileData.profile?.city_id || ''
  );
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodItem[]>([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>(
    profileData.profile?.home_neighborhood_id || profileData.profile?.neighborhood_id || ''
  );
  const [customNeighborhood, setCustomNeighborhood] = useState<string>('');
  const [isCustomNeighborhood, setIsCustomNeighborhood] = useState<boolean>(false);

  // Estados de Controle
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inicializa árvore geográfica
  useEffect(() => {
    if (!isOpen) return;

    const loadedStates = GeographyService.getStates();
    setStates(loadedStates);

    const initialUf = profileData.profile?.state_id || 'SP';
    setSelectedState(initialUf);

    const loadedCities = GeographyService.getCitiesByState(initialUf);
    setCities(loadedCities);

    const currentCity = profileData.profile?.city_id || (loadedCities[0]?.id ?? '');
    setSelectedCity(currentCity);

    if (currentCity) {
      const loadedNeighborhoods = GeographyService.getNeighborhoodsByCity(currentCity);
      setNeighborhoods(loadedNeighborhoods);
      
      const currentBairro = profileData.profile?.home_neighborhood_id || profileData.profile?.neighborhood_id || '';
      const existsInList = loadedNeighborhoods.some(n => n.id === currentBairro);

      if (currentBairro && !existsInList) {
        setIsCustomNeighborhood(true);
        setCustomNeighborhood(currentBairro);
        setSelectedNeighborhood('custom');
      } else {
        setIsCustomNeighborhood(false);
        setSelectedNeighborhood(currentBairro || (loadedNeighborhoods[0]?.id ?? ''));
      }
    }

    setFullName(profileData.user.fullName || '');
    setPhoneNumber(profileData.user.phoneNumber || '');
    setPostalCode(profileData.profile?.postal_code || '');
    setAddressStreet(profileData.profile?.address_street || '');
    setAddressNumber(profileData.profile?.address_number || '');
    setAddressComplement(profileData.profile?.address_complement || '');
    setOperatingNeighborhoods(profileData.profile?.operating_neighborhoods || []);
    setPhoneError(null);
    setErrorMessage(null);
    setCepError(null);
    setLocationFeedback(null);
  }, [isOpen, profileData]);

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
      setSelectedNeighborhood('custom');
      setIsCustomNeighborhood(true);
    }
  };

  const handlePhoneChange = (val: string) => {
    const formatted = formatPhone(val);
    setPhoneNumber(formatted);
    if (formatted.length > 0 && !validatePhone(formatted)) {
      setPhoneError('Telefone deve conter DDD e 9 dígitos (ex: (11) 98765-4321).');
    } else {
      setPhoneError(null);
    }
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCEP(e.target.value);
    setPostalCode(formatted);
    setCepError(null);

    const clean = cleanCEP(formatted);
    if (clean.length === 8) {
      setIsSearchingCep(true);
      try {
        const res = await fetchAddressByCep(clean);
        if (res.success) {
          if (res.street) setAddressStreet(res.street);
          if (res.state) {
            setSelectedState(res.state);
            const loadedCities = GeographyService.getCitiesByState(res.state);
            setCities(loadedCities);
            const citySlug = res.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
            const matchedCity = loadedCities.find(c => c.name.toLowerCase() === res.city.toLowerCase() || c.id === citySlug);
            const activeCityId = matchedCity ? matchedCity.id : (loadedCities[0]?.id || citySlug);
            setSelectedCity(activeCityId);

            const loadedNeighborhoods = GeographyService.getNeighborhoodsByCity(activeCityId);
            setNeighborhoods(loadedNeighborhoods);

            if (res.neighborhood) {
              const neighSlug = res.neighborhood.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
              const matchedNeigh = loadedNeighborhoods.find(n => n.name.toLowerCase() === res.neighborhood.toLowerCase() || n.id.includes(neighSlug));
              if (matchedNeigh) {
                setSelectedNeighborhood(matchedNeigh.id);
                setIsCustomNeighborhood(false);
              } else {
                setIsCustomNeighborhood(true);
                setCustomNeighborhood(res.neighborhood);
              }
            }
          }
          setTimeout(() => {
            addressNumberInputRef.current?.focus();
          }, 60);
        } else {
          setCepError(res.error || 'CEP não encontrado.');
        }
      } catch {
        setCepError('Erro ao consultar CEP.');
      } finally {
        setIsSearchingCep(false);
      }
    }
  };

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setLocationFeedback(null);
    try {
      const coords = await GeolocationService.getCurrentPosition();
      const region = await GeolocationService.detectRegionFromCoordinates(coords.latitude, coords.longitude);
      if (region) {
        setSelectedState(region.stateId);
        const loadedCities = GeographyService.getCitiesByState(region.stateId);
        setCities(loadedCities);
        setSelectedCity(region.cityId);

        const loadedNeighborhoods = GeographyService.getNeighborhoodsByCity(region.cityId);
        setNeighborhoods(loadedNeighborhoods);
        setSelectedNeighborhood(region.neighborhoodId);
        setIsCustomNeighborhood(false);

        if (isCourier) {
          setOperatingNeighborhoods(prev => Array.from(new Set([...prev, region.neighborhoodId])));
        }

        setLocationFeedback(`📍 Região detectada: ${region.formattedLabel}`);
        setTimeout(() => setLocationFeedback(null), 5000);
      }
    } catch (err: any) {
      setLocationFeedback(err?.message || 'Não foi possível obter sua localização.');
      setTimeout(() => setLocationFeedback(null), 5000);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const toggleOperatingNeighborhood = (neighId: string) => {
    setOperatingNeighborhoods(prev => {
      if (prev.includes(neighId)) {
        return prev.filter(id => id !== neighId);
      } else {
        return [...prev, neighId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName || fullName.trim().length < 3) {
      setErrorMessage('O nome deve conter ao menos 3 caracteres.');
      return;
    }

    if (!validatePhone(phoneNumber)) {
      setErrorMessage('Informe um telefone celular válido com DDD.');
      return;
    }

    const effectiveNeighborhood = isCustomNeighborhood
      ? customNeighborhood.trim()
      : selectedNeighborhood;

    if (!effectiveNeighborhood) {
      setErrorMessage('Informe ou selecione seu bairro de atuação.');
      return;
    }

    setIsLoading(true);

    try {
      if (isCourier) {
        const finalOperating = Array.from(new Set([effectiveNeighborhood, ...operatingNeighborhoods]));
        const payload: UpdateCourierProfileDTO = {
          userId: profileData.user.id,
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          transportModal,
          stateId: selectedState,
          cityId: selectedCity,
          homeNeighborhoodId: effectiveNeighborhood,
          operatingNeighborhoods: finalOperating
        };

        const updated = await ProfileService.updateCourierProfile(payload);
        onProfileUpdated(updated);
        onClose();
      } else {
        if (!storeName || storeName.trim().length < 2) {
          setErrorMessage('Informe o nome do seu estabelecimento comercial.');
          setIsLoading(false);
          return;
        }

        const payload: UpdateStoreProfileDTO = {
          userId: profileData.user.id,
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          storeName: storeName.trim(),
          addressStreet: addressStreet.trim() || undefined,
          addressNumber: addressNumber.trim() || undefined,
          addressComplement: addressComplement.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
          stateId: selectedState,
          cityId: selectedCity,
          neighborhoodId: effectiveNeighborhood
        };

        const updated = await ProfileService.updateStoreProfile(payload);
        onProfileUpdated(updated);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado ao salvar alterações.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(6, 9, 14, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface, #0d121c)',
          border: '1px solid var(--border-subtle, #1e293b)',
          borderRadius: 'var(--radius-lg, 16px)',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          boxSizing: 'border-box'
        }}
        data-testid="profile-edit-modal"
      >
        {/* Header do Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>
              Editar Dados do Perfil
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary, #94a3b8)' }}>
              Atualize suas informações de contato e localização de atuação.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #64748b)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {errorMessage && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertTriangle size={15} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Seção de Upload de Foto de Perfil (Story 2 / CAP-2) */}
          <AvatarUpload
            userId={profileData.user.id}
            currentAvatarUrl={avatarUrl}
            userName={fullName || profileData.user.fullName}
            userType={profileData.user.userType}
            onAvatarUploaded={handleAvatarUploaded}
            disabled={isLoading}
          />

          {/* Seção de Dados Imutáveis (Auditoria e Segurança) */}
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: '1px dashed var(--border-subtle, #334155)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted, #64748b)' }}>
                Identificação Imutável (CAP-1)
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  backgroundColor: 'rgba(148, 163, 184, 0.15)',
                  color: '#94a3b8',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  border: '1px solid #475569',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Lock size={10} /> Bloqueado
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: '2px' }}>
                  CPF Civil
                </label>
                <input
                  type="text"
                  value={profileData.user.cpf}
                  disabled
                  readOnly
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#0a0f1d',
                    border: '1px solid #1e293b',
                    color: '#64748b',
                    fontSize: '13px',
                    cursor: 'not-allowed',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: '2px' }}>
                  Tipo de Conta
                </label>
                <input
                  type="text"
                  value={isCourier ? 'Entregador' : 'Lojista'}
                  disabled
                  readOnly
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#0a0f1d',
                    border: '1px solid #1e293b',
                    color: '#64748b',
                    fontSize: '13px',
                    cursor: 'not-allowed',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Nome Completo */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', display: 'block', marginBottom: '6px' }}>
              {isCourier ? 'Nome Completo' : 'Nome do Responsável'} *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={3}
              placeholder="Seu nome completo"
              style={{
                width: '100%',
                minHeight: '44px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#0a0f1d',
                border: '1px solid var(--border-subtle, #334155)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              data-testid="input-edit-fullname"
            />
          </div>

          {/* Telefone com DDD */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', display: 'block', marginBottom: '6px' }}>
              Telefone Celular (com DDD) *
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
              required
              placeholder="(11) 98765-4321"
              style={{
                width: '100%',
                minHeight: '44px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#0a0f1d',
                border: phoneError ? '1px solid #ef4444' : '1px solid var(--border-subtle, #334155)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              data-testid="input-edit-phone"
            />
            {phoneError && (
              <span style={{ fontSize: '11px', color: '#f87171', marginTop: '4px', display: 'block' }}>
                {phoneError}
              </span>
            )}
          </div>

          {/* Campos Específicos para Entregador */}
          {isCourier && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', display: 'block', marginBottom: '6px' }}>
                Modal de Transporte *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { id: 'motorcycle', label: 'Moto', icon: Bike },
                  { id: 'bicycle', label: 'Bike', icon: Bike },
                  { id: 'ebike_scooter', label: 'E-Bike', icon: Zap }
                ].map((modal) => {
                  const isSelected = transportModal === modal.id;
                  const IconComp = modal.icon;
                  return (
                    <button
                      key={modal.id}
                      type="button"
                      onClick={() => setTransportModal(modal.id as TransportModal)}
                      style={{
                        minHeight: '44px',
                        padding: '8px',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? 'rgba(0, 245, 155, 0.12)' : '#0a0f1d',
                        border: isSelected ? '1px solid var(--neon-emerald, #00f59b)' : '1px solid #334155',
                        color: isSelected ? 'var(--neon-emerald, #00f59b)' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: isSelected ? 800 : 500,
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <IconComp size={14} />
                      <span>{modal.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Campos Específicos para Lojista */}
          {!isCourier && (
            <>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', display: 'block', marginBottom: '6px' }}>
                  Nome da Loja / Estabelecimento *
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  required
                  placeholder="Nome do estabelecimento"
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#0a0f1d',
                    border: '1px solid var(--border-subtle, #334155)',
                    color: 'var(--text-primary, #f8fafc)',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  data-testid="input-edit-storename"
                />
              </div>

              {/* CEP do Estabelecimento com Busca Automática */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)' }}>
                    CEP do Estabelecimento
                  </label>
                  {isSearchingCep && (
                    <span style={{ fontSize: '11px', color: 'var(--neon-emerald, #00f59b)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Loader2 size={12} className="spin-animate" /> Buscando endereço...
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={postalCode}
                  onChange={handleCepChange}
                  placeholder="Ex: 01310-100"
                  maxLength={9}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#0a0f1d',
                    border: '1px solid var(--border-subtle, #334155)',
                    color: 'var(--text-primary, #f8fafc)',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                  data-testid="input-edit-postalcode"
                />
                {cepError && (
                  <span style={{ fontSize: '11px', color: '#f87171' }}>
                    {cepError}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', display: 'block', marginBottom: '6px' }}>
                    Rua / Avenida
                  </label>
                  <input
                    type="text"
                    value={addressStreet}
                    onChange={(e) => setAddressStreet(e.target.value)}
                    placeholder="Logradouro comercial"
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#0a0f1d',
                      border: '1px solid var(--border-subtle, #334155)',
                      color: 'var(--text-primary, #f8fafc)',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', display: 'block', marginBottom: '6px' }}>
                    Número *
                  </label>
                  <input
                    ref={addressNumberInputRef}
                    type="text"
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value)}
                    placeholder="Ex: 123"
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#0a0f1d',
                      border: '1px solid var(--border-subtle, #334155)',
                      color: 'var(--text-primary, #f8fafc)',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    data-testid="input-edit-addressnumber"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', display: 'block', marginBottom: '6px' }}>
                  Complemento (opcional)
                </label>
                <input
                  type="text"
                  value={addressComplement}
                  onChange={(e) => setAddressComplement(e.target.value)}
                  placeholder="Ex: Sala 102, Galpão B, Apto 4"
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#0a0f1d',
                    border: '1px solid var(--border-subtle, #334155)',
                    color: 'var(--text-primary, #f8fafc)',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  data-testid="input-edit-addresscomplement"
                />
              </div>
            </>
          )}

          {/* Localização Territorial / Cascata Geográfica */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)' }}>
                {isCourier ? 'Bairro Base de Atuação (Quórum Regional)' : 'Localização do Estabelecimento'} *
              </label>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'rgba(0, 245, 155, 0.1)',
                  border: '1px solid rgba(0, 245, 155, 0.3)',
                  color: 'var(--neon-emerald, #00f59b)',
                  borderRadius: '16px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: isDetectingLocation ? 'wait' : 'pointer'
                }}
              >
                {isDetectingLocation ? <Loader2 size={12} className="spin-animate" /> : <Crosshair size={12} />}
                <span>{isDetectingLocation ? 'Detectando...' : 'Minha localização'}</span>
              </button>
            </div>
            {locationFeedback && (
              <div style={{ fontSize: '11px', color: 'var(--neon-emerald, #00f59b)', fontWeight: 600 }}>
                {locationFeedback}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px' }}>
              {/* Estado UF */}
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>UF</label>
                <select
                  value={selectedState}
                  onChange={(e) => handleStateChange(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#0a0f1d',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  data-testid="select-edit-state"
                >
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cidade */}
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Cidade</label>
                <select
                  value={selectedCity}
                  onChange={(e) => handleCityChange(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#0a0f1d',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  data-testid="select-edit-city"
                >
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bairro */}
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Bairro</label>
              {!isCustomNeighborhood ? (
                <select
                  value={selectedNeighborhood}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomNeighborhood(true);
                      setSelectedNeighborhood('custom');
                    } else {
                      setSelectedNeighborhood(e.target.value);
                    }
                  }}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#0a0f1d',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  data-testid="select-edit-neighborhood"
                >
                  {neighborhoods.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                  <option value="custom">Outro bairro...</option>
                </select>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={customNeighborhood}
                    onChange={(e) => setCustomNeighborhood(e.target.value)}
                    placeholder="Digite o nome do bairro"
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#0a0f1d',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    data-testid="input-edit-custom-neighborhood"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomNeighborhood(false);
                      if (neighborhoods.length > 0) {
                        setSelectedNeighborhood(neighborhoods[0].id);
                      }
                    }}
                    style={{
                      minHeight: '44px',
                      padding: '0 12px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      color: '#94a3b8',
                      borderRadius: '8px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Voltar à lista
                  </button>
                </div>
              )}
            </div>

            {/* Múltiplos Bairros de Atuação para Entregador */}
            {isCourier && neighborhoods.length > 1 && (
              <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px dashed #334155' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                  Bairros adicionais para receber turnos e entregas:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {neighborhoods
                    .filter((n) => n.id !== selectedNeighborhood)
                    .map((n) => {
                      const isSelected = operatingNeighborhoods.includes(n.id);
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => toggleOperatingNeighborhood(n.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '16px',
                            fontSize: '11px',
                            fontWeight: 600,
                            border: isSelected ? '1px solid var(--neon-emerald, #00f59b)' : '1px solid #334155',
                            backgroundColor: isSelected ? 'rgba(0, 245, 155, 0.15)' : '#0a0f1d',
                            color: isSelected ? 'var(--neon-emerald, #00f59b)' : '#94a3b8',
                            cursor: 'pointer'
                          }}
                        >
                          {isSelected ? '✓ ' : '+ '} {n.name}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px', justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              style={{ minHeight: '48px', padding: '0 20px' }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="cta"
              disabled={isLoading}
              style={{ minHeight: '48px', padding: '0 24px', fontSize: '14px', fontWeight: 800 }}
              data-testid="btn-save-profile"
            >
              {isLoading ? 'Salvando...' : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Save size={16} /> Salvar Alterações
                </span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
