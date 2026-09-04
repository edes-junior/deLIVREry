/**
 * @file App.tsx
 * @description Aplicação principal do PWA deLIVREry.
 * Orquestra o fluxo de autenticação passwordless (Story 1.2), complementação de perfil universal (Story 1.3)
 * e o Termômetro de Desbloqueio Regional com Indicação Viral (Story 1.4).
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from './auth/use-auth.ts';
import { MagicLinkForm } from './components/auth/MagicLinkForm.tsx';
import { AuthCallback } from './components/auth/AuthCallback.tsx';
import { ProfileCompletionForm } from './components/profile/ProfileCompletionForm.tsx';
import { ProfileService, UserProfileResponse } from './profile/profile-service.ts';
import { QuorumService, RegionQuorum } from './quorum/quorum-service.ts';
import { ReferralService } from './referral/referral-service.ts';
import { RegionalQuorumThermometer } from './components/quorum/RegionalQuorumThermometer.tsx';
import { ReferralCard } from './components/referral/ReferralCard.tsx';

export const App: React.FC = () => {
  const { user, session, isLoading: isAuthLoading, signOut } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [regionQuorum, setRegionQuorum] = useState<RegionQuorum | null>(null);

  // Rastreia código de indicação vindo pela URL (?ref=...)
  useEffect(() => {
    const urlRef = ReferralService.extractReferralCodeFromUrl();
    if (urlRef) {
      ReferralService.saveReferralCodeToStorage(urlRef);
    }
  }, []);

  // Verifica se está na rota de callback de autenticação (#access_token=...)
  const isAuthCallback =
    typeof window !== 'undefined' &&
    (window.location.hash.includes('access_token') || window.location.search.includes('code'));

  // Carrega perfil e quórum regional do usuário
  useEffect(() => {
    async function loadUserProfileAndQuorum() {
      if (!user) {
        setProfileData(null);
        setRegionQuorum(null);
        return;
      }

      setIsProfileLoading(true);
      try {
        const data = await ProfileService.getUserProfile(user.id);
        setProfileData(data);

        // Se o perfil tiver localização, busca o quórum regional
        if (data && data.profile) {
          const stateId = data.profile.state_id;
          const cityId = data.profile.city_id;
          const neighborhoodId =
            data.profile.home_neighborhood_id || data.profile.neighborhood_id;

          if (stateId && cityId && neighborhoodId) {
            const quorum = await QuorumService.getRegionQuorum(
              stateId,
              cityId,
              neighborhoodId
            );
            setRegionQuorum(quorum);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar perfil ou quórum do usuário:', err);
      } finally {
        setIsProfileLoading(false);
      }
    }

    loadUserProfileAndQuorum();
  }, [user]);

  if (isAuthCallback) {
    return (
      <AuthCallback
        onSuccess={() => {
          if (typeof window !== 'undefined') {
            window.location.hash = '';
          }
        }}
      />
    );
  }

  if (isAuthLoading || isProfileLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#0a0f1d',
          color: '#94a3b8',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid #1e293b',
              borderTopColor: '#38bdf8',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px auto'
            }}
          />
          <p>Carregando deLIVREry...</p>
        </div>
      </div>
    );
  }

  // Usuário não autenticado -> Tela de Magic Link (Story 1.2)
  if (!user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0a0f1d',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '16px'
        }}
      >
        <MagicLinkForm />
      </div>
    );
  }

  // Usuário autenticado, mas perfil ainda incompleto -> Form de Perfil (Story 1.3)
  const isProfileComplete = profileData && profileData.user && profileData.user.userType;

  if (!isProfileComplete) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0a0f1d',
          padding: '24px 16px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <ProfileCompletionForm
          userId={user.id}
          userEmail={user.email || ''}
          onProfileCompleted={(completedProfile) => {
            setProfileData(completedProfile);
          }}
        />
      </div>
    );
  }

  const neighborhoodName =
    profileData.profile?.home_neighborhood_id ||
    profileData.profile?.neighborhood_id ||
    'Bairro';

  const referralCode =
    profileData.profile?.referral_code ||
    `LOJA-${profileData.user.id.slice(0, 6).toUpperCase()}`;

  // Perfil Ativo -> Dashboard Inicial com Quórum e Indicação Viral (Story 1.4)
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0f1d',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '24px 16px'
      }}
    >
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto'
        }}
      >
        {/* Barra Superior do Usuário */}
        <div
          style={{
            backgroundColor: '#131822',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid #1e293b',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor:
                  profileData.user.userType === 'courier' ? '#0369a1' : '#047857',
                color: '#fff'
              }}
            >
              {profileData.user.userType === 'courier'
                ? '🛵 Entregador Ativo'
                : '🏪 Lojista Ativo'}
            </span>
            <h1 style={{ fontSize: '20px', margin: '8px 0 2px 0' }}>
              Olá, {profileData.user.fullName}!
            </h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
              {profileData.user.email} • CPF: {profileData.user.cpf}
            </p>
          </div>

          <button
            onClick={() => signOut()}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            Sair
          </button>
        </div>

        {/* Termômetro de Desbloqueio Regional (FR-13) */}
        {regionQuorum && (
          <RegionalQuorumThermometer
            quorum={regionQuorum}
            neighborhoodName={neighborhoodName}
            cityName={profileData.profile?.city_id}
            stateId={profileData.profile?.state_id}
            onShareClick={() => {
              ReferralService.shareReferral(referralCode, neighborhoodName);
            }}
          />
        )}

        {/* Card de Indicação Viral Multicanal (FR-15) */}
        <ReferralCard
          referralCode={referralCode}
          neighborhoodName={neighborhoodName}
        />

        {/* Detalhes do Perfil e Modal */}
        <div
          style={{
            backgroundColor: '#131822',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #1e293b'
          }}
        >
          {profileData.user.userType === 'courier' ? (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '14px'
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Modal</div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>
                    {profileData.profile?.transport_modal === 'motorcycle'
                      ? '🏍️ Motocicleta'
                      : profileData.profile?.transport_modal === 'bicycle'
                      ? '🚲 Bicicleta'
                      : '⚡ E-Bike'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Nível / XP</div>
                  <div
                    style={{ fontSize: '15px', fontWeight: 600, color: '#f59e0b' }}
                  >
                    {profileData.profile?.level || 'Bronze'} (0 XP)
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Diária Base</div>
                  <div
                    style={{ fontSize: '15px', fontWeight: 600, color: '#10b981' }}
                  >
                    R$ {Number(profileData.profile?.base_daily_rate || 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Taxa por Entrega
                  </div>
                  <div
                    style={{ fontSize: '15px', fontWeight: 600, color: '#10b981' }}
                  >
                    R$ {Number(profileData.profile?.base_delivery_fee || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Estabelecimento Comercial
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>
                  {profileData.profile?.store_name}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Reputação Inicial
                  </div>
                  <div
                    style={{ fontSize: '15px', fontWeight: 600, color: '#eab308' }}
                  >
                    ⭐ {Number(profileData.profile?.reputation_score || 5).toFixed(2)} / 5.00
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Região de Atuação
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>
                    {neighborhoodName}, {profileData.profile?.city_id} -{' '}
                    {profileData.profile?.state_id}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
